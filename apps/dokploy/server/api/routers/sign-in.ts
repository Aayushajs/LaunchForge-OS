import {
	apiSaveAuthProvider,
	apiSaveSmtpConfig,
} from "@dokploy/server/db/schema";
import { reloadAuthProviders } from "@dokploy/server/lib/auth";
import {
	isPublicSignupEnabled,
	isPublicSignupPinnedByEnv,
} from "@dokploy/server/services/platform";
import {
	clearSmtpConfig,
	describeAuthProviders,
	describeSmtpConfig,
	saveAuthProvider,
	saveSmtpConfig,
} from "@dokploy/server/services/sign-in-config";
import { updateWebServerSettings } from "@dokploy/server/services/web-server-settings";
import { sendEmail } from "@dokploy/server/verification/send-verification-email";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import { createTRPCRouter, hostAdminProcedure } from "../trpc";

const asBadRequest = (error: unknown): never => {
	throw new TRPCError({
		code: "BAD_REQUEST",
		message: error instanceof Error ? error.message : String(error),
	});
};

/** Instance-wide sign-in methods and outgoing email. */
export const signInRouter = createTRPCRouter({
	providers: hostAdminProcedure.query(() => describeAuthProviders()),

	saveProvider: hostAdminProcedure
		.input(apiSaveAuthProvider)
		.mutation(async ({ ctx, input }) => {
			await saveAuthProvider(input).catch(asBadRequest);
			const enabled = await reloadAuthProviders();
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: `sign-in-${input.provider}`,
			});
			return { enabled };
		}),

	signup: hostAdminProcedure.query(async () => ({
		enabled: await isPublicSignupEnabled(),
		pinnedByEnv: isPublicSignupPinnedByEnv(),
	})),

	saveSignup: hostAdminProcedure
		.input(z.object({ enabled: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			if (isPublicSignupPinnedByEnv()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Sign-up is set by the ALLOW_PUBLIC_SIGNUP environment variable on this server.",
				});
			}
			await updateWebServerSettings({ allowPublicSignup: input.enabled });
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "public-signup",
			});
			return true;
		}),

	email: hostAdminProcedure.query(() => describeSmtpConfig()),

	saveEmail: hostAdminProcedure
		.input(apiSaveSmtpConfig)
		.mutation(async ({ ctx, input }) => {
			await saveSmtpConfig(input);
			await audit(ctx, {
				action: "update",
				resourceType: "settings",
				resourceName: "email",
			});
			return true;
		}),

	clearEmail: hostAdminProcedure.mutation(async ({ ctx }) => {
		await clearSmtpConfig();
		await audit(ctx, {
			action: "delete",
			resourceType: "settings",
			resourceName: "email",
		});
		return true;
	}),

	sendTestEmail: hostAdminProcedure
		.input(z.object({ to: z.string().email() }))
		.mutation(async ({ input }) => {
			await sendEmail({
				email: input.to,
				subject: "LaunchForge test email",
				text: "<p>Email from your LaunchForge server works. Password resets and invitations will reach your users.</p>",
			}).catch(asBadRequest);
			return true;
		}),
});
