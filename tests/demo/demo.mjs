// Records a narrated walkthrough of a fresh LaunchForge install.
// Usage: BASE_URL=http://127.0.0.1:3000 INSTALL_LOG=install.log node demo.mjs
// Output: demo-output/video/*.webm and demo-output/screens/*.png
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = "demo-output";
const APP_HOST = "portfolio.127.0.0.1.sslip.io";
const OWNER = {
	name: "Aayush",
	lastName: "Jain",
	email: "aayush@launchforge.dev",
	password: "Demo-Password-2026!",
};

mkdirSync(`${OUT}/screens`, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	recordVideo: { dir: `${OUT}/video`, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
page.setDefaultTimeout(60_000);

const pause = (ms) => page.waitForTimeout(ms);
let shot = 0;
const screenshot = (name) =>
	page.screenshot({
		path: `${OUT}/screens/${String(++shot).padStart(2, "0")}-${name}.png`,
	});

/** Shows a caption bar on top of whatever page is open. */
const caption = async (step, title, detail = "") => {
	await page.evaluate(
		({ step, title, detail }) => {
			let bar = document.getElementById("lf-demo-caption");
			if (!bar) {
				bar = document.createElement("div");
				bar.id = "lf-demo-caption";
				bar.style.cssText =
					"position:fixed;left:24px;right:24px;bottom:24px;z-index:2147483647;" +
					"background:rgba(11,15,25,.94);color:#fafafa;border:1px solid #f97316;" +
					"border-radius:14px;padding:16px 22px;font:16px/1.45 system-ui,sans-serif;" +
					"box-shadow:0 12px 40px rgba(0,0,0,.45);pointer-events:none";
				document.body.appendChild(bar);
			}
			bar.innerHTML =
				`<div style="color:#f97316;font-weight:700;letter-spacing:.04em;font-size:13px">${step}</div>` +
				`<div style="font-size:22px;font-weight:700;margin:2px 0">${title}</div>` +
				(detail ? `<div style="color:#cbd5e1">${detail}</div>` : "");
		},
		{ step, title, detail },
	);
};

/** Full-screen card for intros, terminal output and API results. */
const card = async (html, ms = 4500) => {
	await page.setContent(`<!doctype html><html><body style="margin:0;height:100vh;
		display:flex;align-items:center;justify-content:center;
		background:radial-gradient(circle at 80% 10%,#7c2d12,#0b0f19 55%);
		color:#fafafa;font-family:system-ui,sans-serif">${html}</body></html>`);
	await pause(ms);
};

const terminal = (title, lines) => `
	<div style="width:1100px">
		<div style="font-size:15px;color:#f97316;font-weight:700;margin-bottom:10px">${title}</div>
		<pre style="background:#020617;border:1px solid #1e293b;border-radius:12px;padding:22px;
			font:14px/1.55 ui-monospace,Menlo,monospace;color:#e2e8f0;white-space:pre-wrap;margin:0">${lines
				.map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;"))
				.join("\n")}</pre>
	</div>`;

/** Calls the REST API with the browser's session cookie. */
const api = async (procedure, input) => {
	const res =
		input === undefined
			? await page.request.get(`${BASE}/api/${procedure}`)
			: await page.request.post(`${BASE}/api/${procedure}`, { data: input });
	const body = await res.json().catch(() => ({}));
	return { status: res.status(), body };
};

const must = async (procedure, input) => {
	const { status, body } = await api(procedure, input);
	if (status >= 400)
		throw new Error(`${procedure} -> ${status} ${JSON.stringify(body)}`);
	return body;
};

const waitFor = async (check, timeoutMs, everyMs = 3000) => {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await check()) return true;
		await pause(everyMs);
	}
	return false;
};

// ── Intro ────────────────────────────────────────────────────────────────
await card(
	`<div style="text-align:center">
	<div style="font-size:64px;font-weight:800">Launch<span style="color:#f97316">Forge</span> OS</div>
	<div style="font-size:26px;color:#cbd5e1;margin-top:12px">Push to Git. Ship to production. On servers you own.</div>
	<div style="font-size:18px;color:#94a3b8;margin-top:36px">A complete walkthrough on a fresh Ubuntu server</div>
</div>`,
	4000,
);

// ── 1. Install ───────────────────────────────────────────────────────────
const installLog = (() => {
	try {
		return readFileSync(process.env.INSTALL_LOG ?? "install.log", "utf8")
			.split("\n")
			.filter((l) => l.trim())
			.slice(-22);
	} catch {
		return ["curl -fsSL https://…/scripts/install.sh | sudo bash"];
	}
})();
await card(
	terminal("STEP 1 · ONE-COMMAND INSTALL — real output from this server", [
		"$ curl -fsSL https://raw.githubusercontent.com/Aayushajs/LaunchForge-OS/main/scripts/install.sh | sudo bash",
		...installLog,
	]),
	7000,
);

