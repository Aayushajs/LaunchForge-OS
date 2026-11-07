import { domainToASCII } from "node:url";
import { db } from "@dokploy/server/db";
import {
	applications,
	compose,
	domains,
	environments,
	previewDeployments,
	projects,
} from "@dokploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, ne, sql } from "drizzle-orm";

export const normalizeHost = (host: string) => {
	const trimmed = host.trim().toLowerCase().replace(/\.$/, "");
	return domainToASCII(trimmed) || trimmed;
};

export const normalizePath = (path?: string | null) => {
	const value = (path ?? "/").trim() || "/";
	return value.length > 1 ? value.replace(/\/+$/, "") : value;
};

export interface DomainTarget {
	applicationId?: string | null;
	composeId?: string | null;
	previewDeploymentId?: string | null;
}

const organizationsOfEnvironments = async (environmentIds: string[]) => {
	if (environmentIds.length === 0) return new Map<string, string>();
	const rows = await db
		.select({
			environmentId: environments.environmentId,
			organizationId: projects.organizationId,
		})
		.from(environments)
		.innerJoin(projects, eq(environments.projectId, projects.projectId))
		.where(inArray(environments.environmentId, environmentIds));
	return new Map(rows.map((row) => [row.environmentId, row.organizationId]));
};

const environmentOfTarget = async (target: DomainTarget) => {
	if (target.applicationId) {
		return (
			await db.query.applications.findFirst({
				where: eq(applications.applicationId, target.applicationId),
				columns: { environmentId: true },
			})
		)?.environmentId;
	}
	if (target.composeId) {
		return (
			await db.query.compose.findFirst({
				where: eq(compose.composeId, target.composeId),
				columns: { environmentId: true },
			})
		)?.environmentId;
	}
	if (target.previewDeploymentId) {
		const preview = await db.query.previewDeployments.findFirst({
			where: eq(
				previewDeployments.previewDeploymentId,
				target.previewDeploymentId,
			),
			with: { application: { columns: { environmentId: true } } },
		});
		return preview?.application?.environmentId;
	}
	return undefined;
};

/**
 * A hostname belongs to exactly one organization: the first workspace to
 * route it keeps it. Other workspaces on the same instance can no longer add
 * the host (or a path under it) and steal its traffic. Within the owning
 * organization the same host may be split by path, but each host+path pair
 * is routed to a single service.
 */
export const assertHostAvailable = async (
	host: string,
	path: string | null | undefined,
	target: DomainTarget,
	excludeDomainId?: string,
) => {
	const normalizedHost = normalizeHost(host);
	const normalizedPath = normalizePath(path);

	const existing = await db
		.select({
			domainId: domains.domainId,
			path: domains.path,
			applicationEnv: applications.environmentId,
			composeEnv: compose.environmentId,
			previewApplicationId: previewDeployments.applicationId,
		})
		.from(domains)
		.leftJoin(
			applications,
			eq(domains.applicationId, applications.applicationId),
		)
		.leftJoin(compose, eq(domains.composeId, compose.composeId))
		.leftJoin(
			previewDeployments,
			eq(domains.previewDeploymentId, previewDeployments.previewDeploymentId),
		)
		.where(
			and(
				eq(sql`lower(trim(trailing '.' from ${domains.host}))`, normalizedHost),
				excludeDomainId ? ne(domains.domainId, excludeDomainId) : undefined,
			),
		);

	if (existing.length === 0) return;

	const previewAppIds = existing
		.map((row) => row.previewApplicationId)
		.filter((id): id is string => !!id);
	const previewEnvs = previewAppIds.length
		? await db
				.select({
					applicationId: applications.applicationId,
					environmentId: applications.environmentId,
				})
				.from(applications)
				.where(inArray(applications.applicationId, previewAppIds))
		: [];
	const previewEnvByApp = new Map(
		previewEnvs.map((row) => [row.applicationId, row.environmentId]),
	);

	const ownerEnvironment = await environmentOfTarget(target);
	const environmentIds = [
		...existing.map(
			(row) =>
				row.applicationEnv ??
				row.composeEnv ??
				(row.previewApplicationId
					? previewEnvByApp.get(row.previewApplicationId)
					: undefined),
		),
		ownerEnvironment,
	].filter((id): id is string => !!id);
	const orgByEnvironment = await organizationsOfEnvironments(environmentIds);
	const ownerOrganization = ownerEnvironment
		? orgByEnvironment.get(ownerEnvironment)
		: undefined;

	for (const row of existing) {
		const environmentId =
			row.applicationEnv ??
			row.composeEnv ??
			(row.previewApplicationId
				? previewEnvByApp.get(row.previewApplicationId)
				: undefined);
		const rowOrganization = environmentId
			? orgByEnvironment.get(environmentId)
			: undefined;

		if (!ownerOrganization || rowOrganization !== ownerOrganization) {
			throw new TRPCError({
				code: "CONFLICT",
				message: `${normalizedHost} is already in use by another workspace`,
			});
		}
		if (normalizePath(row.path) === normalizedPath) {
			throw new TRPCError({
				code: "CONFLICT",
				message: `${normalizedHost}${normalizedPath === "/" ? "" : normalizedPath} is already routed to another service`,
			});
		}
	}
};
