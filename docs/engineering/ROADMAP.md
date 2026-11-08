# Roadmap

What is missing today, then how LaunchForge grows from "safe self-hosted PaaS" to "multi-node cloud platform". Effort: S (days), M (1–2 weeks), L (3+ weeks). Each item names the engineering skill it demonstrates.

## Now — finish hardening (missing today)

| Item | Why | Effort | Skill |
|---|---|---|---|
| Per-workspace overlay networks | Workspaces can currently reach each other's services on the shared network (threat S7) | M | Container networking, migrations of live services |
| SSH host-key pinning | Remote servers are trusted on first use without verification (S14) | S | Secure transport |
| Cluster router: require `serverId`, operator-only | Swarm join tokens of the control plane are reachable (S10 remainder) | S | AuthZ |
| SSRF guard for templates `baseUrl` and custom webhooks | Server-side fetch of caller URLs (S8 remainder) | S | Network security (private-range blocking, DNS rebinding) |
| DNS TXT domain verification + platform wildcard domain | Prevent domain squatting; `*.apps.example.com` for every service | M | DNS, ACME |
| Registry-free rollback | Keep last N images locally so rollback works without a registry | M | Image lifecycle |
| Compose resource limits under quotas | Compose containers are counted but not limited | M | Spec rewriting |
| Rename internal identifiers (`@dokploy/server`, `/etc/dokploy`, `dokploy-network`) with a migration for existing installs | Clean product identity | M | Safe large refactors, data migration |
| Debian 12 + arm64 in installer CI; first published load-test report | Proof | S | CI |

## Next — scale the platform

| Item | Design sketch | Effort | Skill |
|---|---|---|---|
| **Highly available control plane** | Replace the in-process scheduler with a Postgres job table claimed with `SELECT … FOR UPDATE SKIP LOCKED`; run 2+ dashboard replicas; leader election (advisory lock) for crons and metering | L | Distributed systems |
| **Rootless build workers** | BuildKit rootless on dedicated build nodes, build cache per workspace, CPU/memory limits per build | L | Sandboxing, supply chain |
| **Optional gVisor runtime** per workspace | `runtime: runsc` for untrusted tenants | M | Kernel isolation |
| **Autoscaling** | Scale replicas on CPU/memory/request-rate from metering data, with min/max and cooldown | M | Control loops |
| **Canary and blue-green releases** | Traefik weighted services; shift 5% → 50% → 100% gated on error rate | M | Progressive delivery |
| **Managed Postgres PITR** | WAL-G continuous archiving to S3; restore to any timestamp; read replicas | L | Databases |
| **Private networking across nodes** | Encrypted overlay per workspace spanning servers | M | Networking |
| **Infrastructure as code** | `launchforge.yaml` describing services, env, domains; `lf apply` diffs and applies (like Render Blueprints / Terraform) | L | API design, reconciliation |
| **CLI** | `lf login`, `lf deploy`, `lf logs -f`, `lf env set` on the public API | M | DX |

## Later — cloud-provider features

| Item | Notes | Effort |
|---|---|---|
| Usage-based billing (Phase B) | Stripe usage records from `workspace_usage`; plans as quotas. Requires Dokploy's consent for commercial hosting (see license audit) | L |
| Platform admin console | Workspaces, usage, suspension, abuse signals (crypto-mining heuristics from CPU patterns, egress spikes) | M |
| Multi-region | Several clusters, one control plane; geo DNS; per-region placement | L |
| Object storage service | MinIO as a managed service with per-workspace buckets and keys | M |
| Edge features | Per-service rate limiting, WAF rules, caching | M |
| Observability suite | OpenTelemetry traces, built-in Loki logs, Prometheus `/metrics` for the control plane, SLO dashboards, public status page | L |
| Supply-chain security | SBOM + vulnerability scan (Trivy) on every build, signed images (cosign), policy "no critical CVEs in production" | M |
| Secrets management | Key rotation for the encryption key; external KMS/Vault backends; secret references in env | M |
| SSO (OIDC/SAML) and SCIM | Re-implemented under Apache-2.0 | M |
| AI deploy assistant | Explain a failed deployment from its build log and container logs; suggest a fix | S |

## How to sequence it

1. Finish **Now** — it closes the open rows of the threat model; after it, workspace admins no longer need host-level trust.
2. **HA control plane** and **rootless builders** — the two changes that turn a single-server tool into a platform.
3. Pick features by audience: progressive delivery + autoscaling (reliability story), PITR + IaC (developer platform story), billing + admin (SaaS story).
