import { describe, expect, it, vi } from "vitest";

const findRegistryByIdWithCredentials = vi.fn(async (registryId: string) => ({
	registryId,
	username: "deploy",
	password: "registry-secret",
}));

vi.mock("@dokploy/server/services/registry", () => ({
	findRegistryByIdWithCredentials,
	dockerLogin: vi.fn(),
}));

const { sealRollbackContext, openRollbackContext } = await import(
	"@dokploy/server/services/rollbacks"
);
const { isEncrypted } = await import("@dokploy/server/lib/encryption");

const application = {
	appName: "portfolio",
	env: "DATABASE_URL=postgres://user:pass@db/app",
	buildSecrets: "NPM_TOKEN=abc",
	password: "docker-hub-password",
	rollbackRegistryId: "registry-1",
	registry: { registryId: "registry-0", password: "leak-me" },
	rollbackRegistry: { registryId: "registry-1", password: "registry-secret" },
	environment: {
		env: "SHARED=1",
		project: { env: "PROJECT_SECRET=2" },
	},
};

describe("rollback snapshots", () => {
	it("never stores registry credentials", () => {
		const sealed = sealRollbackContext(application);
		const raw = JSON.stringify(sealed);
		expect(raw).not.toContain("leak-me");
		expect(raw).not.toContain("registry-secret");
		expect(sealed).not.toHaveProperty("registry");
		expect(sealed).not.toHaveProperty("rollbackRegistry");
	});

	it("encrypts secret fields, including nested environment and project env", () => {
		const sealed = sealRollbackContext(application) as typeof application;
		for (const value of [
			sealed.env,
			sealed.buildSecrets,
			sealed.password,
			sealed.environment.env,
			sealed.environment.project.env,
		]) {
			expect(isEncrypted(value)).toBe(true);
		}
		expect(JSON.stringify(sealed)).not.toContain("postgres://user:pass");
		expect(sealed.appName).toBe("portfolio");
	});

	it("restores secrets and re-reads registry credentials by id", async () => {
		const sealed = sealRollbackContext(application) as typeof application;
		const opened = await openRollbackContext(sealed);
		expect(opened.env).toBe(application.env);
		expect(opened.environment.project.env).toBe("PROJECT_SECRET=2");
		expect(findRegistryByIdWithCredentials).toHaveBeenCalledWith("registry-1");
		expect(opened.rollbackRegistry?.password).toBe("registry-secret");
	});
});
