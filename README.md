<div align="center">

<img src="apps/dokploy/logo.png" alt="LaunchForge" width="96" />

# LaunchForge OS

**Push to Git. Ship to production. On servers you own.**

A self-hosted Platform-as-a-Service for teams: Git-to-production deployments, managed databases, domains with automatic HTTPS, monitoring, backups and rollbacks — with the isolation, quotas and reliability needed for several teams to share one installation safely.

[![CI](https://github.com/Aayushajs/LaunchForge-OS/actions/workflows/ci.yml/badge.svg)](https://github.com/Aayushajs/LaunchForge-OS/actions/workflows/ci.yml)
[![Installer](https://github.com/Aayushajs/LaunchForge-OS/actions/workflows/installer.yml/badge.svg)](https://github.com/Aayushajs/LaunchForge-OS/actions/workflows/installer.yml)
[![CodeQL](https://github.com/Aayushajs/LaunchForge-OS/actions/workflows/codeql.yml/badge.svg)](https://github.com/Aayushajs/LaunchForge-OS/actions/workflows/codeql.yml)
[![Release images](https://github.com/Aayushajs/LaunchForge-OS/actions/workflows/release.yml/badge.svg)](https://github.com/Aayushajs/LaunchForge-OS/actions/workflows/release.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

[Quickstart](docs/guide/02-quickstart.md) · [Documentation](docs/README.md) · [Engineering case study](docs/engineering/CASE_STUDY.md) · [Architecture](docs/02-architecture/SYSTEM_ARCHITECTURE.md) · [Roadmap](docs/engineering/ROADMAP.md)

</div>

```bash
curl -fsSL https://raw.githubusercontent.com/Aayushajs/LaunchForge-OS/main/scripts/install.sh | sudo bash
```

---

## Why LaunchForge

Most self-hosted PaaS tools assume one trusted owner. LaunchForge starts from an established open-source deployment engine and adds what multi-team use needs:

| Problem in a shared installation | What LaunchForge does | Where |
|---|---|---|
| A service can mount `docker.sock` or `/` and take over the host | **Workload policy** rejects dangerous mounts and compose settings at save and deploy time | [`workload-policy.ts`](packages/server/src/utils/security/workload-policy.ts) |
| A team can wire another team's GitHub installation, registry or SSH key into its app | **Central reference ownership** checks on every service mutation | [`reference-access.ts`](packages/server/src/services/reference-access.ts) |
| Any team can claim a hostname another team serves | **Hostname ownership** with normalization (case, trailing dot, punycode) | [`domain-ownership.ts`](packages/server/src/services/domain-ownership.ts) |
| A crash-looping release is reported as "done" | **Health-gated rollouts**: done only when Swarm runs the new version; automatic rollback | [`rollout.ts`](packages/server/src/utils/builders/rollout.ts) |
| A restart loses queued deployments | **Durable queue** persisted in PostgreSQL and replayed on start | [`in-memory-queue.ts`](apps/dokploy/server/queues/in-memory-queue.ts) |
| One team can starve the server | **Quotas** (CPU, memory, apps, databases, domains) with default limits + **per-minute metering** | [`workspace-quota.ts`](packages/server/src/services/workspace-quota.ts), [`collector.ts`](packages/server/src/utils/metering/collector.ts) |
| Credentials stored in plaintext | **AES-256-GCM encryption at rest** for 27 credential columns | [ER model](docs/04-database/ER_DIAGRAM.md#encrypted-columns) |
| Forged or GET-triggered deploy webhooks | **Raw-body HMAC verification**, POST only | [`webhook-auth.ts`](apps/dokploy/server/utils/webhook-auth.ts) |
| Manual, risky installs and upgrades | **One-command installer** with generated secrets, pre-upgrade backup and automatic rollback, tested end to end in CI | [`install.sh`](scripts/install.sh) |

Read the full story in the [engineering case study](docs/engineering/CASE_STUDY.md).

## Features

**Deploy anything**
- GitHub App, GitLab, Gitea, Bitbucket or any Git URL; auto-deploy on push with branch, tag and watch-path filters; preview environments per pull request
- Nixpacks, Railpack, Heroku and Paketo buildpacks, Dockerfile, static sites — Node.js, Next.js, React, Python, PHP, Go, Java, Ruby, Rust and more
- Prebuilt images from any registry, zip uploads, Docker Compose stacks, one-click templates, AI-generated stacks

**Run it reliably**
- Zero-downtime start-first rollouts, health checks, automatic rollback, registry-backed rollbacks to any earlier deployment
- Replicas, CPU/memory limits, placement across Swarm nodes, remote deploy servers and dedicated build servers
- Build timeouts, scoped cancellation, restart-safe deployment queue

**Data**
- Managed PostgreSQL, MySQL, MariaDB, MongoDB, Redis and libSQL
- Scheduled backups to any S3-compatible storage, streaming restore, volume backups

**Networking**
- Custom domains with automatic Let's Encrypt certificates, path routing, redirects, basic auth, Traefik middlewares
- DNS provider integration (Cloudflare, Route 53, Porkbun, Infomaniak, OVH)

**Operate**
- Live logs, web terminal, host and container metrics, alerts to 12 channels, log/metric shipping to Datadog, Loki, Elasticsearch and others
- Per-workspace usage and quotas, audit log of every change

**Teams**
- Workspaces, invitations, owner/admin/member roles, custom roles, per-member access to projects, services and servers
- API keys, REST/OpenAPI and tRPC APIs, 2FA and passkeys

## Architecture

```mermaid
flowchart LR
  dev([Developer]) -->|git push| git[(GitHub / GitLab / Gitea)]
  git -->|signed webhook| api
  users([Visitors]) -->|HTTPS| traefik[Traefik<br/>TLS + routing]
  subgraph cp[Control plane]
    api[Dashboard + API<br/>Next.js · tRPC · Better Auth]
    authz[AuthZ · workload policy · quotas]
    queue[Durable deployment queue]
    worker[Builders + health-gated rollout]
    meter[Usage metering]
  end
  api --> authz --> queue --> worker
  api --> pg[(PostgreSQL)]
  queue --> pg
  meter --> pg
  worker --> swarm[[Docker Swarm]]
  swarm --> apps[Workspace services<br/>apps + databases]
  traefik --> apps
  worker -->|SSH| remote[(Remote servers)]
```

Details: [system architecture](docs/02-architecture/SYSTEM_ARCHITECTURE.md) · [HLD](docs/03-design/HLD.md) · [LLD](docs/03-design/LLD.md) · [12 architecture decision records](docs/02-architecture/ARCHITECTURE_DECISIONS.md) · [data model](docs/04-database/ER_DIAGRAM.md) · [threat model](docs/06-security/THREAT_MODEL.md)

## Quickstart

1. Get a server: Ubuntu 22.04/24.04 or Debian 12, 2 GB RAM, ports 80/443/3000 open.
2. Run the installer above. It checks the server, installs Docker, initializes Swarm, generates every secret, starts PostgreSQL, Traefik and the dashboard, and waits until it is healthy.
3. Open `http://<server-ip>:3000`, create the owner account, and deploy your first app.

Step by step: [Quickstart](docs/guide/02-quickstart.md) → [Deploy your portfolio](docs/guide/03-tutorial-portfolio.md).

```bash
sudo bash install.sh upgrade             # backup → upgrade → automatic rollback if unhealthy
sudo bash install.sh status
sudo bash install.sh uninstall [--purge]
```

## Documentation

| For | Start here |
|---|---|
| Using LaunchForge | [User guide](docs/README.md#i-want-to-use-launchforge) — concepts, tutorials, every feature, API, troubleshooting |
| Running it | [Installation](docs/09-release/INSTALLATION_GUIDE.md) · [Upgrades](docs/09-release/UPGRADE_GUIDE.md) · [Backup & restore](docs/09-release/BACKUP_RESTORE.md) · [Runbook](docs/09-release/OPERATIONS_RUNBOOK.md) |
| Understanding the engineering | [Case study](docs/engineering/CASE_STUDY.md) · [Architecture](docs/02-architecture/SYSTEM_ARCHITECTURE.md) · [Security decisions](docs/06-security/SECURITY_DECISIONS.md) · [Performance](docs/07-performance/LOAD_TEST_PLAN.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) · [Progress](docs/08-implementation/PROGRESS.md) · [Roadmap](docs/engineering/ROADMAP.md) |

## Security

Every control is tied to a test ([security decisions](docs/06-security/SECURITY_DECISIONS.md)). Open risks are listed honestly in the [threat model](docs/06-security/THREAT_MODEL.md): workspaces still share one overlay network and builds use the host Docker daemon, so give workspace-admin rights only to people you would trust with the host until those land. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Repository layout

```text
apps/dokploy/          Dashboard, API (tRPC + REST), deployment queue, webhooks, bootstrap entrypoint
packages/server/       Core services, DB schema (Drizzle), builders, security policy, quotas, metering
apps/monitoring/       Go metrics agent
apps/api, apps/schedules  Optional workers for distributed (cloud) mode
scripts/install.sh     Installer (install, upgrade, uninstall, status)
tests/load/            k6 load-test scenarios
docs/                  User guide, design docs, ADRs, security, performance, runbooks
.github/workflows/     CI/CD pipelines
```

## Development

Requirements: Node.js 24, pnpm 10, Docker with Swarm.

```bash
pnpm install
cp apps/dokploy/.env.example apps/dokploy/.env
pnpm run dokploy:setup      # Swarm, network, Traefik, Postgres
pnpm run server:script      # build the shared package in watch mode
pnpm run dokploy:dev        # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `pnpm typecheck` | Type-check every workspace |
| `pnpm test` | Vitest suite (~1,700 tests) |
| `pnpm exec biome format .` | Formatting check |
| `pnpm generate:openapi` | Regenerate `openapi.json` |

## CI/CD

| Workflow | Runs | Does |
|---|---|---|
| [CI](.github/workflows/ci.yml) | Every push and PR | Build, typecheck, full test suite against a real Docker Swarm, Go build, format check |
| [Installer](.github/workflows/installer.yml) | Installer changes | ShellCheck; install → re-install → upgrade → uninstall on Ubuntu 22.04 and 24.04 |
| [Release images](.github/workflows/release.yml) | `main`, tags | Multi-arch (amd64/arm64) images to GHCR; GitHub release with notes on tags |
| [CodeQL](.github/workflows/codeql.yml) | Push, PR, weekly | Static security analysis of TypeScript and Go |
| [Security scan](.github/workflows/security-scan.yml) | Push, PR, daily | Trivy: vulnerable dependencies, Dockerfile misconfigurations, leaked secrets |
| [Load test](.github/workflows/load-test.yml) | Weekly, on demand | Real install + k6 scenarios with latency thresholds; publishes a report |
| [Docs](.github/workflows/docs.yml) | Markdown changes | Broken-link check across all documentation |
| [Label pull requests](.github/workflows/labeler.yml) | PRs | Area labels from changed paths |
| [Stale](.github/workflows/stale.yml) | Weekly | Housekeeping for inactive issues and PRs |
| Dependabot | Weekly | npm, GitHub Actions, Docker and Go dependency updates |

## Roadmap

Next: per-workspace networks, SSH host-key pinning, DNS domain verification, registry-free rollback. Then: highly available control plane, rootless build workers, autoscaling, canary releases, point-in-time recovery for PostgreSQL, infrastructure-as-code and a CLI. See the [roadmap](docs/engineering/ROADMAP.md).

## License

[Apache License 2.0](LICENSE). LaunchForge builds on open-source software credited in [NOTICE](NOTICE).
