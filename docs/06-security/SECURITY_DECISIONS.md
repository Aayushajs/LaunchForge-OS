# Security Decisions

Each control, why it exists, and the test that proves it. Tests are in `apps/dokploy/__test__/`.

| Control | Rationale | Proven by |
|---|---|---|
| Foreign references must be owned by the caller's organization | IDs in inputs were trusted, letting a workspace use another's Git installation, registry or SSH key | `permissions/reference-access.test.ts` |
| Service moves validate the target environment; updates cannot change it | `move` wrote any `targetEnvironmentId` | `permissions/reference-access.test.ts` (environment cases) |
| Org-scoped service access with member access lists | Base multi-tenancy | `permissions/cross-org-scope.test.ts`, `permissions/service-access.test.ts` |
| Custom roles work without a license; role names and actions validated | Least privilege for every install | `permissions/server-terminal.test.ts` |
| Private overlay network per workspace; Traefik joins each one | Every service shared `dokploy-network`, so any tenant could reach any other tenant's databases | `compose/network/workspace-network.test.ts` |
| Networks are registered to one workspace; platform names cannot be created or imported | Network import and server ids were unchecked, so a tenant could claim another's network or server | `compose/network/workspace-network.test.ts` |
| Hostname owned by one workspace | Prevent route hijacking | `domains/host-ownership.test.ts` |
| Workload policy for mounts and compose | Container escape is the main multi-tenant risk | `mounts/workload-policy.test.ts` |
| Webhooks: POST only, raw-body signatures | Forged deliveries and GET-triggered deploys | `deploy/webhook-auth.test.ts`, `deploy/refresh-token-handler.test.ts`, `deploy/github-webhook-handler.test.ts` |
| Secrets encrypted at rest, sealed rollback snapshots | Database dumps leaked every credential | `services/rollback-snapshot.test.ts` |
| Build timeout and scoped cancellation | One workspace could hold the build queue or cancel others' builds | `deploy/build-timeout.test.ts`, `queues/build-cancel.test.ts` |
| Health-gated rollout | Broken releases reported as successful | `deploy/rollout.test.ts` |
| Quotas with default limits | Unlimited services starve the host | `quotas/workspace-quota.test.ts` |
| Audit log always on, never blocks the operation | Accountability without availability risk | `audit-log/create-audit-log.test.ts` |
| No source-available code | Legal safety of publishing and running in production | `licensing/no-proprietary-code.test.ts` |
| Generated installer secrets, no default DB password | Hardcoded credentials in the upstream fallback | `.github/workflows/installer.yml` |
| Metrics fetched server-side | SSRF and token exposure | Code review: `server/utils/metrics-endpoint.ts` (no dedicated test yet) |

## Principles

- **Fail closed** for authorization and policy (unknown owner → reject); **fail open** only where availability matters more than the check (audit writes, metering).
- **Check at the last moment** as well as on input: bind mounts are re-checked at deploy time because rows may predate the policy.
- **Operator escape hatches are explicit and global** (`WORKLOAD_POLICY=permissive`, `ALLOW_COMPOSE_TRAEFIK_LABELS=true`), never per-request.
