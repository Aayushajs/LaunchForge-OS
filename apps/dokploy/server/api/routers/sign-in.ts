import {
	apiSaveAuthProvider,
	apiSaveSmtpConfig,
} from "@dokploy/server/db/schema";
import { reloadAuthProviders } from "@dokploy/server/lib/auth";
import {
	clearSmtpConfig,
	describeAuthProviders,
	describeSmtpConfig,
	saveAuthProvider,
	saveSmtpConfig,
} from "@dokploy/server/services/sign-in-config";
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
