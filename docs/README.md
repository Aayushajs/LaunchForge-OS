# LaunchForge Documentation

LaunchForge is a self-hosted Platform-as-a-Service. You give it a server and a Git repository; it builds the code into a container, runs it behind HTTPS on your domain, and gives you logs, metrics, databases, backups, rollbacks and team access from one dashboard. Several teams ("workspaces") can share one installation without being able to see or affect each other.

## Pick a reading path

### I want to use LaunchForge

| # | Chapter | You will learn |
|---|---|---|
| 1 | [Concepts](guide/01-concepts.md) | What every word in the dashboard means and how the pieces fit |
| 2 | [Quickstart](guide/02-quickstart.md) | Install on a server and deploy a first app in about 15 minutes |
| 3 | [Tutorial: deploy your portfolio](guide/03-tutorial-portfolio.md) | Git push → live site on your domain with HTTPS and auto-deploy |
| 4 | [Applications](guide/04-applications.md) | Build types per language, env vars, health checks, scaling, logs, rollbacks, previews |
| 5 | [Databases and backups](guide/05-databases.md) | PostgreSQL, MySQL, MariaDB, MongoDB, Redis, libSQL; connecting; backups and restore |
| 6 | [Domains and HTTPS](guide/06-domains.md) | Custom domains, certificates, paths, redirects, ownership rules |
| 7 | [Docker Compose and templates](guide/07-compose.md) | Multi-container apps, one-click templates, the workload policy |
| 8 | [Teams, roles and audit](guide/08-teams-and-access.md) | Workspaces, invitations, roles, custom roles, API keys, audit log |
| 9 | [Servers and scaling](guide/09-servers.md) | Remote servers, build servers, Swarm nodes, replicas |
| 10 | [Monitoring, alerts and usage](guide/10-monitoring.md) | Metrics, logs, notifications, usage and quotas |
| 11 | [API and automation](guide/11-api.md) | API keys, REST/tRPC, webhooks, CI/CD recipes |
| 12 | [Troubleshooting and FAQ](guide/12-troubleshooting.md) | Every error message and what to do |
| 13 | [Run it for free](guide/13-free-hosting.md) | Oracle Cloud Always Free step by step, free domains and HTTPS, small machines |
| 14 | [Run a public platform](guide/14-public-platform.md) | Open sign-ups like Heroku or Render: wildcard domains, quotas, email, security checklist |
| 15 | [Feature reference](guide/15-feature-reference.md) | Every feature, where it is and how to use it, plus all operator settings |

Operating an installation: [Installation](09-release/INSTALLATION_GUIDE.md) · [Upgrades](09-release/UPGRADE_GUIDE.md) · [Backup & restore](09-release/BACKUP_RESTORE.md) · [Runbook](09-release/OPERATIONS_RUNBOOK.md)

### I want to understand the engineering

| Document | Contents |
|---|---|
| [Engineering case study](engineering/CASE_STUDY.md) | The problem, the constraints, the design, what was hard, results and lessons — start here |
| [System architecture](02-architecture/SYSTEM_ARCHITECTURE.md) | Components, data flow, trust boundaries |
| [Architecture decisions](02-architecture/ARCHITECTURE_DECISIONS.md) | 12 ADRs with alternatives |
| [HLD](03-design/HLD.md) · [LLD](03-design/LLD.md) | Design at both levels, with algorithms and sequence diagrams |
| [Data model](04-database/ER_DIAGRAM.md) | ER diagram, new tables, encrypted columns |
| [API reference](05-api/API_DOCUMENTATION.md) | Procedures, errors, webhooks |
| [Threat model](06-security/THREAT_MODEL.md) · [Security decisions](06-security/SECURITY_DECISIONS.md) · [RBAC](06-security/RBAC_MATRIX.md) | Security design and proof |
| [Performance](07-performance/LOAD_TEST_PLAN.md) | Load-test plan, targets, reports |
| [Discovery](01-discovery/REPO_AUDIT.md) | The audit that started the project |
| [Roadmap](engineering/ROADMAP.md) | What is missing and where it goes next |

### I want to contribute

[CONTRIBUTING.md](../CONTRIBUTING.md) · [Progress](08-implementation/PROGRESS.md) · [Roadmap](engineering/ROADMAP.md)
