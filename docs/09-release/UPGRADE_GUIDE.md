# Upgrade Guide

```bash
curl -fsSL https://raw.githubusercontent.com/Aayushajs/LaunchForge-OS/main/scripts/install.sh -o install.sh
sudo bash install.sh upgrade --version <tag>
```

The upgrade:

1. Pulls the new image.
2. **Backs up the database** to `/etc/dokploy/backups/pre-upgrade-<UTC timestamp>.sql.gz` and refuses to continue if the backup is empty.
3. Updates the dashboard service (database migrations run automatically on start).
4. Waits for `/api/health`. If the new version does not become healthy, it **rolls the service back** to the previous image and exits with an error. The data is untouched.

## Version tags

| Tag | Built from |
|---|---|
| `X.Y.Z`, `X.Y`, `latest` | Release tags `vX.Y.Z` |
| `edge` | Every push to `main` |

## Rolling back manually

```bash
docker service rollback dokploy
```

If a migration must be undone, restore the pre-upgrade backup (see [BACKUP_RESTORE.md](BACKUP_RESTORE.md)) and pin the previous version with `--version`.