// ── 2. Owner account ─────────────────────────────────────────────────────
await page.goto(BASE);
await page.waitForURL(/register|\/$/);
if (!page.url().includes("register")) await page.goto(`${BASE}/register`);
await caption(
	"STEP 2",
	"Create the owner account",
	"The first user owns the installation and becomes the platform operator.",
);
await page
	.locator('input[name="name"]')
	.pressSequentially(OWNER.name, { delay: 60 });
await page
	.locator('input[name="lastName"]')
	.pressSequentially(OWNER.lastName, { delay: 60 });
await page
	.locator('input[name="email"]')
	.pressSequentially(OWNER.email, { delay: 40 });
await page
	.locator('input[name="password"]')
	.pressSequentially(OWNER.password, { delay: 30 });
await page
	.locator('input[name="confirmPassword"]')
	.pressSequentially(OWNER.password, { delay: 30 });
await screenshot("register");
await pause(800);
await page.locator('button[type="submit"]').click();
await page.waitForURL(/dashboard/, { timeout: 60_000 }).catch(async () => {
	await page.goto(BASE);
	await page.locator('input[name="email"]').fill(OWNER.email);
	await page.locator('input[name="password"]').fill(OWNER.password);
	await page.locator('button[type="submit"]').click();
	await page.waitForURL(/dashboard/);
});

// Resources are created through the same API the dashboard uses.
const { project, environment } = await must("project.create", {
	name: "portfolio",
	description: "My portfolio website",
});
const organization = await must("organization.active");

// ── 3. Project ───────────────────────────────────────────────────────────
await page.goto(`${BASE}/dashboard/projects`);
await caption(
	"STEP 3",
	"Projects group your services",
	"A project has environments (production, staging, …); each environment holds apps and databases.",
);
await pause(3500);
await screenshot("projects");

// ── 4. Application + domain + deploy ─────────────────────────────────────
const app = await must("application.create", {
	name: "site",
	environmentId: environment.environmentId,
});
const applicationId = app.applicationId;
await must("application.saveDockerProvider", {
	applicationId,
	dockerImage: "nginxdemos/hello:latest",
	username: "",
	password: "",
	registryUrl: "",
});
await must("domain.create", {
	host: APP_HOST,
	path: "/",
	port: 80,
	https: false,
	certificateType: "none",
	applicationId,
	domainType: "application",
});
await must("application.deploy", { applicationId });

const appUrl = `${BASE}/dashboard/project/${project.projectId}/environment/${environment.environmentId}/services/application/${applicationId}`;
await page.goto(appUrl);
await caption(
	"STEP 4",
	"Deploy an application",
	"Source can be GitHub, GitLab, Gitea, Bitbucket, any Git URL, a Docker image or a zip. This demo uses a Docker image.",
);
await pause(3500);
await screenshot("application-general");

await page
	.getByRole("tab", { name: /deployments/i })
	.click()
	.catch(() => {});
await caption(
	"STEP 4",
	"Health-gated rollout",
	"The deployment is marked done only when the new version is running. A crashing release is rolled back automatically.",
);
const deployed = await waitFor(async () => {
	const { body } = await api(`application.one?applicationId=${applicationId}`);
	return body?.applicationStatus === "done";
}, 240_000);
await page.reload();
await page
	.getByRole("tab", { name: /deployments/i })
	.click()
	.catch(() => {});
await caption(
	"STEP 4",
	deployed ? "Deployment finished: done" : "Deployment still running",
	"Every deployment keeps its full build log.",
);
await pause(3500);
await screenshot("deployments");

await page
	.getByRole("tab", { name: /domains/i })
	.click()
	.catch(() => {});
await caption(
	"STEP 5",
	"Domains and HTTPS",
	"Add your own domain; Let's Encrypt certificates are issued automatically. A hostname belongs to one workspace only.",
);
await pause(3500);
await screenshot("domains");

// ── 5. Live site ─────────────────────────────────────────────────────────
await page.goto(`http://${APP_HOST}`).catch(() => {});
await caption(
	"STEP 5",
	`Live at http://${APP_HOST}`,
	"Traefik routes the domain to the running container.",
);
await pause(4500);
await screenshot("live-site");

// ── 6. Logs ──────────────────────────────────────────────────────────────
await page.goto(appUrl);
await page
	.getByRole("tab", { name: /^logs$/i })
	.click()
	.catch(() => {});
await caption(
	"STEP 6",
	"Live logs",
	"Stream container logs in the browser; a web terminal and metrics are one tab away.",
);
await pause(4000);
await screenshot("logs");

