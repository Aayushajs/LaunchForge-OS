import type { ComposeSpecification } from "@dokploy/server";
import { db } from "@dokploy/server/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

const docker = vi.hoisted(() => ({
	networks: new Map<string, { Labels?: Record<string, string> }>(),
	connect: vi.fn(),
	createNetwork: vi.fn(),
	serviceInspect: vi.fn(),
	serviceUpdate: vi.fn(),
}));

const notFound = () =>
	Object.assign(new Error("not found"), { statusCode: 404 });

vi.mock("@dokploy/server/utils/servers/remote-docker", () => ({
	getRemoteDocker: async () => ({
		getNetwork: (name: string) => ({
			inspect: async () => {
				const network = docker.networks.get(name);
				if (!network) throw notFound();
				return network;
			},
			connect: (options: unknown) => docker.connect(name, options),
		}),
		createNetwork: async (options: {
			Name: string;
			Labels: Record<string, string>;
		}) => {
			docker.createNetwork(options);
			docker.networks.set(options.Name, { Labels: options.Labels });
			return { id: options.Name };
		},
		getService: () => ({
			inspect: docker.serviceInspect,
			update: docker.serviceUpdate,
		}),
	}),
}));

const {
	assertNetworkTargetsAllowed,
	confineComposeToWorkspaceNetwork,
	ensureWorkspaceNetwork,
	workspaceNetworkName,
} = await import("@dokploy/server/utils/docker/workspace-network");
const { resolveServiceNetworks, importDockerNetworks, createNetwork } =
	await import("@dokploy/server/services/network");

const findMany = db.query.network.findMany as ReturnType<typeof vi.fn>;
const OWN = workspaceNetworkName("org-a");

const compose = (yaml: string) => parse(yaml) as ComposeSpecification;

beforeEach(() => {
	docker.networks.clear();
	docker.connect.mockReset().mockResolvedValue(undefined);
	docker.createNetwork.mockReset();
	docker.serviceInspect.mockReset();
	docker.serviceUpdate.mockReset();
	findMany.mockReset().mockResolvedValue([]);
});

afterEach(() => {
	delete process.env.WORKSPACE_NETWORK_ISOLATION;
});

describe("ensureWorkspaceNetwork", () => {
	it("creates a labelled overlay network and attaches Traefik", async () => {
		await expect(ensureWorkspaceNetwork("org-a")).resolves.toBe(OWN);

		expect(docker.createNetwork).toHaveBeenCalledWith(
			expect.objectContaining({
				Name: OWN,
				Driver: "overlay",
				Attachable: true,
				Labels: { "launchforge.workspace": "org-a" },
			}),
		);
		expect(docker.connect).toHaveBeenCalledWith(OWN, {
			Container: "dokploy-traefik",
		});
	});

	it("reuses its own network and tolerates Traefik already being attached", async () => {
		docker.networks.set(OWN, { Labels: { "launchforge.workspace": "org-a" } });
		docker.connect.mockRejectedValue(
			Object.assign(new Error("endpoint already exists in network"), {
				statusCode: 403,
			}),
		);

		await expect(ensureWorkspaceNetwork("org-a")).resolves.toBe(OWN);
		expect(docker.createNetwork).not.toHaveBeenCalled();
	});

	it("refuses a network under the workspace's name that the platform did not create", async () => {
		docker.networks.set(OWN, { Labels: { "launchforge.workspace": "org-b" } });

		await expect(ensureWorkspaceNetwork("org-a")).rejects.toThrow(
			/not created for this workspace/,
		);
		expect(docker.connect).not.toHaveBeenCalled();
	});

	it("adds the network to Traefik when Traefik runs as a Swarm service", async () => {
		docker.connect.mockRejectedValue(notFound());
		docker.serviceInspect.mockResolvedValue({
			Version: { Index: "7" },
			Spec: {
				Name: "dokploy-traefik",
				TaskTemplate: { Networks: [{ Target: "dokploy-network" }] },
			},
		});

		await ensureWorkspaceNetwork("org-a");

		expect(docker.serviceUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				version: 7,
				TaskTemplate: {
					Networks: [{ Target: "dokploy-network" }, { Target: OWN }],
				},
			}),
		);
	});
});

