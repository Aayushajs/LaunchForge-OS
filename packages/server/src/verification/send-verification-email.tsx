import { render } from "@react-email/components";
import AccountDeletionCodeTemplate from "../emails/emails/account-deletion-code";
import InvitationEmail from "../emails/emails/invitation";
import VerifyEmailTemplate from "../emails/emails/verify-email";
import { getSmtpConfig } from "../services/sign-in-config";
import { sendEmailNotification } from "../utils/notifications/utils";

export const sendEmail = async ({
	email,
	subject,
	text,
	attachments,
}: {
	email: string;
	subject: string;
	text: string;
	attachments?: { filename: string; content: Buffer }[];
}) => {
	const smtp = await getSmtpConfig();
	if (!smtp) {
		throw new Error(
			"Email is not set up on this server. An administrator can set it up under Settings, Email.",
		);
	}
	await sendEmailNotification(
		{
			fromAddress: smtp.fromAddress,
			toAddresses: [email],
			smtpServer: smtp.host,
			smtpPort: smtp.port,
			username: smtp.username,
			password: smtp.password,
		},
		subject,
		text,
		attachments,
	);

	return true;
};

export const sendVerificationEmail = async ({
	userName,
	email,
	verificationUrl,
}: {
	userName: string;
	email: string;
	verificationUrl: string;
}) => {
	const html = await render(
		VerifyEmailTemplate({
			userName: userName || "User",
			verificationUrl,
		}),
	);
	await sendEmail({
		email,
		subject: "Verify your email",
		text: html,
	});
};

export const renderInvitationEmail = async ({
	email,
	inviteLink,
	organizationName,
}: {
	email: string;
	inviteLink: string;
	organizationName: string;
}) => {
	return render(
		InvitationEmail({
			inviteLink,
			toEmail: email,
			organizationName,
		}),
	);
};

export const sendInvitationEmail = async ({
	email,
	inviteLink,
	organizationName,
}: {
	email: string;
	inviteLink: string;
	organizationName: string;
}) => {
	const html = await renderInvitationEmail({
		email,
		inviteLink,
		organizationName,
	});
	await sendEmail({
		email,
		subject: `You've been invited to join ${organizationName} on LaunchForge`,
		text: html,
	});
};

export const sendAccountDeletionCodeEmail = async ({
	email,
	userName,
	code,
	expiresInMinutes,
}: {
	email: string;
	userName: string;
	code: string;
	expiresInMinutes: number;
}) => {
	const html = await render(
		AccountDeletionCodeTemplate({
			userName: userName || "User",
			code,
			expiresInMinutes,
		}),
	);
	await sendEmail({
		email,
		subject: `${code} is your account deletion code`,
		text: html,
	});
};
