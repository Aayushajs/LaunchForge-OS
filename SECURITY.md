# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately through [GitHub Security Advisories](https://github.com/Aayushajs/LaunchForge-OS/security/advisories/new). Include:

- affected version or commit
- steps to reproduce or a proof of concept
- the impact you observed

You will get an acknowledgement within 72 hours and a status update at least weekly until the issue is resolved.

## Supported versions

Only the latest release receives security fixes.

## Known risk areas

LaunchForge runs user-supplied builds and containers. Until the workspace-isolation work on the roadmap ships, treat every user with permission to create services as trusted with the host. See [docs/01-discovery/REPO_AUDIT.md](docs/01-discovery/REPO_AUDIT.md#6-security-findings-prioritised) for the current findings.
