import path from "node:path";

/**
 * Host paths a workload may never mount: the Docker socket and anything that
 * holds host or platform state. Mounting any of them hands the container
 * control of the host or of every other workspace on it.
 */
const FORBIDDEN_HOST_PATHS = [
	"/",
	"/bin",
	"/boot",
	"/dev",
	"/etc",
	"/lib",
	"/lib64",
	"/proc",
	"/root",
	"/run",
	"/sbin",
	"/sys",
	"/usr",
	"/var/lib/docker",
	"/var/lib/containerd",
	"/var/run",
	"/var/run/docker.sock",
	"/run/docker.sock",
];

/**
 * "strict" (default) enforces the mount and compose rules below. Operators of
 * single-owner installs who trust every user can set WORKLOAD_POLICY=permissive.
 */
export const isPermissiveWorkloadPolicy = () =>
	process.env.WORKLOAD_POLICY === "permissive";

const isWithin = (child: string, parent: string) =>
	parent === "/"
		? child === "/"
		: child === parent || child.startsWith(`${parent}/`);

export const allowedBindMountRoots = () =>
	(process.env.BIND_MOUNT_ALLOWED_ROOTS ?? "")
		.split(",")
		.map((root) => root.trim())
		.filter(Boolean)
		.map((root) => path.posix.normalize(root).replace(/\/+$/, "") || "/");

/**
 * Returns why a bind mount source is not allowed, or null when it is.
 * Host paths are checked after normalization so `..` segments cannot step
 * out of an allowed root. When BIND_MOUNT_ALLOWED_ROOTS is set, sources must
 * live under one of those directories.
 */
export const bindMountViolation = (hostPath: string | null | undefined) => {
	if (isPermissiveWorkloadPolicy()) return null;
	if (!hostPath?.trim()) return "a host path is required";
	const raw = hostPath.trim();
	if (!raw.startsWith("/")) return "the host path must be absolute";
	const normalized = path.posix.normalize(raw).replace(/\/+$/, "") || "/";

	for (const forbidden of FORBIDDEN_HOST_PATHS) {
		if (
			forbidden === "/" ? normalized === "/" : isWithin(normalized, forbidden)
		) {
			return `mounting ${forbidden} from the host is not allowed`;
		}
	}
	if (normalized.endsWith("docker.sock")) {
		return "mounting the Docker socket is not allowed";
	}

	const roots = allowedBindMountRoots();
	if (roots.length > 0 && !roots.some((root) => isWithin(normalized, root))) {
		return `bind mounts must be under ${roots.join(", ")}`;
	}
	return null;
};

export class WorkloadPolicyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "WorkloadPolicyError";
	}
}

export const assertBindMountAllowed = (hostPath: string | null | undefined) => {
	const violation = bindMountViolation(hostPath);
	if (violation) {
		throw new WorkloadPolicyError(
			`Bind mount rejected (${hostPath ?? ""}): ${violation}.`,
		);
	}
};

const DANGEROUS_CAPABILITIES = new Set([
	"ALL",
	"SYS_ADMIN",
	"SYS_MODULE",
	"SYS_PTRACE",
	"SYS_RAWIO",
	"SYS_BOOT",
	"SYS_TIME",
	"NET_ADMIN",
	"DAC_READ_SEARCH",
	"MAC_ADMIN",
	"MAC_OVERRIDE",
	"BPF",
	"PERFMON",
]);

const HOST_NAMESPACE_KEYS = [
	"network_mode",
	"pid",
	"ipc",
	"userns_mode",
	"uts",
	"cgroup",
] as const;

const ALWAYS_ALLOWED_TRAEFIK_LABELS = new Set([
	"traefik.enable",
	"traefik.docker.network",
	"traefik.swarm.network",
]);

export interface ComposePolicyContext {
	appName: string;
	/** uniqueConfigKey of every domain LaunchForge will (re)write labels for. */
	domainKeys: number[];
}

type ComposeService = {
	privileged?: unknown;
	cap_add?: unknown;
	devices?: unknown;
	security_opt?: unknown;
	volumes?: unknown;
	labels?: unknown;
	extends?: unknown;
	deploy?: { labels?: unknown };
} & Partial<Record<(typeof HOST_NAMESPACE_KEYS)[number], unknown>>;

const labelKeys = (labels: unknown): string[] => {
	if (Array.isArray(labels)) {
		return labels.map((label) => String(label).split("=")[0] ?? "");
	}
	if (labels && typeof labels === "object") return Object.keys(labels);
	return [];
};

