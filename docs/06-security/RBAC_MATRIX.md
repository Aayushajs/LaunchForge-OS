# RBAC Matrix

Source: `packages/server/src/lib/access-control.ts` (statements and static roles) and `packages/server/src/services/permission.ts` (resolution). Every check also requires the resource to belong to the active organization; members additionally need it in their access lists (`accessedProjects`, `accessedEnvironments`, `accessedServices`, `accessedServers`, `accessedGitProviders`).

Legend: **✓** allowed · **–** denied · **toggle** granted per member by the owner (legacy `can*` flags) · **list** only for resources in the member's access list.

## Organization-level resources

| Resource | Actions | Owner | Admin | Member |
|---|---|---|---|---|
| organization | update / delete | ✓ / ✓ | ✓ / – | – |
| member, invitation, team | all | ✓ | ✓ | – |
| ac (roles) | read / create, update, delete | ✓ | ✓ | read / – |
| project | create, delete | ✓ | ✓ | toggle |
| environment | read / create, delete | ✓ | ✓ | read (list) / toggle |
| service | read / create, delete | ✓ | ✓ | read (list) / toggle |
| docker, traefikFiles, api, sshKeys, gitProviders | all | ✓ | ✓ | toggle |
| server | read, create, delete, terminal | ✓ | ✓ | – (servers in list are usable for deploys) |
| registry, certificate, destination, notification | all | ✓ | ✓ | – |
| tag | read / write | ✓ | ✓ | read / – |
| vaultProvider | read / write | ✓ | ✓ | read (names only) / – |
| dnsProvider, telemetryProvider, ai | all | ✓ | ✓ | – |
| auditLog | read | ✓ | ✓ | – |

## Service-level resources (inside services the member can access)

| Resource | Actions | Owner | Admin | Member |
|---|---|---|---|---|
| deployment | read, create, cancel | ✓ | ✓ | ✓ (list) |
| envVars, projectEnvVars, environmentEnvVars | read, write | ✓ | ✓ | ✓ (list) |
| domain | read, create, delete | ✓ | ✓ | ✓ (list) |
| volume, backup, volumeBackup, schedule | all | ✓ | ✓ | ✓ (list) |
| logs, monitoring | read | ✓ | ✓ | ✓ |

## Custom roles

Owners and admins define up to 10 roles per organization (Settings → Users → Custom Roles) as any subset of the statements above. A member with a custom role gets exactly those actions, still limited to the organization and to their access lists. Owners and admins skip checks on the "enterprise-only" resource set (`enterpriseOnlyResources`) because their static roles already grant every action there; the name is inherited from upstream and no longer implies a license.

## Platform operator

Not a role in the table: the owner of the first organization (`isPlatformOperator`). Extra abilities: `workspace.all` and `workspace.setQuota` for every organization.

## Ownership checks that apply to every role

| Check | Where |
|---|---|
| Target service / project / environment in the active organization | `assertServiceInOrganization`, `assertProjectInOrganization`, `checkServiceTargetEnvironment` |
| Referenced server, registry, SSH key, Git provider, environment owned by the organization | `assertReferencesAccessible` |
| Hostname not routed by another organization | `assertHostAvailable` |
| API key owner still a member of the key's organization | `validateRequest` |
