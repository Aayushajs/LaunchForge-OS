import { beforeEach, describe, expect, it, vi } from "vitest";

// Every id encodes the organization that owns it: "*-a" is org-a, "*-b" is org-b.
const orgOf = (id: string | undefined) =>
	id?.endsWith("-a") ? "org-a" : id?.endsWith("-b") ? "org-b" : undefined;

const idFromWhere = (where: unknown) => {
	const chunks = (where as { queryChunks?: unknown[] })?.queryChunks ?? [];
	const param = chunks.find(
		(c) => typeof (c as { value?: unknown })?.value === "string",
	) as { value: string } | undefined;
	return param?.value;
};

const ownedBy =
	<T extends object>(shape: (id: string, org: string) => T) =>
	({ where }: { where: unknown }) => {
		const id = idFromWhere(where);
		const org = orgOf(id);
		return Promise.resolve(id && org ? shape(id, org) : undefined);
	};

const member = {
	id: "member-1",
	role: "owner",
	userId: "user-1",
	organizationId: "org-a",
	accessedProjects: [] as string[],
	accessedServices: [] as string[],
	accessedEnvironments: [] as string[],
};

vi.mock("@dokploy/server/db", () => {
	const selectChain = {
		from: () => selectChain,
		innerJoin: () => selectChain,
		where: (where: unknown) => {
			const id = idFromWhere(where);
			const org = orgOf(id);
			return Promise.resolve(
				org
					? [{ organizationId: org, projectId: `project-${org.slice(-1)}` }]
					: [],
			);
		},
	};
	return {
		db: {
			select: vi.fn(() => selectChain),
			query: {
				member: { findFirst: vi.fn(() => Promise.resolve(member)) },
				organizationRole: { findMany: vi.fn(() => Promise.resolve([])) },
				projects: {
					findFirst: vi.fn(ownedBy((_, org) => ({ organizationId: org }))),
				},
				registry: {
					findFirst: vi.fn(ownedBy((_, org) => ({ organizationId: org }))),
				},
				sshKeys: {
					findFirst: vi.fn(ownedBy((_, org) => ({ organizationId: org }))),
				},
				github: {
					findFirst: vi.fn(
						ownedBy((id) => ({ gitProviderId: `provider-${id.slice(-1)}` })),
					),
				},
				gitlab: { findFirst: vi.fn(() => Promise.resolve(undefined)) },
				gitea: { findFirst: vi.fn(() => Promise.resolve(undefined)) },
				bitbucket: { findFirst: vi.fn(() => Promise.resolve(undefined)) },
			},
		},
	};
});

vi.mock("@dokploy/server/services/server", () => ({
	getAccessibleServerIds: vi.fn(() => Promise.resolve(new Set(["server-a"]))),
}));

vi.mock("@dokploy/server/services/git-provider", () => ({
	getAccessibleGitProviderIds: vi.fn(() =>
		Promise.resolve(new Set(["provider-a"])),
	),
}));

const { assertReferencesAccessible } = await import(
	"@dokploy/server/services/reference-access"
);

const ctx = {
	user: { id: "user-1" },
	session: { activeOrganizationId: "org-a" },
};

beforeEach(() => {
	member.role = "owner";
	member.accessedProjects = [];
});

describe("assertReferencesAccessible", () => {
	it("allows references owned by the caller's organization", async () => {
		await expect(
			assertReferencesAccessible(ctx, {
				applicationId: "app-a",
				serverId: "server-a",
				registryId: "registry-a",
				customGitSSHKeyId: "ssh-a",
				githubId: "github-a",
				environmentId: "env-a",
			}),
		).resolves.toBeUndefined();
	});

	it("ignores inputs without references", async () => {
		await expect(
			assertReferencesAccessible(ctx, { applicationId: "app-a", name: "x" }),
		).resolves.toBeUndefined();
	});

	it.each([
		["serverId", "server-b"],
		["buildServerId", "server-b"],
		["registryId", "registry-b"],
		["rollbackRegistryId", "registry-b"],
		["buildRegistryId", "registry-b"],
		["customGitSSHKeyId", "ssh-b"],
		["githubId", "github-b"],
		["environmentId", "env-b"],
	])("rejects a %s from another organization", async (key, value) => {
		await expect(
			assertReferencesAccessible(ctx, { applicationId: "app-a", [key]: value }),
		).rejects.toThrow();
	});

	it("rejects an unknown Git provider id", async () => {
		await expect(
			assertReferencesAccessible(ctx, { gitlabId: "gitlab-a" }),
		).rejects.toThrow();
	});

	it("rejects a target environment in a project the member cannot access", async () => {
		member.role = "member";
		member.accessedProjects = [];
		await expect(
			assertReferencesAccessible(ctx, { environmentId: "env-a" }),
		).rejects.toThrow();
	});
});
