# 12. Troubleshooting and FAQ

## Error messages

| Message | Meaning | Fix |
|---|---|---|
| `Deployment failed: the new version was not running and healthy after 120s` | The container never started or its health check never passed | Read the Logs tab; check the port and start command; raise `DEPLOY_HEALTH_TIMEOUT_SECONDS` for slow apps |
| `Deployment failed: the new version failed and Swarm rolled back …` | The release started but failed; the previous version is still live | Fix and redeploy |
| `Deployment failed: the container keeps crashing: …` | Exit on start three times | The error after the colon is the container's exit reason |
| `Build timed out after 3600s` | Build exceeded `BUILD_TIMEOUT_SECONDS` | Cache dependencies, use a build server, or raise the limit |
| `Compose file rejected by the workload policy: …` | A forbidden setting (see the list) | [Compose → workload policy](07-compose.md#workload-policy) |
| `Bind mount rejected: mounting /etc from the host is not allowed` | System path in a volume | Use a named volume |
| `Memory quota exceeded: this service needs 512 MB but only 256 MB … is left` | Workspace quota reached | Lower limits, remove services, or ask the operator |
| `This workspace can have at most N applications` | Count quota | Same |
| `example.com is already in use by another workspace` | Another workspace routes this host | Use another host or have them remove it |
| `example.com/api is already routed to another service` | Same host+path used twice in your workspace | Change the path or remove the old domain |
| `You are not authorized to use this Git provider` (or server, registry, SSH key) | The resource belongs to another workspace, or is private to another member | Use your own; ask the owner to share it with the workspace |
| `Invalid webhook signature` (401) | The Git host's secret is not the webhook token | Set the secret to the token from the URL, or remove it |
| `Server … has no SSH key` | The server's key was deleted | Add a key under Settings → SSH Keys and select it on the server |

## FAQ

**Is my data encrypted?** Secrets (env vars, database passwords, SSH keys, Git tokens, registry and S3 keys, certificate keys) are encrypted at rest with AES-256-GCM. Keep the encryption key (a Docker secret created by the installer) with your backups.

**Can two teams share one server safely?** Yes for routine use: workspaces cannot see each other's resources, steal domains, mount the host or exceed their quotas. Still treat workspace admins as trusted until per-workspace networks and SSH host-key checks ship ([threat model](../06-security/THREAT_MODEL.md)).

**Does a restart lose deployments?** No. Queued deployments are stored in the database and resumed; a build that was running is restarted.

**How do I update LaunchForge?** `sudo bash install.sh upgrade` — it backs up the database first and rolls back if the new version is unhealthy.

**Where are the files?** Configuration and build logs in `/etc/dokploy`; data in Docker volumes.
