// Authenticated dashboard reads under increasing concurrency.
import { check, sleep } from "k6";
import { markdownReport, signIn, trpcQuery } from "./lib.js";

export const options = {
	scenarios: {
		dashboard_reads: {
			executor: "ramping-vus",
			startVUs: 1,
			stages: [
				{ duration: "30s", target: 10 },
				{ duration: "1m", target: 25 },
				{ duration: "1m", target: 50 },
				{ duration: "30s", target: 0 },
			],
		},
	},
	thresholds: {
		http_req_failed: ["rate<0.01"],
		"http_req_duration{procedure:user.get}": ["p(95)<500"],
		"http_req_duration{procedure:project.all}": ["p(95)<800"],
		"http_req_duration{procedure:settings.health}": ["p(95)<300"],
	},
};

export const setup = () => signIn();

export default ({ cookie }) => {
	for (const procedure of ["user.get", "project.all", "settings.health"]) {
		const res = trpcQuery(procedure, cookie);
		check(res, { [`${procedure} 200`]: (r) => r.status === 200 });
	}
	sleep(1);
};

export const handleSummary = (data) => ({
	"reports/api-read.json": JSON.stringify(data, null, 2),
	"reports/api-read.md": markdownReport("API read latency", data),
});
