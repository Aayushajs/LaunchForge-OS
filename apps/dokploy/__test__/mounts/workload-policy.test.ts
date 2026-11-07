import {
	bindMountViolation,
	composePolicyViolations,
} from "@dokploy/server/utils/security/workload-policy";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => {
	delete process.env.BIND_MOUNT_ALLOWED_ROOTS;
	delete process.env.ALLOW_COMPOSE_TRAEFIK_LABELS;
});

describe("bindMountViolation", () => {
	it.each([
		"/var/run/docker.sock",
		"/run/docker.sock",
		"/",
		"/etc",
		"/etc/dokploy",
		"/proc/1/root",
		"/var/lib/docker/volumes",
		"/root/.ssh",
		"/srv/../etc/shadow",
		"/data/custom/docker.sock",
	])("rejects %s", (hostPath) => {
		expect(bindMountViolation(hostPath)).not.toBeNull();
	});

	it("rejects relative and empty paths", () => {
		expect(bindMountViolation("data")).toMatch(/absolute/);
		expect(bindMountViolation("")).toMatch(/required/);
	});

	it("allows ordinary data directories", () => {
		expect(bindMountViolation("/srv/portfolio/uploads")).toBeNull();
		expect(bindMountViolation("/home/aayush/data")).toBeNull();
	});

	it("restricts sources to the configured roots when set", () => {
		process.env.BIND_MOUNT_ALLOWED_ROOTS = "/srv/launchforge, /mnt/data";
		expect(bindMountViolation("/srv/launchforge/app")).toBeNull();
		expect(bindMountViolation("/mnt/data")).toBeNull();
		expect(bindMountViolation("/srv/other")).toMatch(/must be under/);
		expect(bindMountViolation("/srv/launchforge-evil")).toMatch(
			/must be under/,
		);
	});
});

describe("composePolicyViolations", () => {
	const context = { appName: "blog-abc123", domainKeys: [7] };
	const check = (service: Record<string, unknown>) =>
		composePolicyViolations({ services: { web: service } }, context);

	it("accepts an ordinary service", () => {
		expect(
			check({
				image: "nginx:alpine",
				volumes: ["./html:/usr/share/nginx/html:ro", "data:/var/cache"],
				labels: ["traefik.enable=true"],
				cap_add: ["NET_BIND_SERVICE"],
			}),
		).toEqual([]);
	});

	it.each([
		[{ privileged: true }, /privileged/],
		[{ network_mode: "host" }, /network_mode/],
		[{ pid: "host" }, /pid/],
		[{ ipc: "container:other" }, /ipc/],
		[{ cap_add: ["SYS_ADMIN"] }, /SYS_ADMIN/],
		[{ cap_add: ["cap_net_admin"] }, /NET_ADMIN/],
		[{ devices: ["/dev/kvm:/dev/kvm"] }, /devices/],
		[{ security_opt: ["seccomp:unconfined"] }, /security_opt/],
		[
			{ volumes: ["/var/run/docker.sock:/var/run/docker.sock"] },
			/Docker socket|not allowed/,
		],
		[
			{ volumes: [{ type: "bind", source: "/", target: "/host" }] },
			/not allowed/,
		],
		[{ volumes: ["../../etc:/x"] }, /project directory/],
		[{ volumes: ["~/.ssh:/keys"] }, /home-directory/],
		[{ extends: { file: "other.yml", service: "base" } }, /extends/],
	])("rejects %o", (service, message) => {
		const violations = check(service);
		expect(violations.length).toBeGreaterThan(0);
		expect(violations.join("\n")).toMatch(message);
	});

	it("rejects raw Traefik routing labels that could claim any host", () => {
		const violations = check({
			labels: {
				"traefik.http.routers.steal.rule": "Host(`victim.example.com`)",
			},
		});
		expect(violations.join()).toMatch(/managed by LaunchForge/);
	});

	it("allows labels LaunchForge generated for this compose's own domains", () => {
		expect(
			check({
				labels: [
					"traefik.http.routers.blog-abc123-7-web.rule=Host(`blog.example.com`)",
				],
				deploy: { labels: { "traefik.docker.network": "dokploy-network" } },
			}),
		).toEqual([]);
	});

	it("lets the operator opt back into raw Traefik labels", () => {
		process.env.ALLOW_COMPOSE_TRAEFIK_LABELS = "true";
		expect(
			check({ labels: ["traefik.http.routers.custom.rule=Host(`x.dev`)"] }),
		).toEqual([]);
	});

	it("rejects compose include", () => {
		expect(
			composePolicyViolations(
				{ include: ["other.yml"], services: {} },
				context,
			),
		).toHaveLength(1);
	});
});