// ── 7. Database ──────────────────────────────────────────────────────────
const pg = await must("postgres.create", {
	name: "database",
	databaseName: "portfolio",
	databaseUser: "portfolio",
	databasePassword: "Portfolio2026Secure",
	dockerImage: "postgres:16",
	environmentId: environment.environmentId,
});
await must("postgres.deploy", { postgresId: pg.postgresId }).catch(() => {});
await page.goto(
	`${BASE}/dashboard/project/${project.projectId}/environment/${environment.environmentId}`,
);
await caption(
	"STEP 7",
	"Managed databases",
	"PostgreSQL, MySQL, MariaDB, MongoDB, Redis and libSQL — with scheduled S3 backups and one-click restore. Passwords are encrypted at rest.",
);
await pause(4500);
await screenshot("environment-services");

// ── 8. Workload policy ───────────────────────────────────────────────────
const blocked = await api("mount.create", {
	type: "bind",
	hostPath: "/var/run/docker.sock",
	mountPath: "/var/run/docker.sock",
	serviceId: applicationId,
	serviceType: "application",
});
await card(
	terminal(
		"STEP 8 · WORKLOAD POLICY — a tenant tries to mount the Docker socket",
		[
			"POST /api/mount.create",
			JSON.stringify({
				type: "bind",
				hostPath: "/var/run/docker.sock",
				serviceType: "application",
			}),
			"",
			`HTTP ${blocked.status}`,
			JSON.stringify(blocked.body?.message ?? blocked.body, null, 2),
			"",
			"Host paths, privileged mode, host networking and raw Traefik labels are rejected",
			"when saved and again at deploy time.",
		],
	),
	6500,
);

// ── 9. Webhook security ──────────────────────────────────────────────────
const webhookGet = await page.request.get(
	`${BASE}/api/deploy/not-a-real-token`,
);
const webhookForged = await page.request.post(`${BASE}/api/deploy/github`, {
	data: { installation: { id: 1 } },
	headers: { "x-github-event": "push" },
});
await card(
	terminal("STEP 9 · SIGNED WEBHOOKS", [
		`GET  /api/deploy/<token>          -> HTTP ${webhookGet.status()}  (deploys accept POST only)`,
		`POST /api/deploy/github (unsigned) -> HTTP ${webhookForged.status()}  (GitHub App deliveries need a valid X-Hub-Signature-256)`,
		"",
		"GitLab tokens and Gitea / GitHub / Bitbucket HMAC signatures are verified over the raw request body.",
	]),
	6000,
);

// ── 10. Quotas and usage ─────────────────────────────────────────────────
await must("workspace.setQuota", {
	organizationId: organization.id,
	maxCpu: 4,
	maxMemoryMb: 4096,
	maxApplications: 10,
	maxDatabases: 5,
	maxDomains: 20,
});
await page.goto(`${BASE}/dashboard/settings/usage`);
await caption(
	"STEP 10",
	"Quotas and usage",
	"The operator limits CPU, memory, apps, databases and domains per workspace. Usage is sampled every minute.",
);
await pause(4500);
await screenshot("usage-quotas");

// ── 11. Teams and custom roles ───────────────────────────────────────────
await must("customRole.create", {
	role: "deployer",
	permissions: {
		deployment: ["read", "create"],
		logs: ["read"],
		service: ["read"],
	},
});
await page.goto(`${BASE}/dashboard/settings/users`);
await caption(
	"STEP 11",
	"Teams, roles and custom roles",
	"Invite people as owner, admin or member — or define exactly what a custom role may do.",
);
await pause(4500);
await screenshot("users-roles");

// ── 12. Audit log ────────────────────────────────────────────────────────
await page.goto(`${BASE}/dashboard/settings/audit-logs`);
await caption(
	"STEP 12",
	"Audit log",
	"Every change and sign-in is recorded: who, what, which resource, when.",
);
await pause(4500);
await screenshot("audit-log");

// ── 13. Monitoring ───────────────────────────────────────────────────────
await page.goto(`${BASE}/dashboard/monitoring`);
await caption(
	"STEP 13",
	"Monitoring",
	"Server and container metrics, alerts to Slack, Discord, Telegram, email and more.",
);
await pause(4000);
await screenshot("monitoring");

// ── Outro ────────────────────────────────────────────────────────────────
await card(
	`<div style="text-align:center;max-width:1000px">
	<div style="font-size:48px;font-weight:800">Launch<span style="color:#f97316">Forge</span> OS</div>
	<div style="font-size:22px;color:#cbd5e1;margin-top:18px;line-height:1.6">
		Isolation · Quotas · Health-gated rollouts · Signed webhooks<br/>Encrypted secrets · Audit log · One-command install
	</div>
	<div style="font-size:18px;color:#94a3b8;margin-top:36px">github.com/Aayushajs/LaunchForge-OS</div>
</div>`,
	4500,
);

await context.close();
await browser.close();
console.log(
	`Demo recorded. Deployment ${deployed ? "succeeded" : "did not finish in time"}.`,
);
