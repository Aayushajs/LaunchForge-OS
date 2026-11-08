# 15. Feature reference

Every feature of LaunchForge in one place: what it does, where to find it, and how to use it. Each section links to the chapter with the full walk-through.

Menu paths are written **Area → Page → Tab**. "Service" means an application, a Compose stack or a database.

## Getting started

| Feature | Where | What it does and how to use it |
|---|---|---|
| One-command install | Server terminal | `curl -fsSL https://raw.githubusercontent.com/Aayushajs/LaunchForge-OS/main/scripts/install.sh \| sudo bash` installs Docker, Swarm, PostgreSQL, Traefik and the dashboard, generates every secret, and prints the address to open. Running it again is safe. [Installation guide](../09-release/INSTALLATION_GUIDE.md) |
| Upgrade, status, uninstall | Server terminal | `sudo bash install.sh upgrade [--version X.Y.Z]` backs up the database first; `status` shows what runs; `uninstall [--purge]` removes it. [Upgrade guide](../09-release/UPGRADE_GUIDE.md) |
| Owner account | `http://<server-ip>:3000` | The first account owns the installation and its workspace becomes the platform workspace. |
| Dashboard domain | **Settings → Web Server** | Serve the dashboard at `https://deploy.example.com` with a Let's Encrypt certificate, then close port 3000. |
| In-app updates | Sidebar footer, **Update** | Checks the latest LaunchForge release on GitHub and switches the dashboard to that image. Platform workspace only. |
| Language | User menu, or the sign-in page | English, हिन्दी, Español, Português, Deutsch, Français, 日本語, 简体中文. Picked from the browser and remembered. |
| Light and dark theme | User menu | Follows the system setting until you choose. |

## Projects and environments

| Feature | Where | What it does and how to use it |
|---|---|---|
| Projects | **Projects → Create Project** | A folder for related services, for example `portfolio` or `shop`. |
| Environments | Inside a project, environment selector | Each project starts with `production`; add `staging` or `development`. Services in different environments are separate. |
| Shared variables | Project or environment **Environment** button | Variables available to every service below; reference them as `${{project.NAME}}` or `${{environment.NAME}}`. |
| Move and duplicate | Service menu | Move a service to another environment, or duplicate a project with selected services. Only within your workspace. |
| Search | `Ctrl`/`⌘` + `K` | Jump to any project or service. |
| Tags | **Settings → Tags** | Label projects and filter by label. |

## Applications

An application is one container image built from source or pulled from a registry. [Applications](04-applications.md)

| Feature | Where | What it does and how to use it |
|---|---|---|
| Sources | **General → Provider** | GitHub, GitLab, Gitea, Bitbucket (through their apps or OAuth), any Git URL (with an SSH key for private ones), a prebuilt Docker image, or a zip file you upload ("Drop"). |
| Build types | **General → Build type** | **Nixpacks** (detects Node, Python, Go, PHP, Ruby, Java, Rust, …), **Railpack**, **Heroku** and **Paketo** buildpacks, **Dockerfile** (path, context, target stage, build arguments), **Static** (serves files with nginx). |
| Publish directory | **General**, Nixpacks | Serve a built folder such as `dist` with nginx, for single-page apps. |
| Deploy, redeploy, stop, start | **General** buttons | Deploy builds and rolls out; Rebuild skips the cache; Stop scales to zero. |
| Autodeploy | **General → Autodeploy** | Deploy on every push to the branch. |
| Watch paths | **General → Watch paths** | Only deploy when files matching these patterns change. |
| Environment variables | **Environment** | `KEY=value` per line, encrypted at rest. Build-time variables and build secrets are separate fields. |
| Domains | **Domains** | Host, path, container port, HTTPS with Let's Encrypt or your own certificate. See [Domains](06-domains.md). |
| Generated domain | **Domains → Generate sslip.io domain** | An instant `*.sslip.io` address that resolves to your server's IP. HTTP only; good for testing. |
| Deployments | **Deployments** | Every deployment with its live build log, commit, duration and status. Cancel a running build. |
| Health-gated rollout | Automatic | A deployment is *done* only when the new containers are running and healthy. Otherwise it fails and the old version keeps serving. |
| Health check | **Advanced → Swarm Settings → Health Check** | Docker health check JSON. Strongly recommended. |
| Rollback | **Advanced → Rollback Settings**, then **Deployments → Rollback** | Keeps the image of each deployment in a registry and restores any of them without rebuilding. |
| Preview deployments | **Preview Deployments** | Each pull request gets its own build and URL; removed when the pull request closes. |
| Logs | **Logs** | Live and recent container logs, with search. |
| Container monitoring | **Monitoring** | CPU, memory, network and disk I/O of the running container, as live charts. |
| Terminal | **General → Open terminal** | A shell inside the running container. |
| Schedules | **Schedules** | Run a command in the container on a cron schedule, for example a nightly cleanup script. |
| Volume backups | **Volume Backups** | Back up a named volume to S3 storage on a schedule. |
| Patches | **Patches** | Edit or add files in the repository right before each build, without committing them, for example a config file with server-specific values. |
| Resources | **Advanced → Resources** | Memory and CPU limits and reservations. Unset limits get `DEFAULT_SERVICE_MEMORY_MB` and `DEFAULT_SERVICE_CPU`. Counted against the workspace quota. |
| Replicas and placement | **Advanced → Cluster Settings** | Number of replicas, the registry used to share images with other nodes, and placement constraints. |
| Swarm settings | **Advanced → Swarm Settings** | Restart, update and rollback policies, labels, mode, network attachments, stop grace period. |
| Volumes and file mounts | **Advanced → Volumes** | Named volumes, bind mounts (outside system paths) and file mounts whose content you edit in the dashboard. |
| Ports | **Advanced → Ports** | Publish a container port on the server directly, for non-HTTP traffic such as a game server. |
| Redirects | **Advanced → Redirects** | Regex redirects such as `www` to the bare domain. |
| Basic authentication | **Advanced → Security** | Protect the app with a username and password at the proxy. |
| Traefik configuration | **Advanced → Traefik** | View and edit this application's generated router configuration. |
| Run command | **Advanced → General** | Override the container's command and arguments. |
| Build server | **Advanced → Build Server** | Build on a dedicated server and deploy the image elsewhere. |
| Deploy webhook | **Deployments → Webhook URL** | A secret URL that triggers a deployment, for any CI system. |

