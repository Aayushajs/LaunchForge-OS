import type {
	AuthProviderName,
	AuthProvidersConfig,
	apiSaveAuthProvider,
	apiSaveSmtpConfig,
	SmtpConfig,
} from "@dokploy/server/db/schema";
import type { z } from "zod";
import { decryptValue, encryptValue } from "../lib/encryption";
import {
	getWebServerSettings,
	updateWebServerSettings,
} from "./web-server-settings";

export const AUTH_PROVIDERS: AuthProviderName[] = ["github", "google"];

export interface ProviderCredentials {
	clientId: string;
	clientSecret: string;
}

const fromEnv = (provider: AuthProviderName): ProviderCredentials | null => {
	const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
	const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];
	return clientId && clientSecret ? { clientId, clientSecret } : null;
};

const decryptSafely = (value: string) => {
	try {
		return decryptValue(value);
	} catch {
		return "";
	}
};

/**
 * Credentials for every OAuth provider that can be used to sign in. Values
 * saved in the dashboard take precedence over environment variables.
 */
export const loadAuthProviders = async () => {
	const settings = await getWebServerSettings().catch(() => null);
	const stored: AuthProvidersConfig = settings?.authProviders ?? {};
	const providers: Partial<Record<AuthProviderName, ProviderCredentials>> = {};
	for (const provider of AUTH_PROVIDERS) {
		const saved = stored[provider];
		const secret = saved ? decryptSafely(saved.clientSecret) : "";
		if (saved?.clientId && secret) {
			providers[provider] = { clientId: saved.clientId, clientSecret: secret };
			continue;
		}
		const env = fromEnv(provider);
		if (env) providers[provider] = env;
	}
	return providers;
};

/** What the settings page shows: never the secret itself. */
export const describeAuthProviders = async () => {
	const settings = await getWebServerSettings();
	const stored: AuthProvidersConfig = settings?.authProviders ?? {};
	return AUTH_PROVIDERS.map((provider) => {
		const saved = stored[provider];
		const env = fromEnv(provider);
		return {
			provider,
			clientId: saved?.clientId ?? env?.clientId ?? "",
			hasSecret: !!saved?.clientSecret || !!env,
			source: saved?.clientId ? "dashboard" : env ? "environment" : null,
		} as const;
	});
};

export const saveAuthProvider = async (
	input: z.infer<typeof apiSaveAuthProvider>,
) => {
	const settings = await getWebServerSettings();
	const stored: AuthProvidersConfig = { ...(settings?.authProviders ?? {}) };
	if (!input.clientId) {
		delete stored[input.provider];
	} else {
		const existing = stored[input.provider];
		const clientSecret = input.clientSecret
			? encryptValue(input.clientSecret)
			: existing?.clientSecret;
		if (!clientSecret) {
			throw new Error("Enter the client secret to turn this provider on.");
		}
		stored[input.provider] = { clientId: input.clientId, clientSecret };
	}
	await updateWebServerSettings({ authProviders: stored });
};

const smtpFromEnv = (): SmtpConfig | null => {
	const host = process.env.SMTP_SERVER;
	const fromAddress = process.env.SMTP_FROM_ADDRESS;
	if (!host || !fromAddress) return null;
	return {
		host,
		port: Number(process.env.SMTP_PORT) || 587,
		username: process.env.SMTP_USERNAME ?? "",
		password: process.env.SMTP_PASSWORD ?? "",
		fromAddress,
	};
};

/** The SMTP server used for account emails, with the password decrypted. */
export const getSmtpConfig = async (): Promise<SmtpConfig | null> => {
	const settings = await getWebServerSettings().catch(() => null);
	const saved = settings?.smtpConfig;
	if (saved?.host) {
		return { ...saved, password: decryptSafely(saved.password) };
	}
	return smtpFromEnv();
};

export const isEmailConfigured = async () => !!(await getSmtpConfig());

export const describeSmtpConfig = async () => {
	const settings = await getWebServerSettings();
	const saved = settings?.smtpConfig;
	const env = smtpFromEnv();
	const active = saved?.host ? saved : env;
	return {
		host: active?.host ?? "",
		port: active?.port ?? 587,
		username: active?.username ?? "",
		fromAddress: active?.fromAddress ?? "",
		hasPassword: !!active?.password,
		source: saved?.host ? "dashboard" : env ? "environment" : null,
	} as const;
};

export const saveSmtpConfig = async (
	input: z.infer<typeof apiSaveSmtpConfig>,
) => {
	const settings = await getWebServerSettings();
	const existing = settings?.smtpConfig;
	await updateWebServerSettings({
		smtpConfig: {
			host: input.host,
			port: input.port,
			username: input.username,
			password: input.password
				? encryptValue(input.password)
				: (existing?.password ?? ""),
			fromAddress: input.fromAddress,
		},
	});
};

export const clearSmtpConfig = async () => {
	await updateWebServerSettings({ smtpConfig: null });
};
