import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
	settings: {
		authProviders: {} as Record<
			string,
			{ clientId: string; clientSecret: string }
		>,
		smtpConfig: null as null | Record<string, unknown>,
	},
}));

vi.mock("@dokploy/server/services/web-server-settings", () => ({
	getWebServerSettings: vi.fn(async () => store.settings),
	updateWebServerSettings: vi.fn(async (updates: Record<string, unknown>) => {
		Object.assign(store.settings, updates);
		return store.settings;
	}),
}));

const {
	describeAuthProviders,
	describeSmtpConfig,
	getSmtpConfig,
	loadAuthProviders,
	saveAuthProvider,
	saveSmtpConfig,
} = await import("@dokploy/server/services/sign-in-config");
const { isEncrypted } = await import("@dokploy/server/lib/encryption");

const ENV_KEYS = [
	"GITHUB_CLIENT_ID",
	"GITHUB_CLIENT_SECRET",
	"SMTP_SERVER",
	"SMTP_FROM_ADDRESS",
	"SMTP_PASSWORD",
];

beforeEach(() => {
	store.settings.authProviders = {};
	store.settings.smtpConfig = null;
});

afterEach(() => {
	for (const key of ENV_KEYS) delete process.env[key];
});

describe("sign-in providers", () => {
	it("offers nothing until a provider is configured", async () => {
		await expect(loadAuthProviders()).resolves.toEqual({});
	});

	it("uses environment credentials", async () => {
		process.env.GITHUB_CLIENT_ID = "env-id";
		process.env.GITHUB_CLIENT_SECRET = "env-secret";

		await expect(loadAuthProviders()).resolves.toEqual({
			github: { clientId: "env-id", clientSecret: "env-secret" },
		});
	});

	it("stores the client secret encrypted and prefers dashboard values", async () => {
		process.env.GITHUB_CLIENT_ID = "env-id";
		process.env.GITHUB_CLIENT_SECRET = "env-secret";

		await saveAuthProvider({
			provider: "github",
			clientId: "dash-id",
			clientSecret: "dash-secret",
		});

		const saved = store.settings.authProviders.github;
		expect(saved?.clientId).toBe("dash-id");
		expect(isEncrypted(saved?.clientSecret ?? "")).toBe(true);
		expect(saved?.clientSecret).not.toContain("dash-secret");
		await expect(loadAuthProviders()).resolves.toEqual({
			github: { clientId: "dash-id", clientSecret: "dash-secret" },
		});
	});

	it("keeps the stored secret when the form leaves it empty", async () => {
		await saveAuthProvider({
			provider: "google",
			clientId: "id-1",
			clientSecret: "secret-1",
		});
		await saveAuthProvider({
			provider: "google",
			clientId: "id-2",
			clientSecret: "",
		});

		await expect(loadAuthProviders()).resolves.toEqual({
			google: { clientId: "id-2", clientSecret: "secret-1" },
		});
	});

	it("requires a secret the first time and removes a provider with an empty id", async () => {
		await expect(
			saveAuthProvider({
				provider: "github",
				clientId: "id",
				clientSecret: "",
			}),
		).rejects.toThrow(/client secret/);

		await saveAuthProvider({
			provider: "github",
			clientId: "id",
			clientSecret: "s",
		});
		await saveAuthProvider({
			provider: "github",
			clientId: "",
			clientSecret: "",
		});
		await expect(loadAuthProviders()).resolves.toEqual({});
	});

	it("never returns secrets to the settings page", async () => {
		await saveAuthProvider({
			provider: "github",
			clientId: "id",
			clientSecret: "s3cr3t",
		});

		const described = await describeAuthProviders();
		expect(JSON.stringify(described)).not.toContain("s3cr3t");
		expect(described.find((p) => p.provider === "github")).toMatchObject({
			clientId: "id",
			hasSecret: true,
			source: "dashboard",
		});
	});
});

describe("email", () => {
	it("is off until configured", async () => {
		await expect(getSmtpConfig()).resolves.toBeNull();
	});

	it("falls back to the environment", async () => {
		process.env.SMTP_SERVER = "smtp.example.com";
		process.env.SMTP_FROM_ADDRESS = "no-reply@example.com";
		process.env.SMTP_PASSWORD = "env-pass";

		await expect(getSmtpConfig()).resolves.toMatchObject({
			host: "smtp.example.com",
			port: 587,
			password: "env-pass",
		});
	});

	it("stores the password encrypted and keeps it when left empty", async () => {
		const input = {
			host: "smtp.example.com",
			port: 465,
			username: "user",
			password: "mail-pass",
			fromAddress: "no-reply@example.com",
		};
		await saveSmtpConfig(input);
		expect(isEncrypted(String(store.settings.smtpConfig?.password))).toBe(true);

		await saveSmtpConfig({ ...input, port: 587, password: "" });
		await expect(getSmtpConfig()).resolves.toMatchObject({
			port: 587,
			password: "mail-pass",
		});
		const described = await describeSmtpConfig();
		expect(JSON.stringify(described)).not.toContain("mail-pass");
		expect(described).toMatchObject({ hasPassword: true, source: "dashboard" });
	});
});