## Docker Compose

A Compose service runs a whole `docker-compose.yml` or a Swarm stack. [Compose and templates](07-compose.md)

| Feature | Where | What it does and how to use it |
|---|---|---|
| Sources | **General** | The same Git providers as applications, or a compose file written in the dashboard ("Raw"). |
| Compose or Stack | **General → Compose type** | `docker compose` on one server, or `docker stack deploy` on the Swarm. |
| Domains per service | **Domains** | Route a hostname to any service in the file; LaunchForge adds the Traefik labels. |
| Isolated deployment | **Advanced** | Give the stack its own network and unique names, so two copies of the same file never collide. |
| Containers | **Containers** | Every container of the stack, with logs and terminal. |
| Templates | **Create Service → Template** | One-click stacks such as WordPress, Plausible, n8n, Uptime Kuma or Supabase. |
| AI-generated stacks | **Create Service → AI** | Describe what you need; get a compose file to review and deploy. Requires an AI provider under **Settings → AI**. |
| Workload policy | Automatic | Rejects privileged containers, host network or PID namespaces, devices, dangerous capabilities and mounts of the Docker socket or system paths. Turn off only on a single-owner server with `WORKLOAD_POLICY=permissive`. |

## Databases

[Databases and backups](05-databases.md)

| Feature | Where | What it does and how to use it |
|---|---|---|
| Engines | **Create Service → Database** | PostgreSQL, MySQL, MariaDB, MongoDB, Redis and libSQL, with the image version of your choice. |
| Internal connection | Database **General → Internal credentials** | A connection string that works from your apps in the same workspace. |
| External access | Database **General → External port** | Publish the database on a server port to connect from your computer. Close it when done. |
| Backups | Database **Backups** | Scheduled dumps to any S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO, Oracle Object Storage), with retention. |
| Restore | Database **Backups → Restore** | Stream a backup back into the database. |
| Logs, monitoring, resources | Same tabs as applications | Live logs, metrics and memory/CPU limits. |

## Domains and certificates

[Domains and HTTPS](06-domains.md)

| Feature | Where | What it does and how to use it |
|---|---|---|
| Automatic HTTPS | Domain **HTTPS** + **Let's Encrypt** | Issued and renewed automatically once DNS points at the server. |
| Your own certificates | **Settings → Certificates** | Upload a certificate and key, then pick it on a domain. |
| Hostname ownership | Automatic | A hostname belongs to one workspace; others cannot add it. |
| Paths | Domain **Path** | Route `example.com/api` and `example.com/` to different services. |
| DNS providers | **Settings → DNS Providers** | Connect Cloudflare, Route 53, Porkbun, Infomaniak or OVH to manage records from LaunchForge. |

## Teams and access

[Teams, roles and audit](08-teams-and-access.md)

| Feature | Where | What it does and how to use it |
|---|---|---|
| Workspaces | Workspace switcher in the sidebar | Separate tenants with their own projects, members, Git accounts, servers and quotas. |
| Invitations | **Settings → Users → Invite** | Invite by email with a role; the link expires. |
| Roles | **Settings → Users** | Owner, admin, member, or a custom role. |
| Custom roles | **Settings → Users → Roles** | Choose exactly which actions a role allows, for example a *deployer* who can deploy but not delete. |
| Per-member access | **Settings → Users → member → Permissions** | Limit a member to specific projects, environments, services and servers. |
| Audit log | **Settings → Audit Logs** | Who did what and when, for every change. Always on. |
| Sessions | **Settings → Sessions** | See where you are signed in and sign other sessions out. |
| Two-factor and passkeys | **Settings → Profile** | Authenticator app codes with backup codes, and passkeys. |
| API keys | **Settings → Profile → API keys** | Keys scoped to one workspace, with optional expiry and rate limits. |
| Public sign-up | `ALLOW_PUBLIC_SIGNUP=true` | Anyone can register and gets their own workspace with a bounded quota. [Public platform](14-public-platform.md) |

