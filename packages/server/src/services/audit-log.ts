import { and, count, desc, eq, gte, ilike, lte, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
	type AuditAction,
	type AuditResourceType,
	auditLog,
} from "../db/schema/audit-log";

export interface CreateAuditLogInput {
	organizationId: string | null;
	userId: string | null;
	userEmail: string;
	userRole: string;
	action: AuditAction;
	resourceType: AuditResourceType;
	resourceId?: string;
	resourceName?: string;
	metadata?: Record<string, unknown>;
}

export const createAuditLog = async (input: CreateAuditLogInput) => {
	try {
		await db.insert(auditLog).values({
			organizationId: input.organizationId,
			userId: input.userId,
			userEmail: input.userEmail,
			userRole: input.userRole,
			action: input.action,
			resourceType: input.resourceType,
			resourceId: input.resourceId ?? null,
			resourceName: input.resourceName ?? null,
			metadata: input.metadata ? JSON.stringify(input.metadata) : null,
		});
	} catch (error) {
		// Audit writes run inside user-facing mutations; a failed write must not
		// roll back or fail the operation that was already performed.
		console.error("Failed to write audit log", error);
	}
};

export interface GetAuditLogsInput {
	organizationId: string;
	limit: number;
	offset: number;
	action?: AuditAction;
	resourceType?: AuditResourceType;
	userEmail?: string;
	from?: Date;
	to?: Date;
}

export const getAuditLogs = async (input: GetAuditLogsInput) => {
	const conditions: SQL[] = [eq(auditLog.organizationId, input.organizationId)];
	if (input.action) conditions.push(eq(auditLog.action, input.action));
	if (input.resourceType) {
		conditions.push(eq(auditLog.resourceType, input.resourceType));
	}
	if (input.userEmail) {
		conditions.push(ilike(auditLog.userEmail, `%${input.userEmail}%`));
	}
	if (input.from) conditions.push(gte(auditLog.createdAt, input.from));
	if (input.to) conditions.push(lte(auditLog.createdAt, input.to));

	const where = and(...conditions);

	const [logs, totals] = await Promise.all([
		db
			.select()
			.from(auditLog)
			.where(where)
			.orderBy(desc(auditLog.createdAt))
			.limit(input.limit)
			.offset(input.offset),
		db.select({ total: count() }).from(auditLog).where(where),
	]);

	return { logs, total: totals[0]?.total ?? 0 };
};
