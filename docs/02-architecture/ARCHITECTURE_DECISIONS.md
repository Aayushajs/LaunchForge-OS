# Architecture Decision Records

Each record states the context, the decision, its consequences, and what was rejected.

---

## ADR-001 — Build on an existing PaaS engine instead of from scratch

**Context.** The goal is a production-capable PaaS. Git integration, six build systems, Swarm orchestration, Traefik routing, managed databases and backups are each months of work, and an open-source engine (Dokploy, Apache-2.0) already implements them with a large test suite.

**Decision.** Fork the engine and invest in what it lacks for multi-workspace use: authorization, isolation, quotas, reliability, installer.

**Consequences.** Fast path to a working product; the engineering work is concentrated where risk is highest. The codebase keeps upstream naming internally (`dokploy-network`, `/etc/dokploy`), and Apache-2.0 attribution is kept in `LICENSE`/`NOTICE`.

**Rejected.** Greenfield (re-implements solved problems); a new frontend on the existing API (duplicates ~550 procedures of UI for no new capability).

---

## ADR-002 — An organization is the tenancy unit (workspace)

**Context.** Tenancy needs a boundary for ownership, quotas and metering.

**Decision.** Reuse `organization`. Projects, servers, registries, Git providers and SSH keys already carry `organizationId`; services resolve it through `environment → project`.

**Consequences.** No data migration. Every service-level check joins through environment and project (`findServiceOrganizationId` in `permission.ts`).

**Rejected.** A new `workspace` table (duplicates organizations and Better Auth membership); denormalizing `organizationId` onto every service table (deferred — a migration with backfill).

---

## ADR-003 — Ship only Apache-2.0 code

**Context.** Upstream `/proprietary` directories are source-available: production use needs a commercial agreement, and the license checks were wired into the permission engine and every login.

**Decision.** Delete them and re-implement what LaunchForge needs: an always-on audit log (`services/audit-log.ts`) and custom-role management (`routers/custom-role.ts`). Drop SSO/SCIM/white-labeling. A test (`__test__/licensing/no-proprietary-code.test.ts`) fails if a proprietary path or import reappears.

**Consequences.** The repository can be published and run in production freely. Custom roles and per-member server/Git-provider access are now available to everyone. SSO is gone until re-implemented.

---

## ADR-004 — Validate foreign references centrally

**Context.** Service procedures accept IDs of other resources (environment, server, registries, SSH key, four Git provider types). Several procedures stored them without checking ownership, so a workspace could attach another workspace's GitHub installation or registry credentials.

**Decision.** One function, `assertReferencesAccessible(ctx, input)` (`services/reference-access.ts`), checks every known reference key on any input and is called after the existing service permission check in all eight service routers. Moving a service between environments goes only through `move`, which calls `checkServiceTargetEnvironment`; update schemas no longer accept `environmentId`.

**Consequences.** New procedures are covered as long as they follow the same pattern. Cost: a few extra indexed lookups per mutation.

**Rejected.** Per-procedure checks (the original approach, which is how the gaps appeared).

---

## ADR-005 — Workload policy: deny-list, operator allow-roots, explicit opt-out

**Context.** On a shared host, a bind mount of `/var/run/docker.sock` or `/`, a privileged compose service, or host networking is root on the machine. Raw Traefik labels can claim any hostname.

**Decision.** `workload-policy.ts` rejects dangerous bind mount sources (after path normalization) and compose features (privileged, host namespaces, devices, dangerous capabilities, unconfined security options, host binds, `include`/`extends` from files, raw Traefik routing labels). The check runs when a mount is saved and again at deploy time. Operators can restrict bind mounts to `BIND_MOUNT_ALLOWED_ROOTS`, or set `WORKLOAD_POLICY=permissive` on single-owner installs.

**Consequences.** Some compose files from the wild need edits. Builds still use the host daemon (bounded by a timeout, not sandboxed).

**Rejected.** gVisor/Kata runtimes (heavy, not available on every VPS); allow-list only (too restrictive for ordinary images).

---

## ADR-006 — Deployments finish only when Swarm says the new version is healthy

**Context.** A deploy was marked done three seconds after the service update was accepted, whether or not the container ever started.

