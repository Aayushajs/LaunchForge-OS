import { check, fail } from "k6";
import http from "k6/http";

export const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3000";

const OWNER = {
	email: __ENV.OWNER_EMAIL || "loadtest@launchforge.local",
	password: __ENV.OWNER_PASSWORD || "LoadTest-Password-2026!",
	name: "Load Test",
};

/**
 * Creates the owner account on a fresh install (ignored if it exists) and
 * returns the session cookie header used by every virtual user.
 */
export const signIn = () => {
	const json = {
		headers: { "Content-Type": "application/json", Origin: BASE_URL },
	};
	http.post(`${BASE_URL}/api/auth/sign-up/email`, JSON.stringify(OWNER), json);
	const res = http.post(
		`${BASE_URL}/api/auth/sign-in/email`,
		JSON.stringify({ email: OWNER.email, password: OWNER.password }),
		json,
	);
	if (!check(res, { "signed in": (r) => r.status === 200 })) {
		fail(`sign-in failed: ${res.status} ${res.body}`);
	}
	const cookies = Object.entries(res.cookies)
		.map(([name, values]) => `${name}=${values[0].value}`)
		.join("; ");
	return { cookie: cookies };
};

/** Calls a tRPC query the way the dashboard does (GET, superjson input). */
export const trpcQuery = (procedure, cookie, input = null, tags = {}) =>
	http.get(
		`${BASE_URL}/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`,
		{ headers: { Cookie: cookie }, tags: { procedure, ...tags } },
	);

/** Writes a Markdown report next to the JSON summary. */
export const markdownReport = (title, data) => {
	const metric = (name, field) => {
		const value = data.metrics[name]?.values?.[field];
		return value === undefined ? "–" : value.toFixed(2);
	};
	const rows = Object.keys(data.metrics)
		.filter(
			(name) =>
				name.startsWith("http_req_duration{") || name === "http_req_duration",
		)
		.sort()
		.map(
			(name) =>
				`| ${name} | ${metric(name, "avg")} | ${metric(name, "med")} | ${metric(name, "p(90)")} | ${metric(name, "p(95)")} | ${metric(name, "max")} |`,
		);
	const thresholds = Object.entries(data.metrics).flatMap(([name, value]) =>
		Object.entries(value.thresholds || {}).map(
			([expr, result]) =>
				`| ${name} | \`${expr}\` | ${result.ok ? "pass" : "FAIL"} |`,
		),
	);
	return [
		`# ${title}`,
		"",
		`Generated ${new Date().toISOString()} against ${BASE_URL}.`,
		"",
		`Requests: ${data.metrics.http_reqs?.values?.count ?? 0} · ` +
			`throughput: ${metric("http_reqs", "rate")} req/s · ` +
			`failed: ${((data.metrics.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%`,
		"",
		"## Latency (ms)",
		"",
		"| Metric | avg | p50 | p90 | p95 | max |",
		"|---|---|---|---|---|---|",
		...rows,
		"",
		"## Thresholds",
		"",
		"| Metric | Threshold | Result |",
		"|---|---|---|",
		...thresholds,
		"",
	].join("\n");
};
