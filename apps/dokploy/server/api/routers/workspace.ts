import { db } from "@dokploy/server/db";
import { organization } from "@dokploy/server/db/schema";
import { apiSetWorkspaceQuota } from "@dokploy/server/db/schema/workspace-quota";
import {
	getWorkspaceUsageSummary,
	isPlatformOperator,
	setWorkspaceQuota,
} from "@dokploy/server/services/workspace-quota";
import { TRPCError } from "@trpc/server";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import { createTRPCRouter, protectedProcedure, withPermission } from "../trpc";

const operatorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	if (!(await isPlatformOperator(ctx.user.id))) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only the platform operator can manage workspace quotas",
		});
	}
	return next();
});

export const workspaceRouter = createTRPCRouter({
	usage: withPermission("monitoring", "read")
		.input(
			z
				.object({
					hours: z
						.number()
						.int()
						.min(1)
						.max(24 * 30),
				})
				.optional(),
		)
		.query(({ ctx, input }) =>
			getWorkspaceUsageSummary(ctx.session.activeOrganizationId, input?.hours),
		),

	isOperator: protectedProcedure.query(({ ctx }) =>
		isPlatformOperator(ctx.user.id),
	),

	all: operatorProcedure.query(async () => {
		const organizations = await db.query.organization.findMany({
			orderBy: [asc(organization.createdAt)],
			columns: { id: true, name: true, createdAt: true },
		});
		return Promise.all(
			organizations.map(async (org) => ({
				...org,
				...(await getWorkspaceUsageSummary(org.id, 24)),
			})),
		);
	}),

	setQuota: operatorProcedure
		.input(apiSetWorkspaceQuota)
		.mutation(async ({ ctx, input }) => {
			const quota = await setWorkspaceQuota(input);
			await audit(ctx, {
				action: "update",
				resourceType: "organization",
				resourceId: input.organizationId,
				resourceName: "quota",
				metadata: input,
			});
			return quota;
		}),
});
