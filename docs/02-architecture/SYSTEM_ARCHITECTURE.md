# System Architecture

LaunchForge is a self-hosted Platform-as-a-Service. One **control plane** (dashboard + API) on a manager node turns Git pushes into running Docker Swarm services on the same host or on remote servers, routes traffic to them through Traefik, and keeps several **workspaces** (organizations) isolated from each other on shared hardware.

## Context

```mermaid
flowchart LR
  dev([Developer]) -->|git push| git[(GitHub / GitLab / Gitea / Bitbucket)]
  git -->|signed webhook| lf[LaunchForge]
  dev -->|dashboard, API key| lf
  visitors([Visitors]) -->|HTTPS| lf
  lf -->|Let's Encrypt ACME| le[(Let's Encrypt)]
  lf -->|rclone| s3[(S3-compatible backups)]
  lf -->|SSH| servers[(Remote deploy / build servers)]
  lf -->|alerts| notify[(Slack, Discord, email, ...)]
```

## Containers and components

```mermaid
flowchart TB
  subgraph host[Manager node]
    traefik[Traefik v3<br/>standalone container<br/>:80 :443]
    subgraph panel[Dashboard service - Next.js custom server]
      ui[React dashboard]
      api[tRPC + REST/OpenAPI<br/>Better Auth sessions / API keys]
      authz[Authorization<br/>permission.ts, reference-access.ts,<br/>domain-ownership.ts]
      policy[Workload policy<br/>workload-policy.ts]
      quota[Quota engine<br/>workspace-quota.ts]
      hooks[Webhook handlers<br/>webhook-auth.ts]
      queue[Deployment queue<br/>in-memory + deployment_job]
      worker[Deploy worker<br/>builders + rollout.ts]
      meter[Metering collector<br/>every minute]
      crons[Backup / cleanup crons]
    end
    pg[(PostgreSQL 16<br/>platform state)]
    agent[Go metrics agent]
    swarm[[Docker Engine + Swarm]]
    apps[Workspace services<br/>apps + databases]
  end
  remote[(Remote servers<br/>Docker + Swarm)]

  traefik --> ui
  traefik --> apps
  ui --> api --> authz
  hooks --> queue
  api --> queue --> worker
  worker --> policy
  worker --> quota
  worker -->|dockerode| swarm --> apps
  worker -->|SSH| remote
  meter -->|docker ps / stats| swarm
  meter -->|SSH| remote
  api --> pg
  queue --> pg
  meter --> pg
  agent --> swarm
  api -->|server-side URL + token| agent
```

| Component | Code | Responsibility |
|---|---|---|
| Dashboard + API | `apps/dokploy` | UI, tRPC routers, REST via `@dokploy/trpc-openapi`, auth |
| Core services | `packages/server/src/services` | Business logic shared by the API and workers |
| Builders | `packages/server/src/utils/builders` | Nixpacks, Railpack, buildpacks, Dockerfile, static; Swarm service spec |
| Deployment queue | `apps/dokploy/server/queues` | Per-server FIFO with per-service serialization, persisted in `deployment_job` |
| Workload policy | `packages/server/src/utils/security/workload-policy.ts` | Bind mount and compose rules |
| Quota engine | `packages/server/src/services/workspace-quota.ts` | Count, CPU and memory limits per workspace |
| Metering | `packages/server/src/utils/metering/collector.ts` | Hourly usage per workspace |
| Metrics agent | `apps/monitoring` (Go) | Host and container metrics in SQLite |
| Installer | `scripts/install.sh`, `apps/dokploy/bootstrap.ts` | Install, upgrade with rollback, uninstall |

## Deployment data flow

```mermaid
sequenceDiagram
  autonumber
  participant G as Git host
  participant W as Webhook handler
  participant Q as Queue (+ deployment_job)
  participant B as Builder
  participant P as Policy + quota
  participant S as Docker Swarm
  G->>W: POST /api/deploy/... (raw body, signature)
  W->>W: POST only, verify HMAC / token, branch + watch paths
  W->>Q: add(job) — persisted before it is queued
  Q->>B: run when the server has a free slot
  B->>B: clone (temp SSH key), build (BUILD_TIMEOUT_SECONDS)
  B->>P: bind mounts, compose policy, workspace quota
  P-->>B: resources with default limits applied
  B->>S: update service (start-first, rollback on failure)
  loop until healthy, failed or timeout
    B->>S: inspect service + list tasks of this generation
  end
  B->>Q: done / error, job removed from deployment_job
```

## Trust boundaries

| Boundary | Crossed by | Controls |
|---|---|---|
| Internet → Traefik | Visitor traffic | Host routing only for hosts owned by the routing workspace (`domain-ownership.ts`), TLS |
| Internet → API | Dashboard, API clients, webhooks | Sessions / API keys scoped to one organization; webhooks POST-only with signature or URL token |
| Workspace → workspace | API calls with foreign IDs | `assertServiceInOrganization`, `assertReferencesAccessible`, `checkServiceTargetEnvironment`, host ownership |
| Workload → host | Containers and builds | Workload policy (no socket / host paths / privileged / host namespaces), PIDs limit, build timeout, quota limits |
| Control plane → remote servers | SSH | Per-org server access lists; host key verification is **not implemented yet** |

Known architectural gaps: builds use the host Docker daemon (bounded but not sandboxed); DNS-based domain verification is not implemented.
