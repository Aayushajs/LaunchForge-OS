import { TRPCError } from "@trpc/server";
import { getRemoteDocker } from "../servers/remote-docker";
import type { ComposeSpecification } from "./types";

export const SHARED_NETWORK = "dokploy-network";
export const WORKSPACE_NETWORK_PREFIX = "lf-ws-";
export const WORKSPACE_NETWORK_LABEL = "launchforge.workspace";
const TRAEFIK = "dokploy-traefik";

export const isWorkspaceNetworkIsolationEnabled = () =>
	process.env.WORKSPACE_NETWORK_ISOLATION !== "false";

// Organization ids are nanoid strings ([A-Za-z0-9_-]), which are valid
// Docker network name characters, so the id is used as is.
export const workspaceNetworkName = (organizationId: string) =>
	`${WORKSPACE_NETWORK_PREFIX}${organizationId}`;

/** Networks only the platform may attach services to. */
export const isPlatformNetworkName = (name: string) =>
	name === SHARED_NETWORK || name.startsWith(WORKSPACE_NETWORK_PREFIX);

const forbidden = (message: string): never => {
	throw new TRPCError({ code: "FORBIDDEN", message });
};

const statusOf = (error: unknown) =>
	(error as { statusCode?: number })?.statusCode;

const isAlreadyAttached = (error: unknown) => {
	const status = statusOf(error);
	const message = error instanceof Error ? error.message : String(error);
	return (
		status === 409 ||
		(status === 403 && /already exists|already attached/i.test(message))
	);
};

type Docker = Awaited<ReturnType<typeof getRemoteDocker>>;

const inspectNetwork = async (docker: Docker, name: string) => {
	try {
		return (await docker.getNetwork(name).inspect()) as {
			Labels?: Record<string, string> | null;
		};
	} catch (error) {
		if (statusOf(error) === 404) return null;
		throw error;
	}
};

const assertOwnedBy = (
	info: { Labels?: Record<string, string> | null },
	name: string,
	organizationId: string,
) => {
	// Someone could pre-create a network under this workspace's name to have
	// its services join it; never adopt a network the platform did not label.
	if (info.Labels?.[WORKSPACE_NETWORK_LABEL] !== organizationId) {
		forbidden(
			`Docker network "${name}" exists but was not created for this workspace. Remove it and redeploy.`,
		);
	}
};

const attachTraefik = async (docker: Docker, name: string) => {
	try {
		await docker.getNetwork(name).connect({ Container: TRAEFIK });
		return;
	} catch (error) {
		if (isAlreadyAttached(error)) return;
		if (statusOf(error) !== 404) throw error;
	}

	// No standalone container: Traefik runs as a Swarm service instead.
	let service: Awaited<ReturnType<ReturnType<Docker["getService"]>["inspect"]>>;
	try {
		service = await docker.getService(TRAEFIK).inspect();
	} catch (error) {
		if (statusOf(error) === 404) return;
		throw error;
	}
	const spec = service.Spec;
	const networks: { Target: string }[] = spec.TaskTemplate?.Networks ?? [];
	if (networks.some((network) => network.Target === name)) return;
	await docker.getService(TRAEFIK).update({
		...spec,
		version: Number.parseInt(service.Version.Index, 10),
		TaskTemplate: {
			...spec.TaskTemplate,
			Networks: [...networks, { Target: name }],
		},
	});
};

/**
 * Creates the workspace's private overlay network if needed and attaches
 * Traefik to it, so the workspace's services are reachable from the internet
 * through their domains but not from other workspaces.
 */
export const ensureWorkspaceNetwork = async (
	organizationId: string,
	serverId?: string | null,
) => {
	const name = workspaceNetworkName(organizationId);
	const docker = await getRemoteDocker(serverId ?? null);

	const existing = await inspectNetwork(docker, name);
	if (existing) {
		assertOwnedBy(existing, name, organizationId);
	} else {
		try {
			await docker.createNetwork({
				Name: name,
				Driver: "overlay",
				Attachable: true,
				CheckDuplicate: true,
				Labels: { [WORKSPACE_NETWORK_LABEL]: organizationId },
			});
		} catch (error) {
			if (statusOf(error) !== 409) throw error;
			const raced = await inspectNetwork(docker, name);
			if (raced) assertOwnedBy(raced, name, organizationId);
		}
	}

	await attachTraefik(docker, name);
	return name;
};

/** Network names a service of this workspace may join explicitly. */
export const assertNetworkTargetsAllowed = (
	targets: string[],
	organizationId: string,
	ownedNames: Set<string>,
) => {
	const own = workspaceNetworkName(organizationId);
	for (const target of targets) {
		if (target === own || ownedNames.has(target)) continue;
		if (isPlatformNetworkName(target)) {
			forbidden(
				`Network "${target}" is shared with other workspaces and cannot be joined.`,
			);
		}
		forbidden(
			`Network "${target}" is not one of this workspace's networks. Create or import it under Networks first.`,
		);
	}
};

const renameInLabels = (labels: unknown, to: string) => {
	const keys = ["traefik.docker.network", "traefik.swarm.network"];
	if (Array.isArray(labels)) {
		return labels.map((label) =>
			typeof label === "string" &&
			keys.some((key) => label === `${key}=${SHARED_NETWORK}`)
				? `${label.split("=")[0]}=${to}`
				: label,
		);
	}
	if (labels && typeof labels === "object") {
		const dict = labels as Record<string, unknown>;
		for (const key of keys) {
			if (dict[key] === SHARED_NETWORK) dict[key] = to;
		}
	}
	return labels;
};

const externalName = (key: string, definition: unknown) => {
	if (!definition || typeof definition !== "object") return null;
	const { name, external } = definition as {
		name?: unknown;
		external?: unknown;
	};
	if (external && typeof external === "object") {
		const legacy = (external as { name?: unknown }).name;
		if (typeof legacy === "string") return legacy;
	}
	if (typeof name === "string") return name;
	return external ? key : null;
};

/**
 * Moves a compose file from the shared platform network onto the
 * workspace's network and rejects any reference to another workspace's
 * network. Mutates and returns the specification.
 */
export const confineComposeToWorkspaceNetwork = (
	spec: ComposeSpecification,
	organizationId: string,
) => {
	const own = workspaceNetworkName(organizationId);

	for (const service of Object.values(spec.services ?? {})) {
		if (!service) continue;
		const networks = service.networks;
		if (Array.isArray(networks)) {
			service.networks = [
				...new Set(networks.map((n) => (n === SHARED_NETWORK ? own : n))),
			];
		} else if (networks && typeof networks === "object") {
			const dict = networks as Record<string, unknown>;
			if (SHARED_NETWORK in dict) {
				dict[own] ??= dict[SHARED_NETWORK];
				delete dict[SHARED_NETWORK];
			}
		}
		service.labels = renameInLabels(
			service.labels,
			own,
		) as typeof service.labels;
		if (service.deploy?.labels) {
			service.deploy.labels = renameInLabels(
				service.deploy.labels,
				own,
			) as typeof service.deploy.labels;
		}
	}

	const root = spec.networks as Record<string, unknown> | undefined;
	if (root && SHARED_NETWORK in root) {
		delete root[SHARED_NETWORK];
		root[own] = { external: true };
	}

	for (const [key, definition] of Object.entries(root ?? {})) {
		const name = externalName(key, definition);
		if (name && name !== own && isPlatformNetworkName(name)) {
			forbidden(
				`Compose network "${key}" points at "${name}", which belongs to the platform or another workspace.`,
			);
		}
	}

	return spec;
};
