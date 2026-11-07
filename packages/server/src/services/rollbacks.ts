import type { CreateServiceOptions } from "dockerode";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../db";
import {
	type createRollbackSchema,
	deployments as deploymentsSchema,
	rollbacks,
} from "../db/schema";
import { decryptValue, encryptValue } from "../lib/encryption";
import { getRegistryTag } from "../utils/cluster/upload";
import {
	calculateResources,
	generateBindMounts,
	generateConfigContainer,
	generateVolumeMounts,
	prepareEnvironmentVariables,
} from "../utils/docker/utils";
import { execAsync, execAsyncRemote } from "../utils/process/execAsync";
import { getRemoteDocker } from "../utils/servers/remote-docker";
import { withResolvedVaultRefs } from "../utils/vault";
import { type Application, findApplicationById } from "./application";
import { findDeploymentById } from "./deployment";
import type { Environment } from "./environment";
import type { Mount } from "./mount";
import { resolveServiceNetworks } from "./network";
import type { Port } from "./port";
import type { Project } from "./project";
import {
	dockerLogin,
	findRegistryByIdWithCredentials,
	type Registry,
} from "./registry";

const SNAPSHOT_SECRET_FIELDS = [
	"env",
	"previewEnv",
	"buildArgs",
	"buildSecrets",
	"previewBuildArgs",
	"previewBuildSecrets",
	"password",
] as const;

type Snapshot = Record<string, unknown> & {
	environment?: { env?: string | null; project?: { env?: string | null } };
};

const mapSecrets = (snapshot: Snapshot, fn: (value: string) => string) => {
	const out: Snapshot = { ...snapshot };
	for (const field of SNAPSHOT_SECRET_FIELDS) {
		const value = out[field];
		if (typeof value === "string" && value) out[field] = fn(value);
	}
	if (out.environment) {
		const environment = { ...out.environment };
		if (environment.env) environment.env = fn(environment.env);
		if (environment.project?.env) {
			environment.project = {
				...environment.project,
				env: fn(environment.project.env),
			};
		}
		out.environment = environment;
	}
	return out;
};

/**
 * Rollback snapshots live in a jsonb column, outside the column-level
 * encryption. Secrets are encrypted inside the snapshot and registry
 * credentials are dropped entirely; they are re-read by id at rollback time.
 */
export const sealRollbackContext = (application: Record<string, unknown>) => {
	const {
		registry: _registry,
		buildRegistry: _buildRegistry,
		rollbackRegistry: _rollbackRegistry,
		...rest
	} = application;
	return mapSecrets(rest as Snapshot, encryptValue);
};

export const openRollbackContext = async <
	T extends { rollbackRegistryId?: string | null },
>(
	snapshot: T,
): Promise<T & { rollbackRegistry?: Registry | null }> => {
	const opened = mapSecrets(
		snapshot as unknown as Snapshot,
		decryptValue,
	) as unknown as T;
	const rollbackRegistry = snapshot.rollbackRegistryId
		? await findRegistryByIdWithCredentials(snapshot.rollbackRegistryId)
		: null;
	return { ...opened, rollbackRegistry };
};

export const createRollback = async (
	input: z.infer<typeof createRollbackSchema>,
) => {
	return await db.transaction(async (tx) => {
		const { fullContext, ...other } = input;
		const rollback = await tx
			.insert(rollbacks)
			.values(other)
			.returning()
			.then((res) => res[0]);

		if (!rollback) {
			throw new Error("Failed to create rollback");
		}

		const tagImage = `${input.appName}:v${rollback.version}`;
		const deployment = await findDeploymentById(rollback.deploymentId);

		if (!deployment?.applicationId) {
			throw new Error("Deployment not found");
		}

		const {
			deployments: _,
			bitbucket,
			github,
			gitlab,
			gitea,
			...rest
		} = await findApplicationById(deployment.applicationId);

		await tx
			.update(rollbacks)
			.set({
				image: tagImage,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				fullContext: sealRollbackContext(rest) as any,
			})
			.where(eq(rollbacks.rollbackId, rollback.rollbackId));

		// Update the deployment to reference this rollback
		await tx
			.update(deploymentsSchema)
			.set({
				rollbackId: rollback.rollbackId,
			})
			.where(eq(deploymentsSchema.deploymentId, rollback.deploymentId));

		const updatedRollback = await tx.query.rollbacks.findFirst({
			where: eq(rollbacks.rollbackId, rollback.rollbackId),
		});

		return updatedRollback;
	});
};

export const findRollbackById = async (rollbackId: string) => {
	const result = await db.query.rollbacks.findFirst({
		where: eq(rollbacks.rollbackId, rollbackId),
		with: {
			deployment: true,
		},
	});

	if (!result) {
		throw new Error("Rollback not found");
	}

	return result;
};

const deleteRollbackImage = async (image: string, serverId?: string | null) => {
	const command = `docker image rm ${image} --force`;

	if (serverId) {
		await execAsyncRemote(serverId, command);
	} else {
		await execAsync(command);
	}
};

