# 7. Docker Compose and templates

## Compose services

Create a **Compose** service when an app needs several containers (web + worker + cache). Source: Git repository (with the path to the compose file) or a compose file pasted in the dashboard (**Raw**).

- **Type**: `docker-compose` (plain containers) or `stack` (Swarm stack with `deploy:` options).
- **Domains** work per compose service: pick the service name and its port; LaunchForge adds the routing labels.
- **Isolated deployment** puts the stack on its own network and namespaces its volumes.
- Environment variables are written to a `.env` next to the compose file.

## Workload policy

Before a compose stack is deployed, LaunchForge checks it. A deployment is rejected, with every violation listed in the log, if any service uses:

| Not allowed | Why | Use instead |
|---|---|---|
| `privileged: true` | Full access to the host | Specific, harmless capabilities |
| `network_mode`, `pid`, `ipc`, `uts`, `userns_mode`, `cgroup` = `host` or `container:…` | Escapes container isolation or joins another workspace's containers | The default network; `service:<name>` |
| `cap_add` of `SYS_ADMIN`, `NET_ADMIN`, `SYS_PTRACE`, `SYS_MODULE`, `ALL`, … | Each is close to root on the host | `NET_BIND_SERVICE` and other low-risk capabilities are fine |
| `devices` | Direct hardware access | – |
| `security_opt` with `unconfined` or `label:disable` | Disables kernel protections | – |
| Bind mounts of `/`, `/etc`, `/proc`, `/root`, `/var/lib/docker`, any `docker.sock`, … | Host takeover | Named volumes, or paths under the operator's allowed roots |
| `~/…` bind mounts or `../` outside the project | Reads files outside the project | Paths inside the repository |
| `include:` or `extends: { file: … }` | Pulls in files that are not checked | Put all services in one file |
| Raw `traefik.*` routing labels | Could claim another workspace's hostname | Add a domain in the dashboard |

The same bind-mount rules apply to application volumes. Operators of single-owner installations who trust every user can turn the policy off with `WORKLOAD_POLICY=permissive`, or allow raw Traefik labels with `ALLOW_COMPOSE_TRAEFIK_LABELS=true`.

## Templates

**Create from Template** offers one-click stacks (databases, CMSs, analytics, monitoring, …) from the template catalog. Templates are compose stacks, so the workload policy applies to them too.

## AI-assisted setup

**Settings → AI**: connect an LLM provider (OpenAI, Anthropic, Azure, Mistral, Cohere, DeepInfra, Ollama, any OpenAI-compatible endpoint) to generate a compose stack from a description.
