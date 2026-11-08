import { db } from "@dokploy/server/db";
import {
	applications,
	compose,
	domains,
	environments,
	libsql,
	mariadb,
	mongo,
	mysql,
	organization,
	postgres,
	projects,
	redis,
	workspaceQuota,
	workspaceUsage,
} from "@dokploy/server/db/schema";
import type { apiSetWorkspaceQuota } from "@dokploy/server/db/schema/workspace-quota";
import { TRPCError } from "@trpc/server";
import type { ResourceRequirements } from "dockerode";
import { and, asc, count, eq, gte, inArray, or } from "drizzle-orm";
import type { z } from "zod";

const MB = 1024 * 1024;
const NANO = 1_000_000_000;

export const defaultServiceMemoryBytes = () =>
	(Number(process.env.DEFAULT_SERVICE_MEMORY_MB) || 512) * MB;
export const defaultServiceNanoCpus = () =>
	Math.round((Number(process.env.DEFAULT_SERVICE_CPU) || 0.5) * NANO);

export class QuotaExceededError extends TRPCError {
	constructor(message: string) {
		super({ code: "FORBIDDEN", message });
	}
}

export const getWorkspaceQuota = async (organizationId: string) =>
	(await db.query.workspaceQuota.findFirst({
		where: eq(workspaceQuota.organizationId, organizationId),
	})) ?? null;

const envNumber = (name: string, fallback: number) => {
	const value = Number(process.env[name]);
	return Number.isFinite(value) && value > 0 ? value : fallback;
};

/** Quota for a workspace created through public sign-up. */
export const signupWorkspaceQuota = (organizationId: string) => ({
	organizationId,
	maxMemoryMb: envNumber("SIGNUP_QUOTA_MEMORY_MB", 1024),
	maxCpu: envNumber("SIGNUP_QUOTA_CPU", 1),
	maxApplications: envNumber("SIGNUP_QUOTA_APPLICATIONS", 3),
	maxDatabases: envNumber("SIGNUP_QUOTA_DATABASES", 2),
	maxDomains: envNumber("SIGNUP_QUOTA_DOMAINS", 5),
});

export const setWorkspaceQuota = async (
	input: z.infer<typeof apiSetWorkspaceQuota>,
) => {
	const values = { ...input, updatedAt: new Date() };
	const [row] = await db
		.insert(workspaceQuota)
		.values(values)
		.onConflictDoUpdate({ target: workspaceQuota.organizationId, set: values })
		.returning();
	return row;
};

const resourceTables = [
	{ table: applications, id: applications.applicationId, kind: "application" },
	{ table: postgres, id: postgres.postgresId, kind: "database" },
	{ table: mysql, id: mysql.mysqlId, kind: "database" },
	{ table: mariadb, id: mariadb.mariadbId, kind: "database" },
	{ table: mongo, id: mongo.mongoId, kind: "database" },
	{ table: redis, id: redis.redisId, kind: "database" },
	{ table: libsql, id: libsql.libsqlId, kind: "database" },
] as const;

const environmentIdsOf = async (organizationId: string) => {
	const rows = await db
		.select({ environmentId: environments.environmentId })
		.from(environments)
		.innerJoin(projects, eq(environments.projectId, projects.projectId))
		.where(eq(projects.organizationId, organizationId));
	return rows.map((row) => row.environmentId);
};

const organizationOfEnvironment = async (environmentId: string) => {
	const [row] = await db
		.select({ organizationId: projects.organizationId })
		.from(environments)
		.innerJoin(projects, eq(environments.projectId, projects.projectId))
		.where(eq(environments.environmentId, environmentId));
	return row?.organizationId;
};

const effectiveMemory = (limit: string | null) =>
	limit ? Number.parseInt(limit, 10) : defaultServiceMemoryBytes();
const effectiveCpu = (limit: string | null) =>
	limit ? Number.parseInt(limit, 10) : defaultServiceNanoCpus();

/**
 * Memory and CPU reserved by every service of a workspace, counting a
 * service without explicit limits at the default limit it would run with.
 */
export const workspaceAllocation = async (
	organizationId: string,
	excludeServiceId?: string,
) => {
	const environmentIds = await environmentIdsOf(organizationId);
	let memoryBytes = 0;
	let nanoCpus = 0;
	const counts = { application: 0, database: 0 };
	if (environmentIds.length === 0) return { memoryBytes, nanoCpus, counts };

	for (const { table, id, kind } of resourceTables) {
		const rows = await db
			.select({
				id,
				memoryLimit: table.memoryLimit,
				cpuLimit: table.cpuLimit,
			})
			.from(table)
			.where(inArray(table.environmentId, environmentIds));
		counts[kind] += rows.length;
		for (const row of rows) {
			if (row.id === excludeServiceId) continue;
			memoryBytes += effectiveMemory(row.memoryLimit);
			nanoCpus += effectiveCpu(row.cpuLimit);
		}
	}
	return { memoryBytes, nanoCpus, counts };
};

