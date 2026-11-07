import { db } from "@dokploy/server/db";
import { member, organizationRole } from "@dokploy/server/db/schema";
import { statements } from "@dokploy/server/lib/access-control";
import { TRPCError } from "@trpc/server";
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import { adminProcedure, createTRPCRouter, withPermission } from "../trpc";

// Mirrors `maximumRolesPerOrganization` in the Better Auth organization plugin config.
const MAX_CUSTOM_ROLES = 10;
const RESERVED_ROLES = new Set(["owner", "admin", "member"]);

const roleName = z
	.string()
	.trim()
	.regex(
		/^[a-z0-9][a-z0-9_-]{1,31}$/,
		"Use 2-32 lowercase letters, numbers, '-' or '_'",
	)
	.refine((name) => !RESERVED_ROLES.has(name), "This role name is reserved");

const permissionMap = z
	.record(z.string(), z.array(z.string()))
	.superRefine((permissions, ctx) => {
		for (const [resource, actions] of Object.entries(permissions)) {
			const allowed = statements[resource as keyof typeof statements] as
				| readonly string[]
				| undefined;
			if (!allowed) {
				ctx.addIssue({
					code: "custom",
					message: `Unknown resource "${resource}"`,
				});
				continue;
			}
			for (const action of actions) {
				if (!allowed.includes(action)) {
					ctx.addIssue({
						code: "custom",
						message: `Unknown action "${action}" for "${resource}"`,
					});
				}
			}
		}
	});

const findRole = (organizationId: string, role: string) =>
	db.query.organizationRole.findFirst({
		where: and(
			eq(organizationRole.organizationId, organizationId),
			eq(organizationRole.role, role),
		),
	});

export const customRoleRouter = createTRPCRouter({
	all: withPermission("member", "read").query(async ({ ctx }) => {
		const roles = await db.query.organizationRole.findMany({
			where: eq(
				organizationRole.organizationId,
				ctx.session.activeOrganizationId,
			),
			orderBy: [asc(organizationRole.role)],
		});
		return roles.map((r) => ({
			id: r.id,
			role: r.role,
			permissions: JSON.parse(r.permission) as Record<string, string[]>,
			createdAt: r.createdAt,
		}));
	}),

	getStatements: adminProcedure.query(() => statements),

	create: adminProcedure
		.input(z.object({ role: roleName, permissions: permissionMap }))
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.session.activeOrganizationId;
			if (await findRole(organizationId, input.role)) {
				throw new TRPCError({
					code: "CONFLICT",
					message: `Role "${input.role}" already exists`,
				});
			}
			const [existing] = await db
				.select({ total: count() })
				.from(organizationRole)
				.where(eq(organizationRole.organizationId, organizationId));
			if ((existing?.total ?? 0) >= MAX_CUSTOM_ROLES) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `An organization can have at most ${MAX_CUSTOM_ROLES} custom roles`,
				});
			}

			const [created] = await db
				.insert(organizationRole)
				.values({
					organizationId,
					role: input.role,
					permission: JSON.stringify(input.permissions),
				})
				.returning();

			await audit(ctx, {
				action: "create",
				resourceType: "customRole",
				resourceId: created?.id,
				resourceName: input.role,
			});
			return created;
		}),

	update: adminProcedure
		.input(z.object({ role: roleName, permissions: permissionMap }))
		.mutation(async ({ ctx, input }) => {
			const existing = await findRole(
				ctx.session.activeOrganizationId,
				input.role,
			);
			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
			}

			const [updated] = await db
				.update(organizationRole)
				.set({ permission: JSON.stringify(input.permissions) })
				.where(eq(organizationRole.id, existing.id))
				.returning();

			await audit(ctx, {
				action: "update",
				resourceType: "customRole",
				resourceId: existing.id,
				resourceName: input.role,
			});
			return updated;
		}),

	remove: adminProcedure
		.input(z.object({ role: roleName }))
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.session.activeOrganizationId;
			const existing = await findRole(organizationId, input.role);
			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
			}

			const [assigned] = await db
				.select({ total: count() })
				.from(member)
				.where(
					and(
						eq(member.organizationId, organizationId),
						eq(member.role, input.role),
					),
				);
			if ((assigned?.total ?? 0) > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Reassign the members using this role before deleting it",
				});
			}

			await db
				.delete(organizationRole)
				.where(eq(organizationRole.id, existing.id));

			await audit(ctx, {
				action: "delete",
				resourceType: "customRole",
				resourceId: existing.id,
				resourceName: input.role,
			});
			return true;
		}),
});
