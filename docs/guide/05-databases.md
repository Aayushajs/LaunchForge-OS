# 5. Databases and backups

## Create a database

Inside an environment, create a **Database** and pick an engine:

| Engine | Default image | Internal port |
|---|---|---|
| PostgreSQL | `postgres` | 5432 |
| MySQL | `mysql` | 3306 |
| MariaDB | `mariadb` | 3306 |
| MongoDB | `mongo` | 27017 |
| Redis | `redis` | 6379 |
| libSQL (Turso) | `ghcr.io/tursodatabase/libsql-server` | 8080 |

Choose a strong password (or generate one); it is stored encrypted. Data lives in a named Docker volume.

## Connect from an application

Services in the same installation reach each other over the internal network by the database's **app name** (shown on the database's General tab):

```text
postgres://app_user:<password>@postgres-crimson-river-a1b2c3:5432/app_db
```

Copy the **Internal connection URL** into the application's environment, e.g. `DATABASE_URL=...`.

## Connect from your laptop

Set an **External port** on the database's General tab. It is published on the server; restrict it with your firewall. Remove it again when you are done.

## Backups

1. **Settings → S3 Destinations → Add**: any S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, MinIO, …). Keys are stored encrypted.
2. Database → **Backups → Create Backup**: destination, cron schedule (e.g. `0 3 * * *`), how many to keep.
3. Use **Run now** once to confirm a file appears in the bucket.

Backups are `pg_dump`/`mysqldump`/`mongodump` streams, gzip-compressed, uploaded with rclone. Redis is covered by volume backups.

## Restore

Database → **Backups → Restore**: pick the destination and file; progress streams live. Restore into a fresh database first if you want to inspect the data before overwriting production.

## Volume backups

Application or database → **Volume Backups**: archives a named volume to S3 on a schedule, optionally stopping the service during the copy for consistency.

## Resources and quotas

Set CPU/memory limits under **Advanced**. In a workspace with a quota, a database without limits runs with the default limits and counts toward the workspace's memory and CPU. Creating a database fails if the workspace's database count limit is reached.
