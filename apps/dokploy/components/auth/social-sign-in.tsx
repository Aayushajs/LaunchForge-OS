import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useTranslation } from "@/lib/i18n";

export type SocialProvider = "github" | "google";
type Provider = SocialProvider;

const LABELS: Record<Provider, string> = {
	github: "Continue with GitHub",
	google: "Continue with Google",
};

const GithubMark = () => (
	<svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
		<path
			fill="currentColor"
			d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z"
		/>
	</svg>
);

const GoogleMark = () => (
	<svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
		<path
			fill="#4285F4"
			d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.2 3.5-8.8Z"
		/>
		<path
			fill="#34A853"
			d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
		/>
		<path
			fill="#FBBC05"
			d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z"
		/>
		<path
			fill="#EA4335"
			d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"
		/>
	</svg>
);

export const SocialSignIn = ({ providers }: { providers: Provider[] }) => {
	const [pending, setPending] = useState<Provider | null>(null);
	const { t } = useTranslation();

	const signIn = async (provider: Provider) => {
		setPending(provider);
		const { error } = await authClient.signIn.social({
			provider,
			callbackURL: "/dashboard/home",
		});
		if (error) {
			toast.error(error.message ?? "Sign-in failed");
			setPending(null);
		}
	};

	if (providers.length === 0) return null;

	return (
		<div className="flex flex-col gap-2">
			{providers.map((provider) => (
				<Button
					key={provider}
					type="button"
					variant="outline"
					className="w-full"
					isLoading={pending === provider}
					disabled={pending !== null}
					onClick={() => signIn(provider)}
				>
					{provider === "github" ? <GithubMark /> : <GoogleMark />}
					{t(LABELS[provider])}
				</Button>
			))}
			<div className="flex items-center gap-3 py-2 text-xs text-muted-foreground">
				<span className="h-px flex-1 bg-border" />
				{t("or continue with email")}
				<span className="h-px flex-1 bg-border" />
			</div>
		</div>
	);
};
