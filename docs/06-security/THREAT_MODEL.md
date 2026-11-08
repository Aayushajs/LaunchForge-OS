# Threat Model

## Assets

Workspace source code and images · environment variables and build secrets · database contents and credentials · Git provider tokens and SSH deploy keys · registry and S3 credentials · TLS private keys · routed hostnames (traffic) · host and Docker daemon · platform database and encryption key · availability of other workspaces.

## Actors

| Actor | Capabilities |
|---|---|
| Anonymous internet user | Reach Traefik, the sign-in page, webhook endpoints |
| Workspace member | Limited by role and access lists |
| Workspace admin/owner | Full control of one workspace, including compose files, mounts, domains |
| **Malicious workspace** on a shared host | Everything an owner can do, aimed at other workspaces or the host |
| Platform operator | Owner of the first organization; manages quotas |
| Git host / registry | Sends webhooks |

## Threats and mitigations

Status: **mitigated** – control in place and tested; **partial** – reduced, gap documented; **open** – not addressed yet. Finding IDs refer to `docs/01-discovery/REPO_AUDIT.md` §6.

| # | STRIDE | Threat | Mitigation | Code | Status |
|---|---|---|---|---|---|
| S1 | Elevation | Bind-mount `docker.sock` or `/` from a service | Bind mount policy at save and deploy | `utils/security/workload-policy.ts`, `services/mount.ts`, `utils/docker/utils.ts` | mitigated |
| S2 | Elevation | Privileged / host-namespace / device compose; raw Traefik labels | Compose policy before deploy | `workload-policy.ts`, `utils/docker/domain.ts` | mitigated |
| S3 | Tampering | `move` a service into another org's environment | `checkServiceTargetEnvironment` | `services/permission.ts`, 8 routers | mitigated |
| S4 | Info disclosure | `project.duplicate` clones a foreign service (env, passwords) | Access check per selected service | `routers/project.ts` | mitigated |
| S5 | Elevation | `update`/`save*Provider` attach a foreign GitHub installation, registry, SSH key, server | `assertReferencesAccessible`; `environmentId` removed from update schemas | `services/reference-access.ts` | mitigated |
| S6 | Spoofing | Claim another workspace's hostname | Host ownership + normalization | `services/domain-ownership.ts` | partial (no DNS verification; squatting possible) |
| S7 | Info disclosure | Shared overlay network lets workspaces reach each other's services | Each workspace gets a labelled overlay network `lf-ws-<organizationId>` that only Traefik joins besides the workspace's own services; compose files are moved off `dokploy-network`; raw Swarm networks, compose networks, network import and network creation cannot reference the shared or another workspace's network | `utils/docker/workspace-network.ts`, `services/network.ts`, `utils/docker/domain.ts` | mitigated (services deployed before the upgrade move on their next deploy) |
| S8 | Info disclosure | SSRF via metrics URL | URL/token resolved server-side; ownership check on container metrics | `server/utils/metrics-endpoint.ts` | mitigated (template `baseUrl` and custom webhooks still fetch caller URLs: open) |
| S9 | DoS / Elevation | Unbounded builds on the host daemon | Build timeout, scoped cancel, quotas | `utils/builders/build-timeout.ts` | partial (no build sandbox / build CPU limit) |
| S10 | Elevation | Remote Docker falls back to local daemon; cluster router acts locally | `getRemoteDocker` refuses servers without an SSH key | `utils/servers/remote-docker.ts` | partial (cluster router still acts locally when `serverId` is omitted) |
| S11 | Spoofing | Forged or replayed webhook; GET triggers deploy | POST only, raw-body HMAC / token verification | `server/utils/webhook-auth.ts` | mitigated (replay of a valid signed delivery is not detected) |
| S12 | Info disclosure | Plaintext secrets in the database | `encryptedText` columns; sealed rollback snapshots | `db/schema/*.ts`, `services/rollbacks.ts` | mitigated (notification tokens, vault/DNS configs still plaintext: partial) |
| S13 | Elevation / DoS | Shared `/tmp/id_rsa`, key echoed into shell; `pkill` of every build | Per-build temp key via base64; scoped cancel | `utils/providers/git.ts`, `build-timeout.ts` | mitigated |
| S14 | Spoofing | SSH host keys not verified | – | – | open |
| S15 | Info disclosure | Hardcoded Postgres fallback password | Installer always sets `POSTGRES_PASSWORD_FILE` from a generated secret | `scripts/install.sh` | mitigated for installer-based installs |
| S16 | Tampering | Weak password generator; API keys of removed members | `crypto.randomInt`; key rejected without membership | `templates/index.ts`, `lib/auth.ts` | mitigated |
| – | DoS | Fork bomb exhausts host PIDs | Default `Pids` limit per container | `utils/docker/utils.ts` | mitigated |
| – | DoS | One workspace consumes all CPU/memory | CPU/memory quotas with default limits | `services/workspace-quota.ts` | mitigated for applications and databases (compose containers: partial) |
| – | Repudiation | Changes cannot be attributed | Always-on audit log | `services/audit-log.ts` | mitigated |
| – | Legal | Shipping source-available code | Proprietary code removed; CI guard | `__test__/licensing/no-proprietary-code.test.ts` | mitigated |

## Residual risk

Until S14 and the rest of S10 are closed and builds are sandboxed, give "workspace admin" only to people you would trust with shell access to the host. `SECURITY.md` states the same.
