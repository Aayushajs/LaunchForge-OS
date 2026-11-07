# Operations Runbook

## Health and logs

```bash
sudo bash install.sh status
docker service logs dokploy --tail 200 -f
docker service logs dokploy-postgres --tail 100
docker logs dokploy-traefik --tail 100
```

Deployment build logs: `/etc/dokploy/logs/<appName>/`.

## Common problems

| Symptom | Likely cause | Fix |
|---|---|---|
| Deploy fails with "Compose file rejected by the workload policy" | Compose uses privileged mode, host networking, a host bind mount, devices or raw Traefik labels | Remove the setting, use a named volume, add the hostname as a domain. Single-owner installs can set `WORKLOAD_POLICY=permissive` |
| "Bind mount rejected" | Host path is a system directory or outside `BIND_MOUNT_ALLOWED_ROOTS` | Use a named volume or a directory under an allowed root |
| "Deployment failed: the new version was not running and healthy after 120s" | App crashes on start, or its health check never passes | Check the app's logs; fix the health check; raise `DEPLOY_HEALTH_TIMEOUT_SECONDS` for slow starters |
| "Deployment failed: ... Swarm rolled back" | New version failed its health check; previous version is still serving | Fix and redeploy – there was no downtime |
| "Build timed out after …" | Build exceeded `BUILD_TIMEOUT_SECONDS` | Speed up the build or raise the limit |
| "Memory/CPU quota exceeded" | Workspace quota reached | Lower the service's limits, remove services, or (operator) raise the quota |
| "… is already in use by another workspace" | The hostname is routed by another workspace | Use another hostname, or have the other workspace remove it |
| Webhook returns 401 "Invalid webhook signature" | Provider secret differs from the service's webhook token | Set the provider's webhook secret to the token shown in the service's deploy webhook URL, or remove the secret |
| Webhook returns 405 | Request was not a POST | Configure the provider to send POST |

## Restarts and recovery

- Restarting the dashboard does not lose queued deployments: they are stored in `deployment_job` and resumed on start. A deployment that was mid-build is marked cancelled and re-run.
- `docker service update --force dokploy` restarts the dashboard.
- Traefik is a standalone container with `restart: always`; `docker restart dokploy-traefik` reloads it.

## Capacity

- Per-workspace usage is sampled every minute (Settings → Usage & Quotas) and kept for 90 days.
- The operator sets CPU/memory/service/database/domain quotas per workspace on the same page.
