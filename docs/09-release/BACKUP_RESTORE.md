# Backup & Restore

## What to back up

| Data | Where | How |
|---|---|---|
| Platform database (projects, services, users, encrypted secrets) | `dokploy-postgres` volume | Settings → Web Server → backups, or `pg_dump` below |
| Docker secrets (DB password, auth secret, **encryption key**) | Docker Swarm | Store the encryption key export somewhere safe (see below) |
| Traefik certificates and config | `/etc/dokploy/traefik` | File-level backup |
| Application databases | Their volumes | Per-database scheduled backups to S3-compatible storage (in the dashboard) |
| Application volumes | Docker volumes | Volume backups (in the dashboard) |

Secrets such as database passwords, SSH keys and Git tokens are encrypted with the encryption key. **A database backup restored without the same key cannot decrypt them.** The dashboard's web-server backup can include the derived key; keep that backup private.

## Manual database backup

```bash
CONTAINER=$(docker ps -q -f name=dokploy-postgres. | head -1)
docker exec "$CONTAINER" pg_dump -U dokploy dokploy | gzip > launchforge-$(date -u +%F).sql.gz
```

## Restore the platform database

```bash
docker service scale dokploy=0
CONTAINER=$(docker ps -q -f name=dokploy-postgres. | head -1)
docker exec "$CONTAINER" psql -U dokploy -d postgres -c 'DROP DATABASE dokploy;' -c 'CREATE DATABASE dokploy;'
gunzip -c backup.sql.gz | docker exec -i "$CONTAINER" psql -U dokploy dokploy
docker service scale dokploy=1
```

Restore onto a new server: install LaunchForge, then recreate the `launchforge_encryption_key` secret with the original value before restoring the database (`docker secret rm` / `docker secret create` while the dashboard is scaled to 0).

## Verify a restore

1. `sudo bash install.sh status` reports healthy.
2. Log in; open a database service and reveal its password – it must show the real value, not an `enc:v1:` string.
3. Trigger a deployment of a small service.
