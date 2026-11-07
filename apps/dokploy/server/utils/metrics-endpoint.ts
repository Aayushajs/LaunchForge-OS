import {
	findServerById,
	getAccessibleServerIds,
	getWebServerSettings,
} from "@dokploy/server";
import { db } from "@dokploy/server/db";
import {
	applications,
	compose,
	environments,
	libsql,
	mariadb,
	mongo,
	mysql,
	postgres,
	projects,
	redis,
} from "@dokploy/server/db/schema";
import {
	checkServiceAccess,
	type PermissionCtx,
} from "@dokploy/server/services/permission";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

export interface MetricsEndpoint {
	baseUrl: string;
	token: string;
}

/**
 * Resolves where the monitoring agent for a server listens. The URL and
 * token come from the database, never from the client: accepting them as
 * input let any member make the panel fetch arbitrary URLs (SSRF) and read
 * agent tokens.
 */
export const resolveMetricsEndpoint = async (
	ctx: PermissionCtx,
	serverId?: string,
): Promise<MetricsEndpoint> => {
	if (serverId) {
		const accessible = await getAccessibleServerIds({
			userId: ctx.user.id,
			activeOrganizationId: ctx.session.activeOrganizationId,
		});
		if (!accessible.has(serverId)) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "You are not authorized to access this server",
			});
		}
		const server = await findServerById(serverId);
		return {
			baseUrl: `http://${server.ipAddress}:${server.metricsConfig.server.port}`,
			token: server.metricsConfig.server.token,
		};
	}

	if (process.env.METRICS_URL) {
		return {
			baseUrl: process.env.METRICS_URL,
			token: process.env.METRICS_TOKEN ?? "",
		};
	}

	const settings = await getWebServerSettings();
	if (!settings?.serverIp) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Monitoring is not configured for this server",
		});
	}
	return {
		baseUrl: `http://${settings.serverIp}:${settings.metricsConfig.server.port}`,
		token: settings.metricsConfig.server.token,
	};
};

const serviceTables = [
	[applications, applications.applicationId, applications.appName],
	[compose, compose.composeId, compose.appName],
	[postgres, postgres.postgresId, postgres.appName],
	[mysql, mysql.mysqlId, mysql.appName],
	[mariadb, mariadb.mariadbId, mariadb.appName],
	[mongo, mongo.mongoId, mongo.appName],
	[redis, redis.redisId, redis.appName],
	[libsql, libsql.libsqlId, libsql.appName],
] as const;

/** Throws unless `appName` is a service the caller can read in their organization. */
export const assertAppNameAccessible = async (
	ctx: PermissionCtx,
	appName: string,
) => {
	for (const [table, idColumn, appNameColumn] of serviceTables) {
		const [row] = await db
			.select({ serviceId: idColumn })
			.from(table)
			.innerJoin(
				environments,
				eq(table.environmentId, environments.environmentId),
			)
			.innerJoin(projects, eq(environments.projectId, projects.projectId))
			.where(
				and(
					eq(appNameColumn, appName),
					eq(projects.organizationId, ctx.session.activeOrganizationId),
				),
			);
		if (row) {
			await checkServiceAccess(ctx, row.serviceId, "read");
			return;
		}
	}
	throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
};