**Decision.** `waitForRollout` polls the service and its tasks for the new `ForceUpdate` generation. Swarm keeps a task with a health check in `starting` until it passes, so `running` means healthy. Rollback, paused updates, crash loops (three failed tasks) and a timeout (`DEPLOY_HEALTH_TIMEOUT_SECONDS`) fail the deployment. Combined with `UpdateConfig {Order: start-first, FailureAction: rollback}`, a failed version never replaces a healthy one.

**Consequences.** Deploys take as long as the app needs to become healthy. A stale rollback status from a previous deploy is ignored until tasks of the new generation exist.

---

## ADR-007 — Persist the deployment queue in Postgres

**Context.** The self-hosted queue was in memory; a restart lost queued deployments silently.

**Decision.** Keep the in-memory scheduler (per-server partitions, per-service FIFO) and add a `JobStore` (`deployment_job` table): a job is saved before it is queued and removed when it finishes or is cancelled; `restore()` replays the table on start.

**Consequences.** No new infrastructure. A job interrupted mid-build is re-run after restart (its old deployment row is marked cancelled).

**Rejected.** Redis + BullMQ (one more stateful service for every install).

---

## ADR-008 — Enforce CPU/memory quotas at deploy time with default limits

**Context.** Service limits are optional; "unlimited" services would make any quota meaningless.

**Decision.** `withWorkspaceQuota` wraps resource calculation in the application and all six database builders. For workspaces with a quota, services without limits get `DEFAULT_SERVICE_MEMORY_MB` / `DEFAULT_SERVICE_CPU`, and the deploy is rejected if the workspace total (other services counted at their effective limits) would exceed it. Count limits are checked when services, databases and domains are created.

**Consequences.** Quotas govern reservations (what may be used), not instantaneous usage; usage is measured separately (ADR-009). Compose services are counted, but their per-container resources are not yet limited.

---

## ADR-009 — Meter usage from `docker stats` grouped by the organization label

**Context.** Usage per workspace is needed for capacity planning and future billing. Every service already carries a `dokploy.organization.id` label.

**Decision.** Every minute, join `docker ps` (container → organization) with `docker stats --no-stream` on the local host and each deploy server, and upsert hourly rows (CPU core-seconds, average/peak memory, containers) in `workspace_usage`. Retention 90 days.

**Consequences.** Cheap and dependency-free; resolution is one minute. Network and disk I/O are not metered yet.

**Rejected.** Reading the Go agent's SQLite (host-local, not per workspace); cAdvisor + Prometheus (extra services).

---

## ADR-010 — First workspace to route a hostname owns it

**Context.** Any workspace could add a domain already used by another and split or steal its traffic.

**Decision.** `assertHostAvailable` normalizes the host (case, trailing dot, punycode) and rejects it if another organization routes it; within one organization, the same host + path may be used once. Applied on create and update.

**Consequences.** Stops hijacking between workspaces. Squatting (claiming a domain before its real owner) is still possible; DNS TXT verification is the planned follow-up.

---

## ADR-011 — Bash installer plus a bootstrap entrypoint in the image

**Context.** The upstream installer lives outside the repository under an unverified license, and Traefik container setup is non-trivial code that already exists and is tested.

**Decision.** `scripts/install.sh` handles preflight, Docker, Swarm, network, secrets, Postgres and the dashboard service; `node dist/bootstrap.mjs` (built from `apps/dokploy/bootstrap.ts`) reuses the TypeScript Traefik setup. Upgrades back up the database and roll back if the new version is unhealthy. CI installs, re-installs, upgrades and uninstalls on Ubuntu 22.04 and 24.04.

**Consequences.** One command on a fresh server; no hardcoded database password (all secrets are generated Docker secrets).

---

## ADR-012 — Encrypt secrets with a column type, re-encrypt lazily

**Context.** Database passwords, SSH keys, Git tokens, registry and S3 credentials and certificate keys were stored in plaintext.

**Decision.** Switch those columns to the existing `encryptedText` custom type (AES-256-GCM, `enc:v1:` prefix). Plaintext values are read as-is and encrypted on their next write, so no data migration is needed. Explicit `z.string()` overrides keep validation, since drizzle-zod maps custom types to `any`. Rollback snapshots (jsonb) encrypt their secret fields and drop registry credentials.

**Consequences.** A database backup is useless without the encryption key, which the installer stores as a Docker secret. Decryption failures return the raw value (upstream decision, so a key mismatch does not break every query).
