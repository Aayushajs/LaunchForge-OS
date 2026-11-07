# Existing Feature Inventory

> Baseline: Dokploy `canary` @ `d73650694`. Companion to [REPO_AUDIT.md](REPO_AUDIT.md), which has the detail and file paths.
>
> **Status:** ✅ Implemented · 🟡 Partial · ❌ Missing · 🔒 Implemented but requires a Dokploy enterprise license (proprietary code)
> **Ready?** = usable as-is for LaunchForge Phase A (self-hosted, several workspaces on one host).

## Source & build

| Feature | Status | Ready? | Key location |
|---|---|---|---|
| GitHub App integration (per org, manifest flow) | ✅ | Yes | `pages/api/providers/github/setup.ts`, `utils/providers/github.ts` |
| GitLab / Gitea OAuth | ✅ | Needs hardening (no state nonce) | `pages/api/providers/{gitlab,gitea}/` |
| Bitbucket, raw Git (HTTPS/SSH) | ✅ | Needs hardening (`/tmp/id_rsa`) | `utils/providers/{bitbucket,git}.ts` |
| Auto-deploy on push (GitHub, signed) | ✅ | Yes | `pages/api/deploy/github.ts` |
| Auto-deploy via token URL (GitLab, Gitea, Bitbucket, Docker Hub, GHCR) | 🟡 | No HMAC verification | `pages/api/deploy/[refreshToken].ts` |
| Watch paths, branch/tag triggers, `[skip ci]` | ✅ | Yes | `pages/api/deploy/*` |
| Build: Nixpacks, Railpack, Heroku & Paketo buildpacks, Dockerfile, static | ✅ | Yes (unsandboxed) | `utils/builders/` |
| Zip upload ("drop"), prebuilt Docker image | ✅ | Yes | `utils/builders/drop.ts` |
| Build args & BuildKit build secrets | ✅ | Yes | `utils/builders/docker-file.ts` |
| Patches applied before build | ✅ | Yes | `services/patch.ts` |
| Remote / dedicated build servers | ✅ | Yes | `schema/server.ts` (`serverType`) |
| Build timeouts, build resource limits | ❌ | — | — |

## Runtime & deployment

| Feature | Status | Ready? | Key location |
|---|---|---|---|
| Apps as Docker Swarm services | ✅ | Yes | `utils/builders/index.ts` (`mechanizeDockerContainer`) |
| Docker Compose / Swarm stacks | ✅ | Unsafe on shared hosts | `utils/builders/compose.ts` |
| CPU / memory limits per service | 🟡 | Optional, unbounded, not tied to quotas | `utils/docker/utils.ts:624` |
| Replicas, placement, restart/update/rollback policies | ✅ | Raw JSON unchecked | `schema/shared.ts` |
| Zero-downtime updates (start-first) | 🟡 | Only effective with a health check | `utils/docker/utils.ts:696-714` |
| Health checks | 🟡 | Only if user writes Swarm JSON | `healthCheckSwarm` |
| Deployment history & build logs | ✅ | Last 10 kept | `services/deployment.ts` |
| Rollback | 🟡 | Requires a registry | `services/rollbacks.ts` |
| Preview deployments for PRs | 🟡 | GitHub only | `services/preview-deployment.ts` |
| Volumes, bind & file mounts | ✅ | Bind mounts unsafe on shared hosts | `services/mount.ts` |
| Port publishing, redirects, basic auth | ✅ | Yes | `services/{port,redirect,security}.ts` |
| Scheduled jobs (cron commands in containers) | ✅ | Yes | `services/schedule.ts` |
| Deployment queue with per-server concurrency | 🟡 | In-memory, lost on restart | `apps/dokploy/server/queues/` |
| Container hardening (cap drop, pids limit, userns, read-only) | ❌ | — | — |

## Databases & data

| Feature | Status | Ready? | Key location |
|---|---|---|---|
| PostgreSQL, MySQL, MariaDB, MongoDB, Redis, libSQL | ✅ | Yes (plaintext passwords) | `utils/databases/` |
| External DB ports | ✅ | No allocation policy | `routers/<db>.ts` `saveExternalPort` |
| Scheduled DB backups to S3-compatible storage | ✅ | Yes | `utils/backups/` |
| Volume backups | ✅ | Yes | `utils/volume-backups/` |
| Restore with streamed logs | ✅ | Yes | `utils/restore/` |
| Self-backup of the platform | ✅ | Yes | `utils/backups/web-server.ts` |
| Storage quotas, backup encryption, PITR | ❌ | — | — |