const isGeneratedTraefikLabel = (
	label: string,
	{ appName, domainKeys }: ComposePolicyContext,
) =>
	domainKeys.some((key) =>
		[
			`traefik.http.routers.${appName}-${key}-`,
			`traefik.http.services.${appName}-${key}-`,
			`traefik.http.middlewares.stripprefix-${appName}-${key}.`,
			`traefik.http.middlewares.addprefix-${appName}-${key}.`,
		].some((prefix) => label.startsWith(prefix)),
	);

const volumeSource = (
	volume: unknown,
): { type: string; source: string } | null => {
	if (typeof volume === "string") {
		const [source, target] = volume.split(":");
		if (target === undefined) return null;
		const isPath =
			source?.startsWith("/") ||
			source?.startsWith(".") ||
			source?.startsWith("~");
		return isPath ? { type: "bind", source: source ?? "" } : null;
	}
	if (volume && typeof volume === "object") {
		const { type, source } = volume as { type?: string; source?: string };
		if (type === "bind") return { type, source: source ?? "" };
	}
	return null;
};

/**
 * Returns every reason a user-supplied compose file may not be deployed.
 * Compose is the easiest way out of a container: privileged mode, host
 * namespaces, devices, extra capabilities and host bind mounts all reach the
 * host, and raw Traefik labels can claim another workspace's hostname.
 */
export const composePolicyViolations = (
	spec: { services?: Record<string, ComposeService>; include?: unknown },
	context: ComposePolicyContext,
): string[] => {
	if (isPermissiveWorkloadPolicy()) return [];
	const violations: string[] = [];
	if (spec.include) {
		violations.push("`include` is not supported: inline the included services");
	}
	const allowTraefikLabels =
		process.env.ALLOW_COMPOSE_TRAEFIK_LABELS === "true";

	for (const [name, service] of Object.entries(spec.services ?? {})) {
		const where = `service "${name}"`;
		if (!service || typeof service !== "object") continue;

		if (service.privileged === true || service.privileged === "true") {
			violations.push(`${where}: privileged mode is not allowed`);
		}
		for (const key of HOST_NAMESPACE_KEYS) {
			const value = service[key];
			if (
				typeof value === "string" &&
				(value === "host" || value.startsWith("container:"))
			) {
				violations.push(`${where}: ${key}: ${value} is not allowed`);
			}
		}
		if (Array.isArray(service.cap_add)) {
			for (const cap of service.cap_add) {
				const normalized = String(cap).toUpperCase().replace(/^CAP_/, "");
				if (DANGEROUS_CAPABILITIES.has(normalized)) {
					violations.push(`${where}: cap_add ${normalized} is not allowed`);
				}
			}
		}
		if (Array.isArray(service.devices) && service.devices.length > 0) {
			violations.push(`${where}: host devices are not allowed`);
		}
		if (Array.isArray(service.security_opt)) {
			for (const option of service.security_opt) {
				const value = String(option);
				if (/unconfined|label[:=]disable/.test(value)) {
					violations.push(`${where}: security_opt ${value} is not allowed`);
				}
			}
		}
		if (
			service.extends &&
			typeof service.extends === "object" &&
			"file" in (service.extends as object)
		) {
			violations.push(`${where}: extends from another file is not supported`);
		}
		if (Array.isArray(service.volumes)) {
			for (const volume of service.volumes) {
				const bind = volumeSource(volume);
				if (!bind) continue;
				if (bind.source.startsWith("/")) {
					const violation = bindMountViolation(bind.source);
					if (violation) violations.push(`${where}: ${violation}`);
				} else if (bind.source.startsWith("~")) {
					violations.push(
						`${where}: home-directory bind mounts are not allowed`,
					);
				} else if (path.posix.normalize(bind.source).startsWith("..")) {
					violations.push(
						`${where}: bind mounts must stay inside the project directory`,
					);
				}
			}
		}
		if (!allowTraefikLabels) {
			for (const label of [
				...labelKeys(service.labels),
				...labelKeys(service.deploy?.labels),
			]) {
				if (
					label.startsWith("traefik.") &&
					!ALWAYS_ALLOWED_TRAEFIK_LABELS.has(label) &&
					!isGeneratedTraefikLabel(label, context)
				) {
					violations.push(
						`${where}: label ${label} is managed by LaunchForge; add a domain instead`,
					);
				}
			}
		}
	}
	return violations;
};

export const assertComposeAllowed = (
	spec: Parameters<typeof composePolicyViolations>[0],
	context: ComposePolicyContext,
) => {
	const violations = composePolicyViolations(spec, context);
	if (violations.length > 0) {
		throw new WorkloadPolicyError(
			`Compose file rejected by the workload policy:\n- ${violations.join("\n- ")}`,
		);
	}
};
