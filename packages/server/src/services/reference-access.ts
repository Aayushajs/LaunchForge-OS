import { db } from "@dokploy/server/db";
import {
	bitbucket,
	gitea,
	github,
	gitlab,
	registry,
	sshKeys,
} from "@dokploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { getAccessibleGitProviderIds } from "./git-provider";
import {
	checkServiceTargetEnvironment,
	type PermissionCtx,
} from "./permission";
import { getAccessibleServerIds } from "./server";

/**
 * Foreign keys a caller can set on a service. Every one of them must point at
 * a resource the caller's organization owns; otherwise a service could be
 * wired to another tenant's Git installation, registry credentials, SSH key
 * or server.
 */
export interface ServiceReferences {
	environmentId?: string | null;
	serverId?: string | null;
	buildServerId?: string | null;
	registryId?: string | null;
	rollbackRegistryId?: string | null;
	buildRegistryId?: string | null;
	customGitSSHKeyId?: string | null;
	githubId?: string | null;
	gitlabId?: string | null;
	giteaId?: string | null;
	bitbucketId?: string | null;
}

const deny = (resource: string): never => {
	throw new TRPCError({
		code: "UNAUTHORIZED",
		message: `You are not authorized to use this ${resource}`,
	});
};

const findGitProviderId = async (
	kind: "github" | "gitlab" | "gitea" | "bitbucket",
	id: string,
) => {
	switch (kind) {
		case "github":
			return (
				await db.query.github.findFirst({
					where: eq(github.githubId, id),
					columns: { gitProviderId: true },
				})
			)?.gitProviderId;
		case "gitlab":
			return (
				await db.query.gitlab.findFirst({
					where: eq(gitlab.gitlabId, id),
					columns: { gitProviderId: true },
				})
			)?.gitProviderId;
		case "gitea":
			return (
				await db.query.gitea.findFirst({
					where: eq(gitea.giteaId, id),
					columns: { gitProviderId: true },
				})
			)?.gitProviderId;
		case "bitbucket":
			return (
				await db.query.bitbucket.findFirst({
					where: eq(bitbucket.bitbucketId, id),
					columns: { gitProviderId: true },
				})
			)?.gitProviderId;
	}
};

// Takes the raw procedure input; keys that aren't references are ignored.
export const assertReferencesAccessible = async (
	ctx: PermissionCtx,
	input: object,
) => {
	const refs = input as ServiceReferences;
	const session = {
		userId: ctx.user.id,
		activeOrganizationId: ctx.session.activeOrganizationId,
	};

	if (refs.environmentId) {
		await checkServiceTargetEnvironment(ctx, refs.environmentId);
	}

	const serverIds = [refs.serverId, refs.buildServerId].filter(
		(id): id is string => !!id,
	);
	if (serverIds.length > 0) {
		const accessible = await getAccessibleServerIds(session);
		for (const id of serverIds) {
			if (!accessible.has(id)) deny("server");
		}
	}

	const registryIds = [
		refs.registryId,
		refs.rollbackRegistryId,
		refs.buildRegistryId,
	].filter((id): id is string => !!id);
	for (const id of registryIds) {
		const row = await db.query.registry.findFirst({
			where: eq(registry.registryId, id),
			columns: { organizationId: true },
		});
		if (row?.organizationId !== session.activeOrganizationId) {
			deny("registry");
		}
	}

	if (refs.customGitSSHKeyId) {
		const row = await db.query.sshKeys.findFirst({
			where: eq(sshKeys.sshKeyId, refs.customGitSSHKeyId),
			columns: { organizationId: true },
		});
		if (row?.organizationId !== session.activeOrganizationId) {
			deny("SSH key");
		}
	}

	const providers = (
		[
			["github", refs.githubId],
			["gitlab", refs.gitlabId],
			["gitea", refs.giteaId],
			["bitbucket", refs.bitbucketId],
		] as const
	).filter(
		(entry): entry is readonly [(typeof entry)[0], string] => !!entry[1],
	);
	if (providers.length > 0) {
		const accessible = await getAccessibleGitProviderIds(session);
		for (const [kind, id] of providers) {
			const gitProviderId = await findGitProviderId(kind, id);
			if (!gitProviderId || !accessible.has(gitProviderId)) {
				deny("Git provider");
			}
		}
	}
};
