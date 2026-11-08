# 10. Monitoring, alerts and usage

## Metrics

- **Monitoring** (sidebar): CPU, memory, disk and network of the server over time, from the LaunchForge metrics agent. Configure retention and alert thresholds under **Settings → Web Server → Monitoring** (local) or per remote server.
- Service → **Monitoring** tab: CPU, memory and network of that service's containers.

Metrics are always fetched by the dashboard from the agent's configured address with its token; the browser never supplies the URL.

## Logs

- Service → **Logs**: live container logs.
- Service → **Deployments**: build logs per deployment.
- **Settings → Logs & Metrics**: ship logs and metrics to Datadog, Grafana Loki, Elasticsearch, Better Stack, New Relic, Splunk, CloudWatch, InfluxDB or any Prometheus remote-write endpoint.

## Notifications

**Settings → Notifications → Add**: Slack, Discord, Telegram, Microsoft Teams, Mattermost, Lark, Gotify, ntfy, Pushover, email (SMTP or Resend) or a custom webhook. Choose events: deploy succeeded, build failed, database backup, volume backup, Docker cleanup, server restart, CPU/memory threshold.

## Usage & Quotas

**Settings → Usage & Quotas** shows, for the current workspace:

- **Reserved** memory and CPU (sum of the services' limits, counting services without limits at the default) against the quota.
- Number of applications and databases against the quota.
- **Hourly usage** for the last 24 hours: average CPU, average and peak memory, number of containers — sampled every minute from the running containers and kept for 90 days.

### For the platform operator

The same page lists **all workspaces** with an editor for each one's limits:

| Limit | Enforced when |
|---|---|
| Memory (MB), CPU | Every deployment of an application or database; services without limits get `DEFAULT_SERVICE_MEMORY_MB` (512) / `DEFAULT_SERVICE_CPU` (0.5) |
| Applications (incl. compose) | Creating one |
| Databases | Creating one |
| Domains | Adding one |

Leave a field empty for no limit. Quota changes are recorded in the audit log.
