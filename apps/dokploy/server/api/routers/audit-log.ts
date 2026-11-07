import type { AuditAction, AuditResourceType } from "@dokploy/server/db/schema";
import { getAuditLogs } from "@dokploy/server/services/audit-log";
import { z } from "zod";
import { createTRPCRouter, withPermission } from "../trpc";

export const auditLogRouter = createTRPCRouter({
	all: withPermission("auditLog", "read")
		.input(
			z.object({
				limit: z.number().int().min(1).max(200).default(50),
				offset: z.number().int().min(0).default(0),
				action: z.string().optional(),
				resourceType: z.string().optional(),
				userEmail: z.string().max(320).optional(),
				from: z.date().optional(),
				to: z.date().optional(),
			}),
		)
		.query(({ ctx, input }) =>
			getAuditLogs({
				organizationId: ctx.session.activeOrganizationId,
				limit: input.limit,
				offset: input.offset,
				action: input.action as AuditAction | undefined,
				resourceType: input.resourceType as AuditResourceType | undefined,
				userEmail: input.userEmail,
				from: input.from,
				to: input.to,
			}),
		),
});
