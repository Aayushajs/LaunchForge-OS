import { db } from "@dokploy/server/db";
import { account, github, gitProvider } from "@dokploy/server/db/schema";
import { Octokit } from "octokit";
import { and, eq } from "drizzle-orm";

/** Asked for on "Sign in with GitHub" so the same account can deploy repositories. */
export const GITHUB_REPO_SCOPES = ["repo"];

const findGithubAccount = (userId: string) =>
	db.query.account.findFirst({
		where: and(eq(account.userId, userId), eq(account.providerId, "github")),
	});

/** A valid OAuth token for the GitHub account behind an account row. */
export const getGithubOauthToken = async (accountRowId: string) => {
	const row = await db.query.account.findFirst({
		where: eq(account.id, accountRowId),
		columns: { userId: true, accountId: true, providerId: true },
	});
	if (!row || row.providerId !== "github") {
		throw new Error(
			"The GitHub account behind this provider is no longer connected. Sign in with GitHub again.",
		);
	}
	// Imported lazily: lib/auth pulls in most services, including this one.
	const { auth } = await import("../lib/auth");
	const { accessToken } = await auth.getAccessToken({
		body: {
			providerId: "github",
			userId: row.userId,
			accountId: row.accountId,
		},
	});
	if (!accessToken) {
		throw new Error(
			"GitHub did not return an access token. Sign in with GitHub again.",
		);
	}
	return accessToken;
};

/**
 * Octokit auth strategy backed by a sign-in account. The token is looked up
 * per request so a fresh sign-in (which replaces it) takes effect at once.
 */
export const createGithubOauthAuth = ({
	accountRowId,
}: {
	accountRowId: string;
}) => {
	const auth = async () => ({
		type: "token" as const,
		tokenType: "oauth" as const,
		token: await getGithubOauthToken(accountRowId),
	});
	const hook = async (
		request: ((options: Record<string, unknown>) => Promise<unknown>) & {
			endpoint: {
				merge: (
					route: unknown,
					parameters?: unknown,
				) => { headers: Record<string, string> } & Record<string, unknown>;
			};
		},
		route: unknown,
		parameters?: unknown,
	) => {
		const endpoint = request.endpoint.merge(route, parameters);
		endpoint.headers.authorization = `token ${(await auth()).token}`;
		return request(endpoint);
	};
	return Object.assign(auth, { hook });
};

/** Whether the scopes GitHub granted include private repository access. */
const hasRepoScope = (scope: string | null | undefined) =>
	!!scope?.split(/[ ,]+/).includes("repo");

/**
 * Makes the GitHub account a user signed in with available as a Git provider
 * in their workspace, so its repositories can be deployed without setting up
 * a GitHub App. Returns the provider, or null when the user has no GitHub
 * sign-in.
 */
export const ensureGithubOauthProvider = async (
	userId: string,
	organizationId: string,
) => {
	const githubAccount = await findGithubAccount(userId);
	if (!githubAccount) return null;

	const existing = await db
		.select({ githubId: github.githubId })
		.from(github)
		.innerJoin(gitProvider, eq(gitProvider.gitProviderId, github.gitProviderId))
		.where(
			and(
				eq(github.githubOauthAccountId, githubAccount.id),
				eq(gitProvider.organizationId, organizationId),
			),
		)
		.then((rows) => rows[0]);
	if (existing) {
		return { githubId: existing.githubId, created: false };
	}

	const octokit = new Octokit({
		authStrategy: createGithubOauthAuth,
		auth: { accountRowId: githubAccount.id },
	});
	const { data: me } = await octokit.rest.users.getAuthenticated();

	const created = await db.transaction(async (tx) => {
		const provider = await tx
			.insert(gitProvider)
			.values({
				providerType: "github",
				organizationId,
				userId,
				name: `GitHub · ${me.login}`,
			})
			.returning()
			.then((rows) => rows[0]);
		if (!provider) throw new Error("Could not save the GitHub provider.");
		return await tx
			.insert(github)
			.values({
				gitProviderId: provider.gitProviderId,
				githubAppName: me.login,
				githubOauthAccountId: githubAccount.id,
			})
			.returning()
			.then((rows) => rows[0]);
	});
	return { githubId: created?.githubId ?? "", created: true };
};

/** What the dashboard shows about the signed-in user's GitHub connection. */
export const describeGithubConnection = async (userId: string) => {
	const githubAccount = await findGithubAccount(userId);
	return {
		connected: !!githubAccount,
		privateRepos: hasRepoScope(githubAccount?.scope),
	};
};
