# API Documentation

## Transport

| Interface | Path | Used by |
|---|---|---|
| tRPC | `/api/trpc/<router>.<procedure>` (GET for queries, POST for mutations, superjson-encoded `input`) | The dashboard |
| REST / OpenAPI | `/api/<router>.<procedure>`; spec generated with `pnpm generate:openapi` into `openapi.json` | Scripts, CI, external clients |
| Webhooks | `/api/deploy/...` | Git hosts and registries |
| Auth | `/api/auth/*` (Better Auth) | Sign-in, sign-up, 2FA, passkeys |

## Authentication

- **Session cookie** from `/api/auth/sign-in/email` (or GitHub/Google in cloud mode).
- **API key** in the `x-api-key` header (Settings → Profile → API keys). A key acts as its owner in the organization chosen when it was created; it stops working if the owner leaves that organization.

Every request is authorized in three steps: role permission (see [RBAC_MATRIX.md](../06-security/RBAC_MATRIX.md)) → ownership of the target resource → ownership of every referenced resource.

## Error codes

| tRPC code | HTTP | Meaning in LaunchForge |
|---|---|---|
| `UNAUTHORIZED` | 401 | Not signed in, missing permission, or the resource / a referenced resource belongs to another organization |
| `FORBIDDEN` | 403 | Quota exceeded (`QuotaExceededError`) or operator-only procedure |
| `CONFLICT` | 409 | Hostname already used by another workspace, or host+path already routed |
| `BAD_REQUEST` | 400 | Validation failure, bind mount rejected by the workload policy, domain without an owning service |
| `NOT_FOUND` | 404 | Resource does not exist |

Deploy-time policy violations (compose policy, quota, health timeout) do not fail the API call that queued the deployment; they fail the deployment and appear in its log.

## New and changed procedures

### `workspace` (quotas and usage)

| Procedure | Type | Permission | Input | Returns |
|---|---|---|---|---|
| `workspace.usage` | query | `monitoring.read` | `{ hours?: 1..720 }` (default 24) | `{ quota, allocation: { memoryMb, cpu, applications, databases }, usage: workspace_usage[] }` for the active organization |
| `workspace.isOperator` | query | signed in | – | `boolean` |
| `workspace.all` | query | platform operator | – | Every organization with its quota, allocation and 24 h usage |
| `workspace.setQuota` | mutation | platform operator | `{ organizationId, maxCpu, maxMemoryMb, maxApplications, maxDatabases, maxDomains }` (each positive or `null` = unlimited) | The saved quota; writes an audit entry |

### `customRole`

| Procedure | Permission | Input / behavior |
|---|---|---|
| `customRole.all` | `member.read` | Roles of the active organization with parsed permissions |
| `customRole.getStatements` | owner/admin | Every resource and its actions |
| `customRole.create` | owner/admin | `{ role, permissions: Record<resource, action[]> }`; name `^[a-z0-9][a-z0-9_-]{1,31}$`, not `owner/admin/member`; actions validated against the statements; max 10 roles (`CONFLICT` if the name exists) |
| `customRole.update` | owner/admin | `{ role, permissions }` |
| `customRole.remove` | owner/admin | `{ role }`; `BAD_REQUEST` while members use it |

### `auditLog`

`auditLog.all` (`auditLog.read`): `{ limit 1..200 = 50, offset = 0, action?, resourceType?, userEmail?, from?, to? }` → `{ logs, total }`, newest first, active organization only.

### Monitoring

| Procedure | Input (changed) | Behavior |
|---|---|---|
| `server.getServerMetrics` | `{ serverId?, dataPoints }` | URL and token are read from the server record (or the local web-server settings), never from the client. `serverId` must be accessible to the caller |
| `user.getContainerMetrics` | `{ serverId?, appName, ownerAppName?, dataPoints }` | `ownerAppName` (or `appName`) must be a service the caller can read; `appName` must start with it (compose containers) |

### Service mutations (all eight service routers)

Every procedure that takes a service id also validates foreign references in its input: `environmentId` (only via `move`), `serverId`, `buildServerId`, `registryId`, `rollbackRegistryId`, `buildRegistryId`, `customGitSSHKeyId`, `githubId`, `gitlabId`, `giteaId`, `bitbucketId`. `update` no longer accepts `environmentId`. `create` fails with `FORBIDDEN` when the workspace's application or database count quota is reached.

### `domain.create` / `domain.update`

- The domain must belong to a service the caller can manage (`application`, `compose`, or `preview` with `previewDeploymentId`); otherwise `BAD_REQUEST`.
- Host ownership rules → `CONFLICT` (see ADR-010).
- Domain count quota → `FORBIDDEN`.

## Deploy webhooks

| Endpoint | Target | Authentication |
|---|---|---|
| `POST /api/deploy/{token}` | Application | URL token; optional signature checked against the token |
| `POST /api/deploy/compose/{token}` | Compose | Same |
| `POST /api/deploy/github` | GitHub App installations | `X-Hub-Signature-256` with the app's webhook secret (required) |

Signature headers accepted on the token endpoints: `X-Gitlab-Token` (equal to the token), `X-Gitea-Signature`, `X-Hub-Signature-256` / `X-Hub-Signature` (`sha256=` HMAC of the raw body with the token as key).

| Status | When |
|---|---|
| 200 | Accepted (deployment queued) or ignored by branch / watch-path / skip rules |
| 400 | Auto-deploy disabled or payload is not valid JSON |
| 401 | Signature present but invalid; GitHub App signature missing or invalid |
| 404 | Unknown token |
| 405 | Method other than POST |
| 413 | Body larger than 25 MB |
