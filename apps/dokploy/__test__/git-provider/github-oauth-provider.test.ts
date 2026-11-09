import { describe, expect, it, vi } from "vitest";

const getAccessToken = vi.hoisted(() => vi.fn());

vi.mock("@dokploy/server/lib/auth", () => ({
	auth: { getAccessToken },
}));

const { db } = await import("@dokploy/server/db");
const { createGithubOauthAuth, ensureGithubOauthProvider } = await import(
	"@dokploy/server/services/github-oauth"
);
const { haveGithubRequirements } = await import(
	"@dokploy/server/utils/providers/github"
);

const findFirst = db.query.account.findFirst as ReturnType<typeof vi.fn>;

describe("GitHub provider from a sign-in account", () => {
	it("counts as configured without a GitHub App", () => {
		const base = {
			githubAppId: null,
			githubPrivateKey: null,
			githubInstallationId: null,
		};
		expect(
			haveGithubRequirements({
				...base,
				githubOauthAccountId: "acc-1",
			} as never),
		).toBe(true);
		expect(
			haveGithubRequirements({ ...base, githubOauthAccountId: null } as never),
		).toBe(false);
	});

	it("is not created for someone who never signed in with GitHub", async () => {
		findFirst.mockResolvedValueOnce(undefined);
		await expect(ensureGithubOauthProvider("user-1", "org-1")).resolves.toBe(
			null,
		);
	});

	it("authorises each request with the sign-in account's current token", async () => {
		findFirst.mockResolvedValue({
			userId: "user-1",
			accountId: "12345",
			providerId: "github",
		});
		getAccessToken.mockResolvedValue({ accessToken: "gho_fresh" });

		const auth = createGithubOauthAuth({ accountRowId: "acc-1" });
		const request = Object.assign(
			vi.fn(async (endpoint: { headers: Record<string, string> }) => endpoint),
			{
				endpoint: {
					merge: (route: unknown) => ({ route, headers: {} }),
				},
			},
		);
		const sent = (await auth.hook(request as never, "GET /user/repos")) as {
			headers: Record<string, string>;
		};

		expect(sent.headers.authorization).toBe("token gho_fresh");
		expect(getAccessToken).toHaveBeenCalledWith({
			body: { providerId: "github", userId: "user-1", accountId: "12345" },
		});
	});

	it("explains what to do when the sign-in account is gone", async () => {
		findFirst.mockResolvedValue(undefined);
		const auth = createGithubOauthAuth({ accountRowId: "acc-gone" });
		await expect(auth()).rejects.toThrow("Sign in with GitHub again");
	});
});
