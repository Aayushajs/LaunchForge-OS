# Implementation Progress

Workstreams from [GAP_ANALYSIS.md](../01-discovery/GAP_ANALYSIS.md). Updated 2026-11-07.

| # | Workstream | Status | Delivered | Remaining |
|---|---|---|---|---|
| A1 | Repository foundation | Done | Own repo and history, LaunchForge branding (UI, emails, logo, social image), Apache-2.0 `LICENSE` + `NOTICE`, CI (build/test/typecheck/Go), GHCR multi-arch release with no secrets | Rename internal `dokploy` identifiers (package scope, network, paths) |
| A2 | Remove source-available code | Done | `/proprietary` deleted; own audit log, custom roles, social sign-in; CI guard test | SSO/SCIM if ever needed |
| A3 | Authorization fixes | Done | Reference ownership, move/update/duplicate checks, domain target checks, metrics SSRF, API keys of removed members | Template `baseUrl` and custom-webhook SSRF; impersonation consent (cloud mode) |
| A4 | Workload isolation | Partial | Mount and compose policy, PIDs limit, build timeout, scoped build cancel, remote Docker fails closed | Per-workspace overlay networks, build sandbox / CPU limit, Swarm JSON (placement/networks) validation, cluster router local actions, SSH host keys |
| A5 | Quotas and metering | Done | `workspace_quota`, deploy-time CPU/memory enforcement with defaults, count limits, per-minute metering, Usage & Quotas UI | Compose container limits, network/disk metering |
| A6 | Deployment reliability | Mostly done | Health-gated rollout, durable queue, signed webhooks, temp SSH keys | Registry-free rollback, first-class health-check settings in the UI |
| A7 | Domains and TLS | Partial | Cross-workspace host ownership | DNS TXT verification, platform wildcard domain, DNS-01 wildcard certificates |
| A8 | Secrets | Done | Encrypted credential columns, sealed rollback snapshots, crypto passwords | Notification tokens, vault/DNS provider configs |
| A9 | Installer and operations | Done | `scripts/install.sh` (install/upgrade with backup + rollback/uninstall/status), bootstrap entrypoint, CI end-to-end on Ubuntu 22.04/24.04, release docs | Debian 12 in CI |
| A10 | Observability | Partial | Per-workspace usage; SSRF-free metrics | Platform health page, Prometheus endpoint |
| A11 | Quality and proof | Partial | Tests for every new module; k6 scenarios + weekly load-test workflow; design docs (HLD, LLD, ERD, API, threat model, ADRs) | Sample app per language in CI |

## Commits

| Commit | Workstream |
|---|---|
| LaunchForge OS: self-hosted PaaS foundation | A1, A2 |
| Fix release manifest digest mix-up and update actions | A1 |
| Close cross-organization authorization gaps (A3) | A3 |
| Encrypt stored secrets at rest (A8) | A8 |
| Make deployments reliable and webhooks verifiable (A6) | A6 |
| Stop cross-workspace domain hijacking (A7) | A7 |
| Enforce a workload isolation policy (A4) | A4 |
| Add workspace quotas and usage metering (A5) | A5 |
| Add a one-command installer with safe upgrades (A9) | A9 |
| Add k6 load tests and a load-test workflow | A11 |
