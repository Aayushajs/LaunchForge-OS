import {
	createDomain,
	findApplicationById,
	findDomainById,
	findDomainsByApplicationId,
	findDomainsByComposeId,
	findPreviewDeploymentById,
	findServerById,
	generateTraefikMeDomain,
	getServerIpCandidates,
	getWebServerSettings,
	manageDomain,
	removeDomain,
	removeDomainById,
	updateDomainById,
	validateDomain,
} from "@dokploy/server";
import { checkServicePermissionAndAccess } from "@dokploy/server/services/permission";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import {
	apiCreateDomain,
	apiFindCompose,
	apiFindDomain,
	apiFindOneApplication,
	apiUpdateDomain,
} from "@/server/db/schema";

type DomainAction = "create" | "read" | "delete";

/**
 * Every domain must be attached to a service the caller can manage. A domain
 * with no owning service (or an unknown type) is rejected instead of skipping
 * the check, which previously let any member create routes for any host.
 */
const assertDomainTargetAccess = async (
	ctx: Parameters<typeof checkServicePermissionAndAccess>[0],
	target: {
		domainType?: string | null;
		applicationId?: string | null;
		composeId?: string | null;
		previewDeploymentId?: string | null;
	},
	action: DomainAction,
) => {
	const permission = { domain: [action] };
	if (
		target.domainType === "preview" ||
		(!target.domainType &&
			target.previewDeploymentId &&
			!target.applicationId &&
			!target.composeId)
	) {
		if (!target.previewDeploymentId) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Preview deployment is required",
			});
		}
		const preview = await findPreviewDeploymentById(target.previewDeploymentId);
		await checkServicePermissionAndAccess(
			ctx,
			preview.applicationId,
			permission,
		);
		return;
	}
	const serviceId =
		target.domainType === "compose"
			? target.composeId
			: (target.applicationId ?? target.composeId);
	if (!serviceId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Domain must belong to a service",
		});
	}
	await checkServicePermissionAndAccess(ctx, serviceId, permission);
};

export const domainRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateDomain)
		.mutation(async ({ input, ctx }) => {
			try {
				await assertDomainTargetAccess(ctx, input, "create");
				const domain = await createDomain(input);
				await audit(ctx, {
					action: "create",
					resourceType: "domain",
					resourceId: domain.domainId,
					resourceName: domain.host,
				});
				return domain;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error
							? error.message
							: "Error creating the domain",
					cause: error,
				});
			}
		}),
	byApplicationId: protectedProcedure
		.input(apiFindOneApplication)
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.applicationId, {
				domain: ["read"],
			});
			return await findDomainsByApplicationId(input.applicationId);
		}),
	byComposeId: protectedProcedure
		.input(apiFindCompose)
		.query(async ({ input, ctx }) => {
			await checkServicePermissionAndAccess(ctx, input.composeId, {
				domain: ["read"],
			});
			return await findDomainsByComposeId(input.composeId);
		}),
	generateDomain: withPermission("domain", "create")
		.input(z.object({ appName: z.string(), serverId: z.string().optional() }))
		.mutation(async ({ input, ctx }) => {
			return generateTraefikMeDomain(
				input.appName,
				ctx.user.ownerId,
				input.serverId,
			);
		}),
	canGenerateTraefikMeDomains: withPermission("domain", "read")
		.input(z.object({ serverId: z.string() }))
		.query(async ({ input }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				return server.ipAddress;
			}
			const settings = await getWebServerSettings();
			return settings?.serverIp || "";
		}),

	update: protectedProcedure
		.input(apiUpdateDomain)
		.mutation(async ({ input, ctx }) => {
			const currentDomain = await findDomainById(input.domainId);
			await assertDomainTargetAccess(ctx, currentDomain, "create");

			const result = await updateDomainById(input.domainId, input);
			const domain = await findDomainById(input.domainId);
			await audit(ctx, {
				action: "update",
				resourceType: "domain",
				resourceId: domain.domainId,
				resourceName: domain.host,
			});
			if (domain.applicationId) {
				const application = await findApplicationById(domain.applicationId);
				await manageDomain(application, domain);
			} else if (domain.previewDeploymentId) {
				const previewDeployment = await findPreviewDeploymentById(
					domain.previewDeploymentId,
				);
				const application = await findApplicationById(
					previewDeployment.applicationId,
				);
				application.appName = previewDeployment.appName;
				await manageDomain(application, domain);
			}
			return result;
		}),
	toggleEnable: protectedProcedure
		.input(apiFindDomain)
		.mutation(async ({ input, ctx }) => {
			const currentDomain = await findDomainById(input.domainId);
			await assertDomainTargetAccess(ctx, currentDomain, "create");

			const result = await updateDomainById(input.domainId, {
				enabled: !currentDomain.enabled,
			});
			const domain = await findDomainById(input.domainId);
			await audit(ctx, {
				action: "update",
				resourceType: "domain",
				resourceId: domain.domainId,
				resourceName: domain.host,
			});

			// Applications apply instantly through the traefik file provider:
			// manageDomain creates the router when enabled and removes it when
			// disabled. Compose domains are docker labels and only change on the
			// next deployment, so we just persist the flag here.
			if (domain.applicationId) {
				const application = await findApplicationById(domain.applicationId);
				await manageDomain(application, domain);
			} else if (domain.previewDeploymentId) {
				const previewDeployment = await findPreviewDeploymentById(
					domain.previewDeploymentId,
				);
				const application = await findApplicationById(
					previewDeployment.applicationId,
				);
				application.appName = previewDeployment.appName;
				await manageDomain(application, domain);
			}

			return {
				...result,
				requiresRedeploy: domain.domainType === "compose",
			};
		}),
	one: protectedProcedure.input(apiFindDomain).query(async ({ input, ctx }) => {
		const domain = await findDomainById(input.domainId);
		await assertDomainTargetAccess(ctx, domain, "read");
		return domain;
	}),
	delete: protectedProcedure
		.input(apiFindDomain)
		.mutation(async ({ input, ctx }) => {
			const domain = await findDomainById(input.domainId);
			await assertDomainTargetAccess(ctx, domain, "delete");

			const result = await removeDomainById(input.domainId);
			await audit(ctx, {
				action: "delete",
				resourceType: "domain",
				resourceId: domain.domainId,
				resourceName: domain.host,
			});

			if (domain.applicationId) {
				const application = await findApplicationById(domain.applicationId);
				await removeDomain(application, domain.uniqueConfigKey);
			}

			return result;
		}),

	validateDomain: withPermission("domain", "read")
		.input(
			z.object({
				domain: z.string(),
				serverId: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (input.serverId) {
				const server = await findServerById(input.serverId);
				if (server.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this server",
					});
				}
			}

			const expectedIps = await getServerIpCandidates(input.serverId);
			return validateDomain(input.domain, expectedIps);
		}),
});
