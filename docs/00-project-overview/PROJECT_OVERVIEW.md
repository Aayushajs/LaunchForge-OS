# LaunchForge OS — Project Overview

> Status: Phase 1 (Discovery) · Baseline: Dokploy `canary` @ `d73650694` (app version `v0.31.0`) · Last updated: 2026-11-07

## What LaunchForge is

LaunchForge OS is a self-hostable, Render-style Platform-as-a-Service: connect a Git repository, push, and the platform builds the code into a container, runs it with a domain and HTTPS, and gives you logs, metrics, databases, backups and rollbacks from one dashboard.

LaunchForge is **an evolution of [Dokploy](https://github.com/Dokploy/dokploy), not a greenfield project.** Dokploy already provides a mature deployment engine (Git providers, six build systems, Docker Swarm runtime, Traefik routing, managed databases, backups, monitoring). LaunchForge keeps that engine and invests engineering effort where Dokploy is thin: safe multi-tenancy on shared hosts, resource quotas and metering, deployment reliability, an opinionated installer, and a hardened security posture.

## Goals

| # | Goal | Measured by |
|---|---|---|
| G1 | Install on any fresh Linux server with one command and be production-usable in minutes | Installer passes on Ubuntu 22.04/24.04 and Debian 12 in CI; time-to-first-deploy |
| G2 | Host the author's own portfolio and projects as the first real workloads | Portfolio live via Git push → auto-deploy, custom domain, HTTPS |
| G3 | Reliable deployments | Health-gated deploys, zero-downtime updates, verified one-click rollback |
| G4 | Safe multi-tenancy on a shared host | Cross-tenant authorization test suite; container hardening; enforced quotas |
| G5 | Observable and measurable | Per-workspace usage metrics; published k6 load-test reports with real numbers |
| G6 | Well-documented engineering | Architecture diagrams, HLD/LLD, ERD, OpenAPI, threat model, ADRs |

## Delivery phases (decided 2026-11-07)

**Phase A — Self-hosted platform (primary).**
LaunchForge as software anyone installs on their own server. Covers G1–G6. Billing is out of scope. This keeps LaunchForge within Dokploy's terms, which allow installing, modifying and operating it for personal and business use (see [LICENSE_AUDIT.md](../01-discovery/LICENSE_AUDIT.md)).

**Phase B — Hosted SaaS capabilities (optional, later).**
Public signup, plans, usage-based billing, platform admin console. Built as an optional module **only after** the licensing questions in the license audit are resolved, because Dokploy's terms forbid commercial resale of Dokploy as a service without explicit consent.

## Original requirements → where they stand

| # | Requirement | Dokploy baseline | LaunchForge work |
|---|---|---|---|
| 1 | GitHub/GitLab integration, deploy on push | Implemented (GitHub App, GitLab/Gitea OAuth, Bitbucket, raw Git) | Webhook signature verification for all providers; secret encryption |
| 2 | Multi-language support | Implemented via Nixpacks, Railpack, Heroku/Paketo buildpacks, Dockerfile, static | Verified runtime matrix + sample apps per language |
| 3 | Isolated Docker builds/runtime | Docker Swarm services; no hardening | Container hardening, build isolation, policy on mounts/compose |
| 4 | Database hosting | Postgres, MySQL, MariaDB, MongoDB, Redis, libSQL | Encrypted credentials, quotas, safer port exposure |
| 5 | Domains & SSL | Traefik + Let's Encrypt (HTTP-01) | Domain ownership verification, host uniqueness, platform subdomains |
| 6 | Monitoring | Go agent (host + container metrics in SQLite), live logs | Per-workspace usage, retention, SSRF fixes |
| 7 | Rollback, zero-downtime, health checks | Partial (start-first updates; registry-based rollback; health checks only if user configures) | Health-gated deploys, default health checks, local rollback |
| 8 | Teams, roles, permissions, API keys | Implemented (Better Auth orgs, owner/admin/member, API keys) | Fix cross-tenant holes; replace license-gated custom roles/audit log |
| 9 | Professional dashboard | Implemented (Next.js) | LaunchForge branding + UX polish (decision pending) |

## Constraints

- **No production server yet.** Development happens on Windows with Docker Desktop/WSL2; the installer targets Linux VPS/bare metal later.
- **Reuse over rewrite.** Existing, working Dokploy code is kept unless it is a security or licensing problem.
- **No fabricated results.** Performance and reliability numbers come only from tests actually run.
- **Gated process.** Each phase (G0–G10) ends with a report and waits for explicit approval.

## Technology baseline (inherited)

TypeScript monorepo (pnpm workspaces, Node 24) · Next.js 16 + React 19 + tRPC 11 + Tailwind 4/shadcn · Zod 4 · PostgreSQL 16 + Drizzle ORM · Better Auth · Dockerode + Docker Swarm · Traefik v3 · Go (Fiber + SQLite) monitoring agent · Vitest · Biome.

## Open decisions

1. **Dashboard strategy:** rebrand and extend the existing Dokploy dashboard, or build a new customer-facing frontend on the existing API? (Recommendation in [GAP_ANALYSIS.md](../01-discovery/GAP_ANALYSIS.md).)
2. **Proprietary code:** remove and replace the `/proprietary` modules with LaunchForge-owned Apache-2.0 implementations (recommended), or keep them inert.
3. **Repository hygiene:** the working tree contains an accidental nested clone at `./LaunchForge/` that should be deleted before the first LaunchForge commit.

## Discovery documents

- [REPO_AUDIT.md](../01-discovery/REPO_AUDIT.md) — architecture and module-by-module audit with file paths
- [EXISTING_FEATURES.md](../01-discovery/EXISTING_FEATURES.md) — feature inventory with status
- [GAP_ANALYSIS.md](../01-discovery/GAP_ANALYSIS.md) — what to reuse, change and build, prioritised
- [DEPENDENCY_MAP.md](../01-discovery/DEPENDENCY_MAP.md) — packages, services and runtime dependencies
- [LICENSE_AUDIT.md](../01-discovery/LICENSE_AUDIT.md) — licensing boundaries and risks

## Design and operations documents

- Architecture: [SYSTEM_ARCHITECTURE.md](../02-architecture/SYSTEM_ARCHITECTURE.md), [ARCHITECTURE_DECISIONS.md](../02-architecture/ARCHITECTURE_DECISIONS.md)
- Design: [HLD.md](../03-design/HLD.md), [LLD.md](../03-design/LLD.md)
- Database: [ER_DIAGRAM.md](../04-database/ER_DIAGRAM.md)
- API: [API_DOCUMENTATION.md](../05-api/API_DOCUMENTATION.md)
- Security: [THREAT_MODEL.md](../06-security/THREAT_MODEL.md), [SECURITY_DECISIONS.md](../06-security/SECURITY_DECISIONS.md), [RBAC_MATRIX.md](../06-security/RBAC_MATRIX.md)
- Performance: [LOAD_TEST_PLAN.md](../07-performance/LOAD_TEST_PLAN.md), [PERFORMANCE_REQUIREMENTS.md](../07-performance/PERFORMANCE_REQUIREMENTS.md)
- Progress: [PROGRESS.md](../08-implementation/PROGRESS.md)
- Release: [INSTALLATION_GUIDE.md](../09-release/INSTALLATION_GUIDE.md), [UPGRADE_GUIDE.md](../09-release/UPGRADE_GUIDE.md), [BACKUP_RESTORE.md](../09-release/BACKUP_RESTORE.md), [OPERATIONS_RUNBOOK.md](../09-release/OPERATIONS_RUNBOOK.md)