describe("resolveServiceNetworks", () => {
	const service = (overrides: object = {}) => ({
		serverId: null,
		environment: { project: { organizationId: "org-a" } },
		...overrides,
	});

	it("puts a workspace's service on the workspace network, not the shared one", async () => {
		const networks = await resolveServiceNetworks(service() as never);

		expect(networks).toEqual([{ Target: OWN }]);
	});

	it("keeps the shared network when isolation is turned off", async () => {
		process.env.WORKSPACE_NETWORK_ISOLATION = "false";

		const networks = await resolveServiceNetworks(service() as never);

		expect(networks).toEqual([{ Target: "dokploy-network" }]);
		expect(docker.createNetwork).not.toHaveBeenCalled();
	});

	it("rejects raw Swarm networks that point at the shared network", async () => {
		await expect(
			resolveServiceNetworks(
				service({ networkSwarm: [{ Target: "dokploy-network" }] }) as never,
			),
		).rejects.toThrow(/shared with other workspaces/);
	});

	it("rejects raw Swarm networks that point at another workspace", async () => {
		await expect(
			resolveServiceNetworks(
				service({
					networkSwarm: [{ Target: workspaceNetworkName("org-b") }],
				}) as never,
			),
		).rejects.toThrow(/shared with other workspaces/);
	});

	it("allows raw Swarm networks the workspace owns", async () => {
		findMany.mockResolvedValue([{ name: "backend" }]);
		const networkSwarm = [{ Target: "backend" }, { Target: OWN }];

		await expect(
			resolveServiceNetworks(service({ networkSwarm }) as never),
		).resolves.toEqual(networkSwarm);
	});
});

describe("assertNetworkTargetsAllowed", () => {
	it("rejects a network the workspace has not created or imported", () => {
		expect(() =>
			assertNetworkTargetsAllowed(["someone-elses"], "org-a", new Set()),
		).toThrow(/not one of this workspace's networks/);
	});
});

describe("confineComposeToWorkspaceNetwork", () => {
	it("moves services, Traefik labels and the root declaration to the workspace network", () => {
		const spec = confineComposeToWorkspaceNetwork(
			compose(`
services:
  web:
    image: nginx
    networks: [dokploy-network, default]
    labels:
      - traefik.docker.network=dokploy-network
  api:
    image: api
    networks:
      dokploy-network:
        aliases: [api]
    deploy:
      labels:
        traefik.swarm.network: dokploy-network
networks:
  dokploy-network:
    external: true
`),
			"org-a",
		);

		expect(spec.services?.web?.networks).toEqual([OWN, "default"]);
		expect(spec.services?.web?.labels).toEqual([
			`traefik.docker.network=${OWN}`,
		]);
		expect(spec.services?.api?.networks).toEqual({
			[OWN]: { aliases: ["api"] },
		});
		expect(
			(spec.services?.api?.deploy?.labels as Record<string, string>)[
				"traefik.swarm.network"
			],
		).toBe(OWN);
		expect(spec.networks).toEqual({ [OWN]: { external: true } });
	});

	it.each([
		[
			"an external network named after another workspace",
			"external: true",
			"lf-ws-org-b",
		],
		[
			"a network renamed to the shared network",
			"name: dokploy-network",
			"internal",
		],
		[
			"a legacy external name",
			"external:\n      name: lf-ws-org-b",
			"internal",
		],
	])("rejects %s", (_, definition, key) => {
		const spec = compose(`
services:
  web:
    image: nginx
networks:
  ${key}:
    ${definition}
`);

		expect(() => confineComposeToWorkspaceNetwork(spec, "org-a")).toThrow(
			/belongs to the platform or another workspace/,
		);
	});

	it("leaves the compose project's own networks alone", () => {
		const spec = compose(`
services:
  web:
    image: nginx
    networks: [backend]
networks:
  backend: {}
`);

		expect(confineComposeToWorkspaceNetwork(spec, "org-a").networks).toEqual({
			backend: {},
		});
	});
});

describe("network management", () => {
	it("never offers or imports workspace networks", async () => {
		docker.networks.set(workspaceNetworkName("org-b"), {});

		const result = await importDockerNetworks("org-a", null, [
			workspaceNetworkName("org-b"),
		]);

		expect(result.imported).toEqual([]);
	});

	it("refuses to import a network another workspace already registered", async () => {
		findMany
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ name: "payments" }]);
		docker.networks.set("payments", {});

		const result = await importDockerNetworks("org-a", null, ["payments"]);

		expect(result.imported).toEqual([]);
		expect(result.errors).toEqual([
			{ name: "payments", error: "Network is reserved or not supported" },
		]);
	});

	it("refuses to create a network with a platform name", async () => {
		await expect(
			createNetwork({ name: workspaceNetworkName("org-b") } as never, "org-a"),
		).rejects.toThrow(/reserved for the platform/);
	});
});
