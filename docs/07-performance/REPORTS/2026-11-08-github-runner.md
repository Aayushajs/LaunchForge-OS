# Load test — 2026-11-08 (GitHub-hosted runner)

Source: [Load test run 42438518463](https://github.com/Aayushajs/LaunchForge-OS/actions/runs/42438518463). Installed with `scripts/install.sh` on a fresh runner (4 vCPU, 15.6 GB RAM, Ubuntu 24.04.5 LTS), commit `0225a16`. Single-node install; the load generator ran on the same machine.

## API read latency

Generated 2026-11-08T02:35:14.413Z against http://127.0.0.1:3000.

Requests: 10826 · throughput: 60.06 req/s · failed: 0.00%

### Latency (ms)

| Metric | avg | p50 | p90 | p95 | max |
|---|---|---|---|---|---|
| http_req_duration | 53.10 | 27.23 | 149.44 | 175.56 | 330.43 |
| http_req_duration{expected_response:true} | 53.10 | 27.23 | 149.44 | 175.56 | 330.43 |
| http_req_duration{procedure:project.all} | 62.97 | 32.50 | 177.14 | 203.53 | 330.43 |
| http_req_duration{procedure:settings.health} | 43.94 | 21.96 | 121.83 | 147.78 | 227.87 |
| http_req_duration{procedure:user.get} | 52.37 | 26.93 | 146.69 | 165.64 | 240.97 |

### Thresholds

| Metric | Threshold | Result |
|---|---|---|
| http_req_duration{procedure:project.all} | `p(95)<800` | pass |
| http_req_duration{procedure:user.get} | `p(95)<500` | pass |
| http_req_duration{procedure:settings.health} | `p(95)<300` | pass |
| http_req_failed | `rate<0.01` | pass |

## Webhook burst

Generated 2026-11-08T02:36:14.534Z against http://127.0.0.1:3000.

Requests: 12000 · throughput: 200.00 req/s · failed: 0.00%

### Latency (ms)

| Metric | avg | p50 | p90 | p95 | max |
|---|---|---|---|---|---|
| http_req_duration | 2.38 | 3.05 | 3.71 | 3.93 | 151.90 |
| http_req_duration{expected_response:true} | 2.38 | 3.05 | 3.71 | 3.93 | 151.90 |
| http_req_duration{kind:unknown-token} | 4.05 | 3.45 | 3.91 | 4.71 | 151.90 |
| http_req_duration{kind:wrong-method} | 0.71 | 0.65 | 0.78 | 0.85 | 29.74 |

### Thresholds

| Metric | Threshold | Result |
|---|---|---|
| http_req_duration{kind:wrong-method} | `p(95)<100` | pass |
| http_req_duration{kind:unknown-token} | `p(95)<300` | pass |
| checks | `rate>0.99` | pass |