/**
 * Applies a workspace's quota to the resources a service is about to be
 * deployed with: services without explicit limits get the default limits
 * (so "unlimited" cannot be used to escape the quota), and the deploy is
 * rejected if the workspace's total would go over its CPU or memory quota.
 */
export const withWorkspaceQuota = async (
	organizationId: string,
	serviceId: string,
	resources: ResourceRequirements,
): Promise<ResourceRequirements> => {
	const quota = await getWorkspaceQuota(organizationId);
	if (!quota || (quota.maxMemoryMb === null && quota.maxCpu === null)) {
		return resources;
	}

	const memoryBytes =
		resources.Limits?.MemoryBytes || defaultServiceMemoryBytes();
	const nanoCpus = resources.Limits?.NanoCPUs || defaultServiceNanoCpus();
	const others = await workspaceAllocation(organizationId, serviceId);

	if (
		quota.maxMemoryMb !== null &&
		others.memoryBytes + memoryBytes > quota.maxMemoryMb * MB
	) {
		throw new QuotaExceededError(
			`Memory quota exceeded: this service needs ${Math.round(memoryBytes / MB)} MB but only ${Math.max(0, Math.round(quota.maxMemoryMb - others.memoryBytes / MB))} MB of the workspace's ${quota.maxMemoryMb} MB is left.`,
		);
	}
	if (
		quota.maxCpu !== null &&
		others.nanoCpus + nanoCpus > quota.maxCpu * NANO
	) {
		throw new QuotaExceededError(
			`CPU quota exceeded: this service needs ${(nanoCpus / NANO).toFixed(2)} CPU but only ${Math.max(0, quota.maxCpu - others.nanoCpus / NANO).toFixed(2)} of the workspace's ${quota.maxCpu} CPU is left.`,
		);
	}

	return {
		...resources,
		Limits: {
			...resources.Limits,
			MemoryBytes: memoryBytes,
			NanoCPUs: nanoCpus,
		},
	};
};

export const assertServiceCountQuota = async (
	environmentId: string,
	kind: "application" | "database",
) => {
	const organizationId = await organizationOfEnvironment(environmentId);
	if (!organizationId) return;
	const quota = await getWorkspaceQuota(organizationId);
	const max =
		kind === "application" ? quota?.maxApplications : quota?.maxDatabases;
	if (max === null || max === undefined) return;

	const { counts } = await workspaceAllocation(organizationId);
	const current =
		kind === "application"
			? counts.application + (await composeCount(organizationId))
			: counts.database;
	if (current >= max) {
		throw new QuotaExceededError(
			`This workspace can have at most ${max} ${kind === "application" ? "applications" : "databases"}.`,
		);
	}
};

const composeCount = async (organizationId: string) => {
	const environmentIds = await environmentIdsOf(organizationId);
	if (environmentIds.length === 0) return 0;
	const [row] = await db
		.select({ total: count() })
		.from(compose)
		.where(inArray(compose.environmentId, environmentIds));
	return row?.total ?? 0;
};

export const assertDomainCountQuota = async (organizationId: string) => {
	const quota = await getWorkspaceQuota(organizationId);
	if (quota?.maxDomains === null || quota?.maxDomains === undefined) return;
	const environmentIds = await environmentIdsOf(organizationId);
	if (environmentIds.length === 0) return;
	const [row] = await db
		.select({ total: count() })
		.from(domains)
		.leftJoin(
			applications,
			eq(domains.applicationId, applications.applicationId),
		)
		.leftJoin(compose, eq(domains.composeId, compose.composeId))
		.where(
			or(
				inArray(applications.environmentId, environmentIds),
				inArray(compose.environmentId, environmentIds),
			),
		);
	if ((row?.total ?? 0) >= quota.maxDomains) {
		throw new QuotaExceededError(
			`This workspace can have at most ${quota.maxDomains} domains.`,
		);
	}
};

/** The platform operator is the owner of the first organization created. */
export const isPlatformOperator = async (userId: string) => {
	const first = await db.query.organization.findFirst({
		orderBy: [asc(organization.createdAt)],
		columns: { ownerId: true },
	});
	return first?.ownerId === userId;
};

export const getWorkspaceUsageSummary = async (
	organizationId: string,
	hours = 24,
) => {
	const since = new Date(Date.now() - hours * 3600 * 1000);
	const [quota, allocation, usage] = await Promise.all([
		getWorkspaceQuota(organizationId),
		workspaceAllocation(organizationId),
		db
			.select()
			.from(workspaceUsage)
			.where(
				and(
					eq(workspaceUsage.organizationId, organizationId),
					gte(workspaceUsage.hour, since),
				),
			)
			.orderBy(asc(workspaceUsage.hour)),
	]);
	return {
		quota,
		allocation: {
			memoryMb: Math.round(allocation.memoryBytes / MB),
			cpu: allocation.nanoCpus / NANO,
			applications:
				allocation.counts.application + (await composeCount(organizationId)),
			databases: allocation.counts.database,
		},
		usage,
	};
};
