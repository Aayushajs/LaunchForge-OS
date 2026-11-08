# Engineering Case Study: Making a Single-Owner PaaS Safe for Many Teams

**Author:** Aayush Jain · **Repository:** [Aayushajs/LaunchForge-OS](https://github.com/Aayushajs/LaunchForge-OS) · **Stack:** TypeScript, Next.js, tRPC, PostgreSQL/Drizzle, Docker Swarm, Traefik, Go, Bash, GitHub Actions, k6

## TL;DR

I took an open-source, single-owner deployment platform (Dokploy, Apache-2.0) and turned it into LaunchForge: a self-hosted Platform-as-a-Service where several teams can share one installation. I audited ~1,100 TypeScript files, found 16 security issues that only matter once tenants share a host (container escapes, cross-tenant references, route hijacking, SSRF, plaintext secrets), and fixed the critical ones with centralized controls rather than patches per endpoint. I also made deployments verifiable (a release counts only once Swarm reports it healthy), durable across restarts, bounded in time and resources, and installable with one command that backs up and rolls back on failed upgrades. The work is ~5,000 lines across 133 files, 15 new test suites, 3 CI pipelines and 36 design and user documents.

## 1. Problem

Self-hosted PaaS tools give a developer a Heroku-like experience on their own server. They are usually built for one owner: everyone who can log in is trusted with the machine. That breaks down as soon as two teams, or a team and its contractors, share an installation:

- A user who can create a service can mount `/var/run/docker.sock` and control the host.
- A user can attach another team's GitHub installation to their own app and clone that team's private repositories.
- Any workspace can add a domain another workspace already serves and take over its traffic.
- A deploy is "successful" three seconds after Docker accepts the update, even if the container crash-loops.
- A restart of the control plane silently drops queued deployments.

**Goal:** make one installation safe and fair for many workspaces while staying a one-command install on a $10 VPS.

## 2. Constraints

| Constraint | Consequence for the design |
|---|---|
| Must run on one 2 GB server | No Kubernetes, no Redis/Kafka just for a queue; Postgres and Docker Swarm only |
| Must keep the upstream engine working | No rewrite of the builders, routers or UI; add controls at choke points |
| Licensing | Remove the source-available `/proprietary` code that core paths depended on, and re-implement what was needed |
| No production traffic yet | Correctness proven by tests and CI end-to-end runs; performance by k6 on CI runners, with thresholds and no invented numbers |

## 3. Approach

### 3.1 Discovery before code

I wrote a [repository audit](../01-discovery/REPO_AUDIT.md) and [gap analysis](../01-discovery/GAP_ANALYSIS.md) first: every claim checked against source, sorted into reuse / harden / extend / build / replace, with a prioritized security table (S1–S16). Every later commit maps to one of those workstreams.

### 3.2 Centralize authorization at choke points

Instead of patching each of ~550 procedures, I found the shapes they share:

- **References.** Any input with `serverId`, `registryId`, `githubId`, … passes through one function, `assertReferencesAccessible` (`packages/server/src/services/reference-access.ts`), called after the existing service check in all eight service routers. New procedures inherit it by following the pattern. ([ADR-004](../02-architecture/ARCHITECTURE_DECISIONS.md#adr-004--validate-foreign-references-centrally))
- **Movement between environments** happens only through `move` (target checked); update schemas no longer accept `environmentId`.
- **Routing.** `assertHostAvailable` gives a hostname to the first workspace that routes it, after normalizing case, trailing dots and punycode.
- **Outbound requests.** Metrics endpoints now derive the agent URL and token from the database instead of the client (SSRF fix).

### 3.3 Isolation where the kernel boundary is

Containers are the real security boundary, so the policy sits where specs are produced:

- `bindMountViolation` normalizes host paths (so `/srv/../etc` is caught) and rejects the Docker socket and system directories; checked when a mount is saved **and** at deploy time, because old rows predate the policy.
- `composePolicyViolations` rejects privileged mode, host namespaces, dangerous capabilities, devices, unconfined profiles, host binds, unverifiable `include`/`extends`, and raw Traefik labels — while allowing the routing labels the platform itself generates for the stack's own domains.
- Every container gets a PIDs limit; every build a timeout; cancelling a build kills only that service's processes (previously `pkill -f "docker build"` hit every tenant).

### 3.4 A deployment is done when it is healthy

`waitForRollout` (`packages/server/src/utils/builders/rollout.ts`) is a small state machine over Swarm's own data: the service's update status and the tasks of the new `ForceUpdate` generation. Swarm keeps a task with a health check in `starting` until it passes, so `running` means healthy. Rollback, paused updates, three failed tasks (crash loop) or a timeout fail the deployment, and because updates are `start-first` with `FailureAction: rollback`, the old version keeps serving. One subtle bug avoided: Swarm still reports the *previous* update's `rollback_completed` until it starts the new one, so the status is ignored until tasks of the new generation exist (there is a test for exactly this).

### 3.5 Durability without new infrastructure

The deployment scheduler (per-server partitions, per-service FIFO) stayed in memory, but every job is written to `deployment_job` before it is queued and deleted when it finishes; on start the table is replayed. One table instead of a Redis dependency on every install. ([ADR-007](../02-architecture/ARCHITECTURE_DECISIONS.md#adr-007--persist-the-deployment-queue-in-postgres))

### 3.6 Fair sharing: quotas that cannot be bypassed

Quotas are enforced where resources are decided: `withWorkspaceQuota` wraps resource calculation for applications and all six database engines. The key design point: once a workspace has a quota, a service *without* limits is given default limits, otherwise "unlimited" would trivially escape the quota. Count limits run in the nine create functions, so templates, AI-generated stacks and project duplication are covered too. Usage is metered every minute by joining `docker ps` (organization label) with `docker stats`, aggregated hourly with SQL upserts.

### 3.7 Secrets and supply chain

- 27 credential columns moved to an AES-256-GCM column type with lazy re-encryption (no migration, no downtime). Rollback snapshots stored in jsonb no longer carry registry credentials and encrypt their env vars.
- SSH deploy keys go to a per-build temp file written via base64 (the old code echoed the key into a shared `/tmp/id_rsa` inside double quotes — both a race and a shell-injection vector).
- Webhooks are verified over the **raw** request bytes for GitHub, GitLab, Gitea and Bitbucket schemes; the upstream code verified a re-serialized `JSON.stringify(body)`.
- A test fails the build if source-available code returns through a merge.

### 3.8 Operations

`scripts/install.sh` installs on a fresh Ubuntu/Debian server with generated Docker secrets (the upstream fallback was a hardcoded database password) and reuses the tested TypeScript Traefik setup through a `bootstrap` entrypoint in the image. `upgrade` refuses to proceed without a non-empty database backup and rolls the service back if the new version is not healthy. CI runs install → re-install → upgrade → uninstall on Ubuntu 22.04 and 24.04.

## 4. Results

| Area | Before | After |
|---|---|---|
| Cross-tenant references | Stored unchecked in 3 procedure families | Checked centrally; 10 negative test cases |
| Container escape via mounts/compose | Allowed | Rejected with an explanation; 30+ policy test cases |
| Route hijacking | Any workspace, any host | First-come ownership with normalization |
| Release verification | "Done" 3 s after the update was accepted | Done only when running/healthy; automatic rollback |
| Queued deploys after restart | Lost | Restored |
| Build that hangs | Holds the queue forever | Killed after a configurable timeout |
| Credentials in the DB | Plaintext | AES-256-GCM |
| Resource fairness | None | Quotas with default limits + per-minute metering |
| Install | External script, hardcoded DB password | In-repo installer, generated secrets, tested in CI, safe upgrades |
| Proof | — | 15 new test suites, 3 CI pipelines (CI, Installer e2e, Release), weekly k6 load test, 12 ADRs, threat model |

Performance is measured by the weekly k6 workflow on a fresh install made with the production installer. First run ([report](../07-performance/REPORTS/2026-11-08-github-runner.md), 4 vCPU GitHub runner, single node):

| Scenario | Requests | Errors | p50 | p95 | Target |
|---|---|---|---|---|---|
| Authenticated dashboard reads, ramping to 50 users | 10,826 (60 req/s) | 0 % | 27 ms | 176 ms | p95 < 500 ms |
| Webhook burst (unknown token + wrong method) | 12,000 (200 req/s) | 0 % | 3 ms | 4 ms | p95 < 300 ms |

## 5. What was hard

- **Finding the right choke points** in a codebase I did not write: reading 50+ routers to see that every service mutation already called `checkServicePermissionAndAccess` with its input in scope made a one-line, uniform fix possible.
- **Policy without breaking legitimate use:** the platform writes Traefik labels into users' compose files itself, so "no Traefik labels" had to become "no labels except the ones we generate for this stack's current domains".
- **Swarm's eventual consistency** in rollout detection (stale update status, tasks of several generations).
- **TypeScript's weak-type check** made a generic `(input: ServiceReferences)` signature reject unrelated inputs; taking `object` and narrowing inside kept call sites uniform.
- **Testing on a constrained machine:** the TypeScript native compiler ran out of memory on 8 parallel checkers; single-threaded checks and small worker pools kept local verification possible, with full verification in CI.

## 6. Trade-offs I would revisit

- Shared overlay network across workspaces — per-workspace networks are the next isolation step.
- Builds still use the host Docker daemon; rootless BuildKit or a dedicated build VM would sandbox them.
- First-come domain ownership allows squatting; DNS TXT verification closes it.
- The scheduler assumes one dashboard instance; a Postgres `SKIP LOCKED` job table would allow several.

See the [roadmap](ROADMAP.md).

## 7. How to evaluate this work quickly

1. Read the [gap analysis](../01-discovery/GAP_ANALYSIS.md) (what was wrong and why it mattered).
2. Skim the [ADRs](../02-architecture/ARCHITECTURE_DECISIONS.md) (decisions and rejected alternatives).
3. Open `packages/server/src/utils/builders/rollout.ts` and `apps/dokploy/__test__/deploy/rollout.test.ts` (a self-contained example of the approach: small pure decision function, exhaustive tests).
4. Check the green CI, Installer and Load test runs under GitHub Actions.
