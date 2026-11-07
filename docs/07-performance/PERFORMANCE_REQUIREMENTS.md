# Performance Requirements

Targets for a single-node install on the minimum supported server (2 vCPU, 2 GB RAM). They are the thresholds enforced by the k6 scripts; a run that misses one fails the Load test workflow.

| Area | Requirement | Measured by |
|---|---|---|
| Dashboard API reads | p95 < 500 ms at 50 concurrent users, error rate < 1 % | `tests/load/api-read.js` |
| Organization-scoped lists | p95 < 800 ms at 50 concurrent users | `tests/load/api-read.js` (`project.all`) |
| Health endpoint | p95 < 300 ms | `tests/load/api-read.js` |
| Webhook rejection | p95 < 300 ms at 100 req/s | `tests/load/webhooks.js` |
| Deployment completion | Reported done only once the new version is running/healthy; health wait bounded by `DEPLOY_HEALTH_TIMEOUT_SECONDS` (120 s) | `packages/server/src/utils/builders/rollout.ts` |
| Build duration | Bounded by `BUILD_TIMEOUT_SECONDS` (1 h) | `packages/server/src/utils/builders/build-timeout.ts` |
| Restart resilience | Queued deployments survive a dashboard restart | `apps/dokploy/__test__/queues/durable-queue.test.ts` |
| Metering overhead | One `docker ps` + one `docker stats --no-stream` per host per minute | `packages/server/src/utils/metering/collector.ts` |