## Usage, quotas and monitoring

[Monitoring, alerts and usage](10-monitoring.md)

| Feature | Where | What it does and how to use it |
|---|---|---|
| Usage and quotas | **Settings → Usage & Quotas** | Reserved memory, CPU, applications and databases against the workspace quota, and hourly CPU and memory actually used in the last 24 hours, as charts and a table. |
| Quota management | **Settings → Usage & Quotas** (platform workspace) | Set limits for any workspace. Deploys that would exceed them are refused with a clear message. |
| Server monitoring | **Monitoring** (platform workspace) | CPU, memory, disk and network of the server over time, with threshold alerts. |
| Requests | **Requests** (platform workspace) | Traefik access log: which hosts and paths are called, response codes and timings. |
| Notifications | **Settings → Notifications** | Slack, Discord, Telegram, Microsoft Teams, Mattermost, Lark, email, Resend, Gotify, ntfy, Pushover or any webhook, for: deployment done, build failed, backup result, server restart, Docker cleanup and CPU/memory threshold. |
| Log and metric shipping | **Settings → Logs & Metrics** | Send logs and metrics to Datadog, Grafana Loki, Elasticsearch and others. |

## Servers and the host

[Servers and scaling](09-servers.md)

| Feature | Where | What it does and how to use it |
|---|---|---|
| Remote servers | **Settings → Remote Servers** | Add more machines over SSH; LaunchForge installs what they need. Choose per service where it runs. |
| Build servers | **Settings → Remote Servers**, type *Build* | Run builds away from production apps. |
| SSH keys | **Settings → SSH Keys** | Keys for remote servers and private Git repositories, stored encrypted. |
| Registries | **Settings → Registry** | Private image registries for pulling images, sharing builds across nodes and rollbacks. |
| S3 destinations | **Settings → S3 Destinations** | Storage for database and volume backups. |
| Secrets | **Settings → Secrets** | Connect an external secret store and reference its values in environment variables. |
| Swarm nodes | **Docker → Swarm** (platform workspace) | Add workers and managers to scale out. |
| Traefik | **Traefik File System**, **Settings → Web Server** | Edit Traefik's configuration, middleware and ports; update its version. Platform workspace only. |
| Docker housekeeping | **Settings → Web Server**, **Docker** | Prune images, volumes, containers and build cache, on a schedule or now. Platform workspace only. |
| Networks | Service **Advanced → Networks** | Create extra overlay networks inside your workspace and attach services to them, for example to keep a database reachable from one app only. Every workspace already has its own private network. |

## Automation

[API and automation](11-api.md)

| Feature | Where | What it does and how to use it |
|---|---|---|
| REST API | `https://<dashboard>/swagger` | Every dashboard action, documented with OpenAPI. Authenticate with an API key in the `x-api-key` header. |
| Deploy webhooks | Application **Deployments** | Trigger a deployment from any CI pipeline with one HTTP request. |
| Git webhooks | Automatic | GitHub, GitLab, Gitea and Bitbucket pushes, verified by signature. |

## Settings for operators

All are environment variables of the dashboard service; set them with `sudo docker service update --env-add NAME=value dokploy`. The complete table is in the [Installation guide](../09-release/INSTALLATION_GUIDE.md#configuration).

| Variable | Default | Purpose |
|---|---|---|
| `ALLOW_PUBLIC_SIGNUP` | off | `true` lets anyone register and get a workspace |
| `SIGNUP_QUOTA_MEMORY_MB`, `_CPU`, `_APPLICATIONS`, `_DATABASES`, `_DOMAINS` | 1024, 1, 3, 2, 5 | Quota of a workspace created by sign-up |
| `DEFAULT_SERVICE_MEMORY_MB`, `DEFAULT_SERVICE_CPU` | 512, 0.5 | Limits for services that set none |
| `WORKLOAD_POLICY` | strict | `permissive` allows host mounts and privileged containers (single-owner servers only) |
| `WORKSPACE_NETWORK_ISOLATION` | true | `false` puts every service on one shared network |
| `BUILD_TIMEOUT_SECONDS` | 3600 | Longest a build may run; `0` turns the limit off |
| `DEPLOY_HEALTH_TIMEOUT_SECONDS` | 120 | How long a rollout waits for the new version to become healthy |
| `CONTAINER_PIDS_LIMIT` | 4096 | Process limit per container; `0` turns it off |
| `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_ADDRESS` | none | Email for password resets |
