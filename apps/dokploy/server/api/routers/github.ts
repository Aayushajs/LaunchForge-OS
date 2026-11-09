import {
	assertGitProviderAccess,
	authGithub,
	canViewGitProviderSecrets,
	createApplication,
	createDomain,
	createProject,
	findEnvironmentById,
	findGithubById,
	findProjectById,
	generateTraefikMeDomain,
	getWebServerSettings,
	getAccessibleGitProviderIds,
	getGithubBranches,
	getGithubRepositories,
	haveGithubRequirements,
	updateApplication,
	updateGithub,
	updateGitProvider,
} from "@dokploy/server";
import { db } from "@dokploy/server/db";
import { enabledSocialProviders } from "@dokploy/server/lib/auth";
import {
	describeGithubConnection,
	ensureGithubOauthProvider,
} from "@dokploy/server/services/github-oauth";
import {
	addNewEnvironment,
	addNewProject,
	addNewService,
	checkProjectAccess,
	checkServiceAccess,
} from "@dokploy/server/services/permission";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import {
	apiFindGithubBranches,
	apiFindOneGithub,
	apiUpdateGithub,
} from "@/server/db/schema";
import type { DeploymentJob } from "@/server/queues/queue-types";
import { myQueue } from "@/server/queues/queueSetup";
import { isPublicHost } from "@/utils/public-host";

// Most frameworks and Nixpacks/Railpack images listen on $PORT, so imports
// set it and route the generated domain to the same port.
const DEFAULT_APP_PORT = 3000;

