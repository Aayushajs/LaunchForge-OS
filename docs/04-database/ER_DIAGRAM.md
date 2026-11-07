# Database: Entity-Relationship Model

PostgreSQL 16, schema defined with Drizzle in `packages/server/src/db/schema/`, migrations in `apps/dokploy/drizzle/` (applied at start by `apps/dokploy/migration.ts`). The full schema has 70+ tables; the diagram shows the ownership model and every table LaunchForge added.

## Core ownership model

```mermaid
erDiagram
  user ||--o{ member : "belongs via"
  organization ||--o{ member : has
  organization ||--o{ organization_role : "custom roles"
  organization ||--o{ invitation : has
  user ||--o{ apikey : owns
  organization ||--o{ project : owns
  project ||--o{ environment : has
  environment ||--o{ application : contains
  environment ||--o{ compose : contains
  environment ||--o{ postgres : contains
  environment ||--o{ mysql_mariadb_mongo_redis_libsql : contains
  application ||--o{ domain : routes
  compose ||--o{ domain : routes
  application ||--o{ deployment : has
  compose ||--o{ deployment : has
  deployment |o--o| rollback : "may snapshot"
  application ||--o{ mount : has
  application ||--o{ preview_deployments : has
  organization ||--o{ server : owns
  server |o--o{ application : "runs (serverId / buildServerId)"
  organization ||--o{ git_provider : owns
  git_provider ||--o| github : is
  git_provider ||--o| gitlab : is
  organization ||--o{ registry : owns
  organization ||--o{ ssh_key : owns
  organization ||--o{ audit_log : records
  organization ||--o| workspace_quota : "limited by"
  organization ||--o{ workspace_usage : "metered in"

  organization { text id PK  text name  text ownerId FK  text defaultRole }
  member { text id PK  text organizationId FK  text userId FK  text role  text_array accessedProjects  text_array accessedServices  text_array accessedServers  text_array accessedGitProviders }
  organization_role { text id PK  text organization_id FK  text role  text permission }
  project { text projectId PK  text organizationId FK  text name  encrypted env }
  environment { text environmentId PK  text projectId FK  text name  encrypted env }
  application { text applicationId PK  text environmentId FK  text appName  text sourceType  text buildType  text serverId FK  text buildServerId FK  text githubId FK  text registryId FK  text customGitSSHKeyId FK  text memoryLimit  text cpuLimit  encrypted env  encrypted password }
  postgres { text postgresId PK  text environmentId FK  text appName  encrypted databasePassword  text memoryLimit  text cpuLimit }
  domain { text domainId PK  text host  text path  text applicationId FK  text composeId FK  text previewDeploymentId FK  serial uniqueConfigKey  text domainType }
  deployment { text deploymentId PK  text applicationId FK  text composeId FK  text logPath  text status  text rollbackId FK  text buildServerId FK }
  rollback { text rollbackId PK  text deploymentId FK  text image  jsonb fullContext }
  mount { text mountId PK  text type  text hostPath  text volumeName  text mountPath }
  server { text serverId PK  text organizationId FK  text ipAddress  text sshKeyId FK  text serverType  jsonb metricsConfig }
  git_provider { text gitProviderId PK  text organizationId FK  text userId FK  text providerType  boolean sharedWithOrganization }
  audit_log { text id PK  text organization_id FK  text user_id FK  text action  text resource_type  text resource_id  text metadata  timestamp created_at }
  workspace_quota { text organization_id PK  real max_cpu  int max_memory_mb  int max_applications  int max_databases  int max_domains }
  workspace_usage { text organization_id FK  timestamp hour  int samples  real cpu_core_seconds  real avg_memory_mb  real peak_memory_mb  int containers }
  deployment_job { text id PK  jsonb data  timestamp created_at }
```

`mysql_mariadb_mongo_redis_libsql` stands for the five other database tables, which have the same shape as `postgres`. Services do not store `organizationId`; it is resolved through `environment → project` (ADR-002).

## Tables added by LaunchForge

| Table | Purpose | Key / indexes | Migration |
|---|---|---|---|
| `deployment_job` | Queued deployments not yet finished; replayed on start | PK `id`; index `created_at` | `0199_deployment_job.sql` |
| `workspace_quota` | Per-organization limits (null = unlimited) | PK `organization_id` → `organization` (cascade) | `0200_workspace_quota_usage.sql` |
| `workspace_usage` | Hourly usage per organization | unique `(organization_id, hour)` for upserts; FK cascade | `0200_workspace_quota_usage.sql` |

`audit_log` and `organization_role` existed upstream; LaunchForge now writes and manages them without a license gate.

## Encrypted columns

Stored as `enc:v1:<base64(iv | tag | ciphertext)>` (AES-256-GCM) through the `encryptedText` column type; plaintext rows from older versions are read as-is and encrypted on their next write.

| Table | Columns |
|---|---|
| application | `env`, `previewEnv`, `buildArgs`, `buildSecrets`, `previewBuildArgs`, `previewBuildSecrets`, `password` |
| compose, project, environment | `env` |
| postgres, mongo, redis, libsql | `env`, `databasePassword` |
| mysql, mariadb | `env`, `databasePassword`, `rootPassword` |
| ssh-key | `privateKey` |
| registry | `password` |
| destination | `accessKey`, `secretAccessKey` |
| github | `githubClientSecret`, `githubPrivateKey`, `githubWebhookSecret` |
| gitlab, gitea | `secret`/`client_secret`, `access_token`, `refresh_token` |
| bitbucket | `appPassword`, `apiToken` |
| certificate | `privateKey` |
| ai | `apiKey` |
| webServerSettings | `sshPrivateKey` |
| telemetryProvider | `endpoint`, `apiKey`, `apiSecret` |

Still plaintext: notification channel tokens/webhook URLs, vault and DNS provider `config` jsonb, and the per-service webhook `refreshToken` (used as a lookup key).
