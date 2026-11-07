// Burst of webhook deliveries: the handler must reject bad requests fast
// (unknown token -> 404, non-POST -> 405) without queuing deployments.

import { check } from "k6";
import http from "k6/http";
import { BASE_URL, markdownReport } from "./lib.js";

export const options = {
	scenarios: {
		webhook_burst: {
			executor: "constant-arrival-rate",
			rate: 100,
			timeUnit: "1s",
			duration: "1m",
			preAllocatedVUs: 50,
			maxVUs: 200,
		},
	},
	thresholds: {
		"http_req_duration{kind:unknown-token}": ["p(95)<300"],
		"http_req_duration{kind:wrong-method}": ["p(95)<100"],
		checks: ["rate>0.99"],
	},
};

const payload = JSON.stringify({
	ref: "refs/heads/main",
	after: "0".repeat(40),
});

export default () => {
	const token = `missing-${__VU}-${__ITER}`;
	const unknown = http.post(`${BASE_URL}/api/deploy/${token}`, payload, {
		headers: { "Content-Type": "application/json", "X-GitHub-Event": "push" },
		tags: { kind: "unknown-token" },
		responseCallback: http.expectedStatuses(404),
	});
	check(unknown, { "unknown token rejected": (r) => r.status === 404 });

	const wrongMethod = http.get(`${BASE_URL}/api/deploy/${token}`, {
		tags: { kind: "wrong-method" },
		responseCallback: http.expectedStatuses(405),
	});
	check(wrongMethod, { "GET rejected": (r) => r.status === 405 });
};

export const handleSummary = (data) => ({
	"reports/webhooks.json": JSON.stringify(data, null, 2),
	"reports/webhooks.md": markdownReport("Webhook burst", data),
});
