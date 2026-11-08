import { isEmailConfigured } from "@dokploy/server/services/sign-in-config";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Check, Copy, MailCheck } from "lucide-react";
import type { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { type ReactElement, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { OnboardingLayout } from "@/components/layouts/onboarding-layout";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useTranslation } from "@/lib/i18n";

const schema = z.object({
	email: z.string().trim().min(1).max(255).email(),
});

const RESET_COMMAND =
	"docker exec $(docker ps -qf name=dokploy.1) node dist/reset-password.mjs you@example.com";

interface Props {
	emailConfigured: boolean;
}

export default function SendResetPassword({ emailConfigured }: Props) {
	const { t } = useTranslation();
	const [sent, setSent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const form = useForm<z.infer<typeof schema>>({
		defaultValues: { email: "" },
		resolver: zodResolver(schema),
	});

	const onSubmit = async ({ email }: z.infer<typeof schema>) => {
		setError(null);
		const { error } = await authClient.requestPasswordReset({
			email,
			redirectTo: "/reset-password",
		});
		if (error) {
			setError(error.message || t("The reset link could not be sent."));
			return;
		}
		setSent(true);
	};

	const copyCommand = async () => {
		await navigator.clipboard.writeText(RESET_COMMAND).catch(() => {});
		setCopied(true);
		setTimeout(() => setCopied(false), 1800);
	};

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold tracking-tight">
					{t("Reset your password")}
				</h1>
				<p className="text-sm text-muted-foreground">
					{emailConfigured
						? t(
								"Enter the email you sign in with and we will send you a link to choose a new password.",
							)
						: t(
								"This server cannot send email yet, so a reset link cannot be sent.",
							)}
				</p>
			</div>

			{!emailConfigured ? (
				<div className="flex flex-col gap-4 text-sm">
					<p className="text-muted-foreground">
						{t(
							"Ask the person who runs this server to reset it for you. If that is you, run this on the server and sign in with the password it prints:",
						)}
					</p>
					<div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
						<code className="flex-1 break-all font-mono text-xs leading-relaxed">
							{RESET_COMMAND}
						</code>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={t("Copy command")}
							onClick={copyCommand}
						>
							{copied ? <Check /> : <Copy />}
						</Button>
					</div>
					<p className="text-muted-foreground">
						{t(
							"To let everyone reset their own password, set up email under Settings, Email.",
						)}
					</p>
				</div>
			) : sent ? (
				<div className="flex flex-col items-start gap-3 rounded-lg border p-4">
					<MailCheck className="size-5" />
					<p className="font-medium">{t("Check your inbox")}</p>
					<p className="text-sm text-muted-foreground">
						{t(
							"If an account exists for that address, a link to reset the password is on its way. It expires in one hour.",
						)}
					</p>
				</div>
			) : (
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="flex flex-col gap-4"
					>
						{error && <AlertBlock type="error">{error}</AlertBlock>}
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("Email")}</FormLabel>
									<FormControl>
										<Input
											type="email"
											autoComplete="email"
											placeholder="you@example.com"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button
							type="submit"
							className="w-full"
							isLoading={form.formState.isSubmitting}
						>
							{t("Send reset link")}
						</Button>
					</form>
				</Form>
			)}

			<Link
				href="/"
				className="text-sm text-muted-foreground hover:text-foreground"
			>
				{t("Back to sign in")}
			</Link>
		</div>
	);
}

SendResetPassword.getLayout = (page: ReactElement) => {
	return <OnboardingLayout>{page}</OnboardingLayout>;
};

export async function getServerSideProps(_context: GetServerSidePropsContext) {
	return {
		props: {
			emailConfigured: await isEmailConfigured().catch(() => false),
		},
	};
}
