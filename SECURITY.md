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

LaunchForge runs user-supplied builds and containers. Workspaces are isolated from each other and from the host (separate networks, workload policy, quotas, host administration limited to the platform workspace), but builds still run on the host's Docker daemon and remote servers are trusted on first SSH connection. The open items are tracked in the [threat model](docs/06-security/THREAT_MODEL.md); read the [public platform checklist](docs/guide/14-public-platform.md#security-checklist) before opening sign-ups to strangers.