export const removeRollbackById = async (rollbackId: string) => {
	const rollback = await findRollbackById(rollbackId);

	if (!rollback) {
		throw new Error("Rollback not found");
	}

	if (rollback?.image) {
		try {
			const deployment = await findDeploymentById(rollback.deploymentId);

			if (!deployment?.applicationId) {
				throw new Error("Deployment not found");
			}

			const application = await findApplicationById(deployment.applicationId);
			await deleteRollbackImage(rollback.image, application.serverId);

			await db
				.delete(rollbacks)
				.where(eq(rollbacks.rollbackId, rollbackId))
				.returning()
				.then((res) => res[0]);
		} catch (error) {
			console.error(error);
		}
	}

	return rollback;
};

export const rollback = async (rollbackId: string) => {
	const result = await findRollbackById(rollbackId);

	const deployment = await findDeploymentById(result.deploymentId);

	if (!deployment?.applicationId) {
		throw new Error("Deployment not found");
	}

	const application = await findApplicationById(deployment.applicationId);

	if (!result.fullContext) {
		throw new Error("Rollback context not found");
	}
	await rollbackApplication(
		application.appName,
		result.image || "",
		application.serverId,
		result.fullContext,
	);
};

const rollbackApplication = async (
	appName: string,
	image: string,
	serverId?: string | null,
	fullContext?: Application & {
		environment: Environment & {
			project: Project;
		};
		mounts: Mount[];
		ports: Port[];
		rollbackRegistry?: Registry | null;
	},
) => {
	if (!fullContext) {
		throw new Error("Full context is required for rollback");
	}

	const resolvedContext = await withResolvedVaultRefs(
		await openRollbackContext(fullContext),
	);

	const rollbackRegistry = resolvedContext.rollbackRegistry ?? undefined;

	// Ensure Docker daemon is authenticated with the rollback registry
	// before updating the swarm service. The authconfig in CreateServiceOptions
	// alone is not sufficient — Docker Swarm also relies on the daemon's
	// cached credentials (~/.docker/config.json) to distribute auth to nodes.
	if (rollbackRegistry) {
		await dockerLogin(
			rollbackRegistry.registryUrl,
			rollbackRegistry.username,
			rollbackRegistry.password,
			serverId,
		);
	}

	const docker = await getRemoteDocker(serverId);

	const {
		env,
		mounts,
		cpuLimit,
		memoryLimit,
		memoryReservation,
		cpuReservation,
		command,
		ports,
	} = resolvedContext;

	const resources = calculateResources({
		memoryLimit,
		memoryReservation,
		cpuLimit,
		cpuReservation,
	});

	const volumesMount = generateVolumeMounts(mounts);

	const resolvedNetworks = await resolveServiceNetworks(
		resolvedContext as Parameters<typeof resolveServiceNetworks>[0],
	);

	const {
		HealthCheck,
		RestartPolicy,
		Placement,
		Labels,
		Mode,
		RollbackConfig,
		UpdateConfig,
		Ulimits,
	} = generateConfigContainer(
		resolvedContext as Parameters<typeof generateConfigContainer>[0],
	);

	const bindsMount = generateBindMounts(mounts);
	const envVariables = prepareEnvironmentVariables(
		env,
		resolvedContext.environment.project.env,
		resolvedContext.environment.env,
	);

	let rollbackImage = image;
	if (rollbackRegistry) {
		rollbackImage = getRegistryTag(rollbackRegistry, image);
	}

	const settings: CreateServiceOptions = {
		authconfig: {
			password: rollbackRegistry?.password || "",
			username: rollbackRegistry?.username || "",
			serveraddress: rollbackRegistry?.registryUrl || "",
		},
		Name: appName,
		TaskTemplate: {
			ContainerSpec: {
				HealthCheck,
				Image: rollbackImage,
				Env: envVariables,
				Mounts: [...volumesMount, ...bindsMount],
				...(command
					? {
							Command: ["/bin/sh"],
							Args: ["-c", command],
						}
					: {}),
				...(Ulimits && { Ulimits }),
				Labels,
			},
			Networks: resolvedNetworks,
			RestartPolicy,
			Placement,
			Resources: {
				...resources,
			},
		},
		Mode,
		RollbackConfig,
		EndpointSpec: {
			Ports: ports.map((port) => ({
				PublishMode: port.publishMode,
				Protocol: port.protocol,
				TargetPort: port.targetPort,
				PublishedPort: port.publishedPort,
			})),
		},
		UpdateConfig,
	};

	try {
		const service = docker.getService(appName);
		const inspect = await service.inspect();

		await service.update({
			version: Number.parseInt(inspect.Version.Index),
			...settings,
			TaskTemplate: {
				...settings.TaskTemplate,
				ForceUpdate: inspect.Spec.TaskTemplate.ForceUpdate + 1,
			},
		});
	} catch (error) {
		console.error(error);
		await docker.createService(settings);
	}
};
