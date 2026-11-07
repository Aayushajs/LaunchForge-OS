# Contributing to LaunchForge

## Setup

Requirements: Node.js 24 (`.nvmrc`), pnpm 10, Docker with Swarm mode enabled.

```bash
pnpm install
cp apps/dokploy/.env.example apps/dokploy/.env
pnpm run dokploy:setup
pnpm run server:script
pnpm run dokploy:dev
```

Open http://localhost:3000 and create the first (owner) account.

To test Git webhooks locally, expose port 3000 with a tunnel such as `pnpm dlx localtunnel --port 3000`.

## Building the image

```bash
cp apps/dokploy/.env.production.example .env.production
cp apps/dokploy/.env.production.example apps/dokploy/.env.production
docker build -t launchforge:local .
```

## Before opening a pull request

1. Branch from `main`.
2. Run `pnpm typecheck` and `pnpm test` (or the test files covering your change).
3. Run `pnpm check` to format and lint.
4. Add or update tests for the behaviour you changed.
5. Keep the PR focused on one change and describe how you verified it.

## Code style

- Don't write comments that restate the code; comment only the non-obvious "why".
- No section-divider comments.
- New source must be original work under the Apache License 2.0. Code under other licences, including any `proprietary/` directory, is rejected by CI.
