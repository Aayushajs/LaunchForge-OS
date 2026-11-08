# Installation Guide

## Requirements

| | Minimum | Recommended |
|---|---|---|
| OS | Ubuntu 22.04 / 24.04, Debian 12 (x86_64 or arm64) | Ubuntu 24.04 |
| Memory | 2 GB | 4 GB+ |
| Disk | 20 GB free under `/var/lib` | 40 GB+ |
| Ports | 80, 443 (Traefik), 3000 (dashboard) free | |
| Access | root (or sudo) | |

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/Aayushajs/LaunchForge-OS/main/scripts/install.sh | sudo bash
```

What the installer does, in order (every step is skipped if already done, so re-running is safe):

1. **Preflight** – Linux, CPU architecture, not inside a container, RAM, free disk, ports 80/443/3000.
2. **Docker** – installs it with the official convenience script if it is missing.
3. **Swarm** – `docker swarm init`, advertising the server's primary IPv4 (override with `--advertise-addr`).
4. **Network** – the attachable overlay network all services join.
5. **Secrets** – three random 256-bit values stored as Docker secrets: the Postgres password, the session-signing secret and the encryption key for secrets at rest. Nothing is written to disk in plain text and no default password exists.
6. **PostgreSQL 16** – Swarm service with a named volume.
7. **Image** – pulls `ghcr.io/aayushajs/launchforge:<version>` (falls back to `edge` until the first release).
8. **Bootstrap** – runs `dist/bootstrap.mjs` from the image to write Traefik's configuration and start Traefik.
9. **Dashboard** – Swarm service with the secrets mounted; port 3000 published.
10. **Health check** – waits up to 5 minutes for `/api/health`.

Then open `http://<server-ip>:3000` and create the owner account. The first account becomes the **platform operator** (it can set quotas for every workspace).

### Options

| Flag | Default | Purpose |
|---|---|---|
| `--version <tag>` | `latest` | Image tag (`edge` = latest `main` build) |
| `--image <repo>` | `ghcr.io/aayushajs/launchforge` | Use another registry or a locally built image |
| `--advertise-addr <ip>` | auto | Address Docker Swarm advertises |
| `--port <port>` | `3000` | Dashboard port |
| `--yes` | | Non-interactive |

### HTTPS for the dashboard

Point a DNS record (e.g. `deploy.example.com`) at the server, then set it under **Settings → Web Server → Domain** with a Let's Encrypt email. Traefik obtains the certificate automatically.

## Configuration

Settings are environment variables on the dashboard service:

```bash
docker service update --env-add BUILD_TIMEOUT_SECONDS=1800 dokploy
```

| Variable | Default | Effect |
|---|---|---|
| `WORKLOAD_POLICY` | `strict` | `permissive` disables the mount/compose policy (single-owner installs only) |
| `WORKSPACE_NETWORK_ISOLATION` | `true` | `false` puts every service back on the shared `dokploy-network` (single-owner installs only) |
| `BIND_MOUNT_ALLOWED_ROOTS` | unset | Comma-separated directories bind mounts must live under |
| `ALLOW_COMPOSE_TRAEFIK_LABELS` | `false` | Allow raw `traefik.*` labels in compose files |
| `CONTAINER_PIDS_LIMIT` | `4096` | Max processes per container (`0` = unlimited) |
| `BUILD_TIMEOUT_SECONDS` | `3600` | Max build duration (`0` = unlimited) |
| `DEPLOY_HEALTH_TIMEOUT_SECONDS` | `120` | How long a new version may take to become running/healthy |
| `DEFAULT_SERVICE_MEMORY_MB` | `512` | Memory limit applied to services without one, in workspaces that have a quota |
| `DEFAULT_SERVICE_CPU` | `0.5` | CPU limit applied likewise |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | unset | GitHub sign-in (cloud mode) |
| `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_ADDRESS` | unset | Password-reset and invitation emails |
| `TRAEFIK_VERSION` | `3.7.16` | Traefik image version |

## Uninstall

```bash
sudo bash install.sh uninstall           # removes services and secrets, keeps data
sudo bash install.sh uninstall --purge   # also deletes the database volume and /etc/dokploy
```
