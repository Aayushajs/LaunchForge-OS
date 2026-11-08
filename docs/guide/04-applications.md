# 4. Applications

An application is one container built from source or pulled as an image.

## Sources

| Provider | Use when |
|---|---|
| GitHub / GitLab / Gitea / Bitbucket | Repository on a connected Git provider; enables auto-deploy and (GitHub) preview deployments |
| Git | Any Git URL; private repositories over SSH with a deploy key from **Settings → SSH Keys** |
| Docker | A prebuilt image (`nginx:1.27`, `ghcr.io/you/api:1.4`), optionally from a private registry |
| Drop | Upload a zip of the source |

## Build types by language

| Stack | Recommended build type | Notes |
|---|---|---|
| Node.js / Express / NestJS | Nixpacks | Uses the `start` script; set `PORT` if your app reads it |
| Next.js | Nixpacks | `next build` + `next start`, port 3000 |
| React / Vite / Angular SPA | Nixpacks + **Publish Directory** (`dist`/`build`) | Served by nginx; enable the SPA option for client-side routing |
| Python (Django, Flask, FastAPI) | Nixpacks or Railpack | Detects `requirements.txt`/`pyproject.toml`; set the start command if needed (`gunicorn app:app -b 0.0.0.0:8000`) |
| PHP / Laravel | Nixpacks | |
| Go | Nixpacks or Dockerfile | |
| Java / Spring Boot | Nixpacks (Maven/Gradle) or Paketo buildpacks | |
| Ruby, Rust, Elixir, .NET | Nixpacks / Railpack / Heroku buildpacks | |
| Anything else | Dockerfile | Supports build path, target stage, build args and BuildKit secrets |
| Plain HTML | Static | |

Builds stop after `BUILD_TIMEOUT_SECONDS` (default one hour).

## Configuration

- **Environment** — runtime variables (`KEY=value` per line). Project- and environment-level variables can be referenced, so shared settings live in one place. All values are encrypted at rest.
- **Build args / build secrets** — for Dockerfile builds; secrets are passed with BuildKit and never stored in the image.
- **Resources** (**Advanced**) — CPU and memory limits and reservations. In a workspace with a quota, services without limits run with the default limits and count against the quota.
- **Replicas** — run several copies behind the same domain.
- **Ports** — publish extra ports (TCP/UDP) on the server.
- **Volumes** — persistent named volumes; bind mounts are allowed only outside system directories (see [Compose → workload policy](07-compose.md#workload-policy)).
- **Command / args** — override the container's start command.

## Health checks and zero-downtime releases

Every release starts the new version before stopping the old one. A deployment is reported **done** only when the new version is running; with a health check (**Advanced → Swarm Settings → Health Check**) it must also pass the check. If the container crashes repeatedly, fails its check, or does not become healthy within `DEPLOY_HEALTH_TIMEOUT_SECONDS` (default 120 s), the deployment fails and the previous version keeps serving.

## Deployments, logs and terminal

- **Deployments** tab — every build with its full log, duration and status; **Cancel** stops only this service's build.
- **Logs** tab — live container logs with search and line limits.
- **Terminal** — a shell inside the running container (if your role allows it).
- Deployments queued while the dashboard restarts are resumed automatically.

## Rollbacks

**Advanced → Rollback Settings**: choose a registry; every deployment then pushes a tagged image. **Deployments → Rollback** redeploys any earlier version with the configuration it had at that time. Secrets in rollback snapshots are encrypted.

## Preview deployments (GitHub)

**Preview Deployments** tab: each pull request gets its own container and URL, with its own env vars, and a comment on the PR. Limit the number of concurrent previews, and require that the PR author has write access to the repository.

## Patches

**Patches** tab: apply file changes on top of the cloned repository at build time (for example, a config file you do not want in Git).

## Schedules

**Schedules** tab: run a command inside the container on a cron schedule (database cleanup, cache warm-up, …).