## Networking & domains

| Feature | Status | Ready? | Key location |
|---|---|---|---|
| Traefik reverse proxy | ✅ | Yes | `setup/traefik-setup.ts` |
| Custom domains, path prefixes, multiple domains per app | ✅ | No ownership check | `services/domain.ts` |
| Automatic HTTPS (Let's Encrypt HTTP-01) | ✅ | Yes | `setup/traefik-setup.ts:450-466` |
| Custom certificates | ✅ | Private keys in plaintext | `services/certificate.ts` |
| Generated hostnames (`*.sslip.io`) | ✅ | Replace with platform subdomain | `templates/index.ts:33` |
| DNS provider record management (Cloudflare, Route53, …) | ✅ | Not used for verification | `utils/dns/` |
| Domain ownership verification, host uniqueness | ❌ | — | — |
| Wildcard certificates (DNS-01) | ❌ / UNVERIFIED | — | — |
| Custom Docker networks | ✅ | Yes | `services/network.ts` |

## Observability

| Feature | Status | Ready? | Key location |
|---|---|---|---|
| Host CPU/RAM/disk/network metrics | ✅ | Yes | `apps/monitoring/monitoring/` |
| Per-container metrics | ✅ | Host-wide, not per workspace | `apps/monitoring/containers/` |
| Threshold alerts | ✅ | Yes | `CheckThresholds` |
| Live container logs, web terminal | ✅ | Ownership-checked | `apps/dokploy/server/wss/` |
| Log/metric shipping (Vector → 9 providers) | ✅ | Optional | `services/logs-and-metrics/` |
| Notifications (12 channels) | ✅ | Yes | `utils/notifications/` |
| Per-workspace usage dashboard, metering | ❌ | — | — |

## Identity, access & admin

| Feature | Status | Ready? | Key location |
|---|---|---|---|
| Email/password auth, sessions, password reset | ✅ | Yes | `packages/server/src/lib/auth.ts` |
| 2FA (TOTP), passkeys | ✅ | Yes (not enforceable) | Better Auth plugins |
| GitHub/Google social login | 🔒 UI | Login buttons live in `components/proprietary/auth/` | — |
| Organizations, invitations | ✅ | Yes | `schema/account.ts` |
| Owner/admin/member roles + per-resource access lists | ✅ | Has cross-org holes | `lib/access-control.ts`, `services/permission.ts` |
| Custom roles | 🔒 | — | `routers/proprietary/custom-role.ts` |
| SSO (OIDC/SAML), SCIM, forward-auth | 🔒 | — | `routers/proprietary/` |
| Audit log | 🔒 | Writes skipped without license | `services/proprietary/audit-log.ts` |
| White-labeling | 🔒 | — | `routers/proprietary/whitelabeling.ts` |
| API keys (`x-api-key`) | ✅ | No scopes | Better Auth `apiKey` |
| OpenAPI / REST | ✅ | ~554 paths | `openapi.json` |
| API rate limiting | 🟡 | Per-key fields only | — |
| Public self-signup | ✅ | Cloud mode only | `auth.ts:216-389` |
| Billing (Stripe, server-count plans) | ✅ | Cloud mode only, not usage-based | `routers/stripe.ts` |
| Platform admin (impersonation) | 🟡 | Cloud only, consent checked client-side | `impersonation-bar.tsx` |
| Workspace suspension, admin dashboard | ❌ | — | — |
| AI assistant (multiple LLM providers) | ✅ | Optional | `routers/ai.ts` |

## Operations

| Feature | Status | Ready? | Key location |
|---|---|---|---|
| Multi-server via SSH, Swarm cluster management | ✅ | No host-key verification | `setup/server-setup.ts`, `routers/cluster.ts` |
| One-click templates (remote catalog) | ✅ | Depends on `templates.dokploy.com` | `packages/server/src/templates/` |
| In-app upgrade (image swap) | ✅ | Points to `dokploy/dokploy` images | `routers/settings.ts:619` |
| One-command installer | ❌ in repo | External `dokploy.com/install.sh` | — |
| Multi-arch images, CI test/typecheck | ✅ | Pipelines publish to Dokploy registries | `.github/workflows/` |
