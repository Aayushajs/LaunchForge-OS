# 8. Teams, roles and audit

## Workspaces

Every user belongs to one or more workspaces and works in one at a time (switch from the sidebar). Everything — projects, servers, Git providers, registries, SSH keys, S3 destinations — belongs to exactly one workspace. Requests that reference another workspace's resource are rejected.

## Invite people

**Settings → Users → Invite**: email and role. The invited person receives a link (email if SMTP or an email notification provider is configured; otherwise copy the link) and creates their account from it.

## Roles

| Role | Can do |
|---|---|
| **Owner** | Everything, including deleting the workspace |
| **Admin** | Everything except deleting the workspace |
| **Member** | Read-only on workspace settings; full control (deploy, env vars, domains, backups, logs) of the projects and services they are given access to |
| **Custom role** | Exactly the actions you select |

For members, **Edit permissions** assigns projects, environments, services, servers and Git providers, plus toggles such as "create projects", "access Docker", "access API".

## Custom roles

**Settings → Users → Custom Roles → New role**: tick actions per resource (e.g. a *deployer* role with `deployment.create`, `logs.read`, `envVars.read`). Up to 10 roles per workspace; a role still in use cannot be deleted. Full list of resources and actions: [RBAC matrix](../06-security/RBAC_MATRIX.md).

## API keys

**Settings → Profile → API Keys**: create a key for one workspace, optionally with an expiry and rate limit. It acts as you, with your role, in that workspace only, and stops working if you leave it.

## Two-factor authentication and passkeys

**Settings → Profile**: TOTP 2FA with backup codes, and passkeys.

## Audit log

**Settings → Audit Logs**: every create/update/delete/deploy, sign-in and sign-out in the workspace, with who, what, which resource and when. Filter by user email and action.

## Sessions

**Settings → Sessions**: see and revoke your active sessions.