const requestOrigin = (
	headers: Record<string, string | string[] | undefined>,
) => {
	const first = (value: string | string[] | undefined) =>
		(Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim();
	const host = first(headers["x-forwarded-host"]) ?? first(headers.host);
	if (!host) return null;
	const proto = first(headers["x-forwarded-proto"]) ?? "http";
	return `${proto}://${host}`;
};

export const githubRouter = createTRPCRouter({
	one: protectedProcedure
		.input(apiFindOneGithub)
		.query(async ({ input, ctx }) => {
			const github = await findGithubById(input.githubId);
			await assertGitProviderAccess(ctx.session, github.gitProvider);

			if (!(await canViewGitProviderSecrets(ctx.session, github.gitProvider))) {
				return {
					...github,
					githubClientSecret: null,
					githubPrivateKey: null,
					githubWebhookSecret: null,
				};
			}

			return github;
		}),
	getGithubRepositories: protectedProcedure
		.input(apiFindOneGithub)
		.query(async ({ input, ctx }) => {
			const github = await findGithubById(input.githubId);
			await assertGitProviderAccess(ctx.session, github.gitProvider);
			return await getGithubRepositories(input.githubId);
		}),
	getGithubBranches: protectedProcedure
		.input(apiFindGithubBranches)
		.query(async ({ input, ctx }) => {
			if (input.githubId) {
				const github = await findGithubById(input.githubId);
				await assertGitProviderAccess(ctx.session, github.gitProvider);
			}
			return await getGithubBranches(input);
		}),
	githubProviders: protectedProcedure.query(async ({ ctx }) => {
		const accessibleIds = await getAccessibleGitProviderIds(ctx.session);

		let result = await db.query.github.findMany({
			with: {
				gitProvider: true,
			},
		});

		result = result.filter(
			(provider) =>
				provider.gitProvider.organizationId ===
					ctx.session.activeOrganizationId &&
				accessibleIds.has(provider.gitProvider.gitProviderId),
		);

		const filtered = result
			.filter((provider) => haveGithubRequirements(provider))
			.map((provider) => {
				return {
					githubId: provider.githubId,
					githubUrl: provider.githubUrl,
					gitProvider: {
						...provider.gitProvider,
					},
				};
			});

		return filtered;
	}),

	testConnection: protectedProcedure
		.input(apiFindOneGithub)
		.mutation(async ({ input, ctx }) => {
			try {
				const github = await findGithubById(input.githubId);
				await assertGitProviderAccess(ctx.session, github.gitProvider);
				const result = await getGithubRepositories(input.githubId);
				return `Found ${result.length} repositories`;
			} catch (err) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: err instanceof Error ? err?.message : `Error: ${err}`,
				});
			}
		}),
	update: withPermission("gitProviders", "create")
		.input(apiUpdateGithub)
		.mutation(async ({ input, ctx }) => {
			await updateGitProvider(input.gitProviderId, {
				name: input.name,
				organizationId: ctx.session.activeOrganizationId,
			});

			await updateGithub(input.githubId, {
				...input,
			});

			await audit(ctx, {
				action: "update",
				resourceType: "gitProvider",
				resourceId: input.gitProviderId,
				resourceName: input.name,
			});
		}),
	/**
	 * The GitHub account the user signed in with, turned into a Git provider
	 * for the active workspace the first time it is asked for.
	 */
	connection: protectedProcedure.query(async ({ ctx }) => {
		const signInEnabled = enabledSocialProviders().includes("github");
		const status = await describeGithubConnection(ctx.user.id);
		if (!status.connected) {
			return { ...status, signInEnabled, githubId: null, error: null };
		}
		try {
			const provider = await ensureGithubOauthProvider(
				ctx.user.id,
				ctx.session.activeOrganizationId,
			);
			return {
				...status,
				signInEnabled,
				githubId: provider?.githubId ?? null,
				error: null,
			};
		} catch (error) {
			return {
				...status,
				signInEnabled,
				githubId: null,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}),

	/**
	 * One-click deploy of a repository: a project named after it (unless an
	 * environment is given), an application with the repository as source,
	 * PORT and a generated domain, a push webhook when the dashboard is
	 * reachable from GitHub, and the first deployment.
	 */
	importRepository: protectedProcedure
		.input(
			z.object({
				githubId: z.string().min(1),
				owner: z.string().min(1),
				repository: z.string().min(1),
				branch: z.string().min(1),
				environmentId: z.string().min(1).optional(),
				port: z.number().int().min(1).max(65535).default(DEFAULT_APP_PORT),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const github = await findGithubById(input.githubId);
			await assertGitProviderAccess(ctx.session, github.gitProvider);
			if ((await getWebServerSettings())?.remoteServersOnly) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"This server only runs apps on remote servers. Create the application from a project and pick a server.",
				});
			}

			let environmentId = input.environmentId;
			let projectId: string;
			if (environmentId) {
				const environment = await findEnvironmentById(environmentId);
				const project = await findProjectById(environment.projectId);
				if (project.organizationId !== ctx.session.activeOrganizationId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this project",
					});
				}
				projectId = project.projectId;
			} else {
				await checkProjectAccess(ctx, "create");
				const created = await createProject(
					{
						name: input.repository,
						description: `${input.owner}/${input.repository}`,
					},
					ctx.session.activeOrganizationId,
				);
				await addNewProject(ctx, created.project.projectId);
				await addNewEnvironment(ctx, created.environment.environmentId);
				projectId = created.project.projectId;
				environmentId = created.environment.environmentId;
			}
			await checkServiceAccess(ctx, projectId, "create");

			const application = await createApplication({
				name: input.repository,
				appName: input.repository,
				description: `${input.owner}/${input.repository} (${input.branch})`,
				environmentId,
			});
			await addNewService(ctx, application.applicationId);

			await updateApplication(application.applicationId, {
				sourceType: "github",
				githubId: input.githubId,
				owner: input.owner,
				repository: input.repository,
				branch: input.branch,
				buildPath: "/",
				triggerType: "push",
				autoDeploy: true,
				env: `PORT=${input.port}`,
				applicationStatus: "idle",
			});

			const host = await generateTraefikMeDomain(
				application.appName,
				ctx.user.ownerId,
			);
			const domain = await createDomain({
				host,
				port: input.port,
				https: false,
				applicationId: application.applicationId,
				domainType: "application",
			});

			let autoDeployOnPush = !github.githubOauthAccountId;
			const origin = requestOrigin(ctx.req.headers);
			if (
				github.githubOauthAccountId &&
				origin &&
				isPublicHost(new URL(origin).hostname)
			) {
				try {
					await authGithub(github).rest.repos.createWebhook({
						owner: input.owner,
						repo: input.repository,
						events: ["push"],
						config: {
							url: `${origin}/api/deploy/${application.refreshToken}`,
							content_type: "json",
							secret: application.refreshToken ?? undefined,
						},
					});
					autoDeployOnPush = true;
				} catch (error) {
					console.warn("Could not create the GitHub push webhook:", error);
				}
			}

			const jobData: DeploymentJob = {
				applicationId: application.applicationId,
				titleLog: `Import ${input.owner}/${input.repository}`,
				descriptionLog: "",
				type: "deploy",
				applicationType: "application",
				server: false,
			};
			await myQueue.add(
				"deployments",
				{ ...jobData },
				{ removeOnComplete: true, removeOnFail: true },
			);

			await audit(ctx, {
				action: "create",
				resourceType: "service",
				resourceId: application.applicationId,
				resourceName: application.appName,
			});

			return {
				applicationId: application.applicationId,
				projectId,
				environmentId,
				url: `http://${domain.host}`,
				autoDeployOnPush,
			};
		}),
});
