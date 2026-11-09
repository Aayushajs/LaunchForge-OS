import { db } from "@dokploy/server/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@dokploy/server/services/server", () => ({
	getAccessibleServerIds: vi.fn(
		async ({ activeOrganizationId }: { activeOrganizationId: string }) =>
			new Set(activeOrganizationId === "org-tenant" ? ["server-tenant"] : []),
	),
}));

const { assertHostAccess, isPlatformWorkspace, isPublicSignupEnabled } =
	await import("@dokploy/server/services/platform");
const { signupWorkspaceQuota } = await import(
	"@dokploy/server/services/workspace-quota"
);

const findFirst = db.query.organization.findFirst as ReturnType<typeof vi.fn>;

const ctx = (organizationId: string) => ({
	user: { id: "user-1" },
	session: { activeOrganizationId: organizationId },
});

beforeEach(() => {
	findFirst.mockReset().mockResolvedValue({ id: "org-platform" });
});

afterEach(() => {
	delete process.env.ALLOW_PUBLIC_SIGNUP;
	delete process.env.SIGNUP_QUOTA_MEMORY_MB;
});

describe("host access", () => {
	it("treats the first workspace as the platform workspace", async () => {
		await expect(isPlatformWorkspace("org-platform")).resolves.toBe(true);
		await expect(isPlatformWorkspace("org-tenant")).resolves.toBe(false);
	});

	it("lets the platform workspace administer the LaunchForge host", async () => {
		await expect(
			assertHostAccess(ctx("org-platform"), undefined),
		).resolves.toBeUndefined();
	});

	it("keeps tenant workspaces away from the LaunchForge host", async () => {
		await expect(
			assertHostAccess(ctx("org-tenant"), undefined),
		).rejects.toThrow(/Only the platform workspace/);
		await expect(assertHostAccess(ctx("org-tenant"), "")).rejects.toThrow(
			/Only the platform workspace/,
		);
	});

	it("lets a tenant manage a server it owns", async () => {
		await expect(
			assertHostAccess(ctx("org-tenant"), "server-tenant"),
		).resolves.toBeUndefined();
	});

	it("rejects a server owned by another workspace, even for the platform", async () => {
		await expect(
			assertHostAccess(ctx("org-tenant"), "server-other"),
		).rejects.toThrow(/not authorized to use this server/);
		await expect(
			assertHostAccess(ctx("org-platform"), "server-tenant"),
		).rejects.toThrow(/not authorized to use this server/);
	});
});

describe("public sign-up", () => {
	it("is off by default and follows the dashboard switch", async () => {
		await expect(isPublicSignupEnabled()).resolves.toBe(false);
		findFirst.mockResolvedValue({ allowPublicSignup: true });
		await expect(isPublicSignupEnabled()).resolves.toBe(true);
	});

	it("lets ALLOW_PUBLIC_SIGNUP override the dashboard switch", async () => {
		findFirst.mockResolvedValue({ allowPublicSignup: true });
		process.env.ALLOW_PUBLIC_SIGNUP = "false";
		await expect(isPublicSignupEnabled()).resolves.toBe(false);
		process.env.ALLOW_PUBLIC_SIGNUP = "1";
		await expect(isPublicSignupEnabled()).resolves.toBe(false);

		findFirst.mockResolvedValue({ allowPublicSignup: false });
		process.env.ALLOW_PUBLIC_SIGNUP = "true";
		await expect(isPublicSignupEnabled()).resolves.toBe(true);
	});

	it("gives new workspaces a bounded quota, configurable per install", () => {
		expect(signupWorkspaceQuota("org-new")).toEqual({
			organizationId: "org-new",
			maxMemoryMb: 1024,
			maxCpu: 1,
			maxApplications: 3,
			maxDatabases: 2,
			maxDomains: 5,
		});

		process.env.SIGNUP_QUOTA_MEMORY_MB = "2048";
		expect(signupWorkspaceQuota("org-new").maxMemoryMb).toBe(2048);
		process.env.SIGNUP_QUOTA_MEMORY_MB = "-5";
		expect(signupWorkspaceQuota("org-new").maxMemoryMb).toBe(1024);
	});
});
