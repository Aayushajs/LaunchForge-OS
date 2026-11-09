import { db } from "@dokploy/server/db";
import { organization } from "@dokploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import { asc } from "drizzle-orm";
import { IS_CLOUD } from "../constants";
import type { PermissionCtx } from "./permission";
import { getAccessibleServerIds } from "./server";

/**
 * The platform workspace is the first one created, by the person who
 * installed LaunchForge. Only it may administer the host itself (Traefik,
 * Docker, Swarm, server settings); every other workspace is a tenant.
 */
export const getPlatformOrganizationId = async () => {
	const first = await db.query.organization.findFirst({
		orderBy: [asc(organization.createdAt)],
		columns: { id: true },
	});
	return first?.id ?? null;
};

export const isPlatformWorkspace = async (organizationId: string) =>
	!!organizationId && organizationId === (await getPlatformOrganizationId());

/**
 * Whether anyone may create an account. ALLOW_PUBLIC_SIGNUP pins it when set
 * ("true" or "false"); otherwise the switch in Settings, Sign-in & Email.
 */
export const isPublicSignupEnabled = async () => {
	const fromEnv = process.env.ALLOW_PUBLIC_SIGNUP;
	if (fromEnv !== undefined && fromEnv !== "") return fromEnv === "true";
	const settings = await db.query.webServerSettings
		.findFirst({ columns: { allowPublicSignup: true } })
		.catch(() => null);
	return !!settings?.allowPublicSignup;
};

export const isPublicSignupPinnedByEnv = () =>
	!!process.env.ALLOW_PUBLIC_SIGNUP;

/**
 * Guards an action on a Docker host. With a `serverId` the server must belong
 * to the caller's workspace; without one the action targets the machine
 * LaunchForge runs on, which only the platform workspace may touch.
 */
export const assertHostAccess = async (
	ctx: PermissionCtx,
	serverId: unknown,
) => {
	const organizationId = ctx.session.activeOrganizationId;

	if (typeof serverId === "string" && serverId) {
		const accessible = await getAccessibleServerIds({
			userId: ctx.user.id,
			activeOrganizationId: organizationId,
		});
		if (!accessible.has(serverId)) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You are not authorized to use this server",
			});
		}
		return;
	}

	if (IS_CLOUD) return;

	if (!(await isPlatformWorkspace(organizationId))) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message:
				"Only the platform workspace can manage the LaunchForge host. Use one of your own servers instead.",
		});
	}
};
