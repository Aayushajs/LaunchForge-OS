# Load Test Plan

Load tests use [k6](https://k6.io) scripts in [`tests/load`](../../tests/load). The [Load test workflow](../../.github/workflows/load-test.yml) installs LaunchForge on a fresh GitHub runner **with the production installer**, runs every scenario, and publishes a Markdown report (job summary + `load-test-reports` artifact). It runs weekly and on demand.

Reports are only written from real runs. Copy a run's `SUMMARY.md` into [`REPORTS/`](REPORTS) when it should be kept.

## Scenarios

| Script | What it exercises | Load shape | Pass criteria |
|---|---|---|---|
| `api-read.js` | Authenticated dashboard reads through tRPC: `user.get` (session + membership lookup), `project.all` (organization-scoped query), `settings.health` | Ramp 1 → 10 → 25 → 50 virtual users over 3 min, 1 s think time | Error rate < 1 %; p95 < 500 ms (`user.get`), < 800 ms (`project.all`), < 300 ms (`settings.health`) |
| `webhooks.js` | Deploy webhook handler under a burst: raw-body read, token lookup, rejection paths (unknown token → 404, GET → 405) | Constant 100 req/s for 1 min (up to 200 VUs) | p95 < 300 ms (lookup), < 100 ms (method check); 99 % of checks pass; no deployment queued |

## Running locally against any install

```bash
cd tests/load
mkdir -p reports
BASE_URL=http://<server>:3000 OWNER_EMAIL=you@example.com OWNER_PASSWORD=... k6 run api-read.js
BASE_URL=http://<server>:3000 k6 run webhooks.js
```

`api-read.js` signs up the owner account if the instance is fresh, then signs in; on an existing instance pass the owner's credentials.

## Not covered yet

- Concurrent real deployments (builds are CPU/disk bound and depend on the app; measure with a fixed sample app per language).
- Database provisioning throughput.
- Log streaming over WebSockets.
- Multi-node Swarm clusters.
