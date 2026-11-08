# 9. Servers and scaling

## The local server

The machine LaunchForge is installed on runs services by default ("LaunchForge server" in service forms).

## Remote servers

**Settings → Remote Servers → Create**:

1. Create or import an SSH key under **Settings → SSH Keys** and add its public key to the server's `~/.ssh/authorized_keys`.
2. Enter the server's IP, port and user (root, or a user with passwordless sudo).
3. **Setup Server** installs Docker, initializes Swarm, creates the network, starts Traefik and installs the builders. **Validate** checks each piece.

Pick the server when creating a service. Each remote server has its own Traefik, so point the service's domains at that server's IP.

| Server type | Purpose |
|---|---|
| Deploy | Runs services |
| Build | Only builds images; the deploy server pulls them from a registry. Keeps heavy builds off production machines. |

Per server: **build concurrency** (how many builds run in parallel), Docker cleanup, monitoring agent, security tools (fail2ban, SSH hardening, active sessions).

A server whose SSH key is deleted becomes unusable until a key is added again; LaunchForge never falls back to running its commands on the dashboard's own host.

## Swarm cluster

**Settings → Remote Servers → Cluster** (Swarm): add worker or manager nodes to a server's Swarm, then use **Advanced → Swarm Settings → Placement** and **Replicas** to spread a service across nodes.

## Scaling an application

| Need | Do |
|---|---|
| More throughput | Increase replicas (requests are load-balanced across them) |
| More memory/CPU | Raise the service's limits (within the workspace quota) |
| Separate noisy workloads | Move them to another remote server |
| Faster builds | Add a build server; raise build concurrency |

## Limits

The deployment queue runs in the dashboard process, so the dashboard itself runs as a single instance; workloads scale across servers and nodes.
