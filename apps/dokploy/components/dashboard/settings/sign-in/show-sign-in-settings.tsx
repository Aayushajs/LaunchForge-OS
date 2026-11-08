import { Check, Copy, ExternalLink, KeyRound, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GithubIcon } from "@/components/icons/data-tools-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { api } from "@/utils/api";

type Provider = "github" | "google";

const PROVIDER_INFO: Record<
	Provider,
	{ name: string; createUrl: string; steps: string }
> = {
	github: {
		name: "GitHub",
		createUrl: "https://github.com/settings/applications/new",
		steps:
			"Create an OAuth App: set the homepage to this dashboard's address and paste the callback URL below, then generate a client secret.",
	},
	google: {
		name: "Google",
		createUrl: "https://console.cloud.google.com/apis/credentials",
		steps:
			"Create an OAuth client ID of type Web application and add the callback URL below as an authorised redirect URI.",
	},
};

const CopyField = ({ value }: { value: string }) => {
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);
	return (
		<div className="flex items-center gap-2">
			<Input readOnly value={value} className="font-mono text-xs" />
			<Button
				type="button"
				variant="outline"
				size="icon"
				aria-label={t("Copy")}
				onClick={async () => {
					await navigator.clipboard.writeText(value).catch(() => {});
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				}}
			>
				{copied ? <Check /> : <Copy />}
			</Button>
		</div>
	);
};

const ProviderForm = ({
	provider,
	clientId: savedClientId,
	hasSecret,
	source,
}: {
	provider: Provider;
	clientId: string;
	hasSecret: boolean;
	source: "dashboard" | "environment" | null;
}) => {
	const { t } = useTranslation();
	const utils = api.useUtils();
	const [clientId, setClientId] = useState(savedClientId);
	const [clientSecret, setClientSecret] = useState("");
	const { mutateAsync, isPending } = api.signIn.saveProvider.useMutation();
	const info = PROVIDER_INFO[provider];
	const [origin, setOrigin] = useState("");
	useEffect(() => setOrigin(window.location.origin), []);
	const enabled = !!source;

	const save = async (nextClientId: string) => {
		try {
			await mutateAsync({ provider, clientId: nextClientId, clientSecret });
			setClientSecret("");
			await utils.signIn.providers.invalidate();
			toast.success(
				nextClientId
					? t("{name} sign-in is on", { name: info.name })
					: t("{name} sign-in is off", { name: info.name }),
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
	};

	return (
		<div className="flex flex-col gap-4 rounded-lg border p-5">
			<div className="flex items-center gap-3">
				{provider === "github" ? (
					<GithubIcon className="size-5 fill-current" />
				) : (
					<KeyRound className="size-5" />
				)}
				<span className="font-medium">{info.name}</span>
				<Badge variant={enabled ? "default" : "outline"} className="ml-auto">
					{enabled
						? source === "environment"
							? t("On (environment)")
							: t("On")
						: t("Off")}
				</Badge>
			</div>
			<p className="text-sm text-muted-foreground">
				{t(info.steps)}{" "}
				<a
					href={info.createUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
				>
					{t("Open {name}", { name: info.name })}
					<ExternalLink className="size-3" />
				</a>
			</p>
			<div className="grid gap-2">
				<Label>{t("Callback URL")}</Label>
				<CopyField value={`${origin}/api/auth/callback/${provider}`} />
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="grid gap-2">
					<Label htmlFor={`${provider}-id`}>{t("Client ID")}</Label>
					<Input
						id={`${provider}-id`}
						value={clientId}
						onChange={(event) => setClientId(event.target.value)}
						autoComplete="off"
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor={`${provider}-secret`}>{t("Client secret")}</Label>
					<Input
						id={`${provider}-secret`}
						type="password"
						value={clientSecret}
						onChange={(event) => setClientSecret(event.target.value)}
						placeholder={hasSecret ? t("Saved, leave empty to keep") : ""}
						autoComplete="new-password"
					/>
				</div>
			</div>
			<div className="flex gap-2">
				<Button
					onClick={() => save(clientId.trim())}
					isLoading={isPending}
					disabled={!clientId.trim()}
				>
					{t("Save")}
				</Button>
				{source === "dashboard" && (
					<Button
						variant="outline"
						onClick={() => save("")}
						disabled={isPending}
					>
						{t("Turn off")}
					</Button>
				)}
			</div>
		</div>
	);
};

const EmailForm = () => {
	const { t } = useTranslation();
	const utils = api.useUtils();
	const { data } = api.signIn.email.useQuery();
	const saveEmail = api.signIn.saveEmail.useMutation();
	const clearEmail = api.signIn.clearEmail.useMutation();
	const sendTest = api.signIn.sendTestEmail.useMutation();
	const [form, setForm] = useState({
		host: "",
		port: 587,
		username: "",
		password: "",
		fromAddress: "",
	});
	const [testTo, setTestTo] = useState("");

	useEffect(() => {
		if (data) {
			setForm((current) => ({
				...current,
				host: data.host,
				port: data.port,
				username: data.username,
				fromAddress: data.fromAddress,
			}));
		}
	}, [data]);

	const field =
		(key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
			setForm((current) => ({
				...current,
				[key]: key === "port" ? Number(event.target.value) : event.target.value,
			}));

	const save = async () => {
		try {
			await saveEmail.mutateAsync(form);
			setForm((current) => ({ ...current, password: "" }));
			await utils.signIn.email.invalidate();
			toast.success(t("Email settings saved"));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
	};

	const test = async () => {
		try {
			await sendTest.mutateAsync({ to: testTo });
			toast.success(t("Test email sent to {to}", { to: testTo }));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
	};

	return (
		<div className="flex flex-col gap-5">
			<div className="grid gap-4 sm:grid-cols-[1fr_120px]">
				<div className="grid gap-2">
					<Label htmlFor="smtp-host">{t("SMTP server")}</Label>
					<Input
						id="smtp-host"
						placeholder="smtp-relay.brevo.com"
						value={form.host}
						onChange={field("host")}
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="smtp-port">{t("Port")}</Label>
					<Input
						id="smtp-port"
						type="number"
						value={form.port}
						onChange={field("port")}
					/>
				</div>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="grid gap-2">
					<Label htmlFor="smtp-user">{t("Username")}</Label>
					<Input
						id="smtp-user"
						value={form.username}
						onChange={field("username")}
						autoComplete="off"
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="smtp-password">{t("Password")}</Label>
					<Input
						id="smtp-password"
						type="password"
						value={form.password}
						onChange={field("password")}
						placeholder={
							data?.hasPassword ? t("Saved, leave empty to keep") : ""
						}
						autoComplete="new-password"
					/>
				</div>
			</div>
			<div className="grid gap-2">
				<Label htmlFor="smtp-from">{t("From address")}</Label>
				<Input
					id="smtp-from"
					placeholder="LaunchForge <no-reply@example.com>"
					value={form.fromAddress}
					onChange={field("fromAddress")}
				/>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button
					onClick={save}
					isLoading={saveEmail.isPending}
					disabled={!form.host || !form.fromAddress}
				>
					{t("Save")}
				</Button>
				{data?.source === "dashboard" && (
					<Button
						variant="outline"
						disabled={clearEmail.isPending}
						onClick={async () => {
							await clearEmail.mutateAsync();
							await utils.signIn.email.invalidate();
							toast.success(t("Email settings removed"));
						}}
					>
						{t("Remove")}
					</Button>
				)}
			</div>
			<div className="flex flex-col gap-2 border-t pt-5">
				<Label htmlFor="smtp-test">{t("Send a test email")}</Label>
				<div className="flex gap-2">
					<Input
						id="smtp-test"
						type="email"
						placeholder="you@example.com"
						value={testTo}
						onChange={(event) => setTestTo(event.target.value)}
					/>
					<Button
						variant="outline"
						onClick={test}
						isLoading={sendTest.isPending}
						disabled={!testTo || !data?.source}
					>
						{t("Send")}
					</Button>
				</div>
			</div>
		</div>
	);
};

export const ShowSignInSettings = () => {
	const { t } = useTranslation();
	const { data: providers } = api.signIn.providers.useQuery();
	const { data: email } = api.signIn.email.useQuery();

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-xl">
						<KeyRound className="size-5 text-muted-foreground" />
						{t("Sign-in methods")}
					</CardTitle>
					<CardDescription>
						{t(
							"Let people sign in with GitHub or Google. Buttons appear on the sign-in page as soon as a provider is saved.",
						)}
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{providers?.map((provider) => (
						<ProviderForm key={provider.provider} {...provider} />
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-xl">
						<Mail className="size-5 text-muted-foreground" />
						{t("Email")}
						{email?.source && (
							<Badge variant="outline" className="ml-2">
								{email.source === "environment"
									? t("From environment")
									: t("Configured")}
							</Badge>
						)}
					</CardTitle>
					<CardDescription>
						{t(
							"Outgoing email for password resets and invitations. Any SMTP provider works; Brevo, Resend and Mailjet have free plans.",
						)}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<EmailForm />
				</CardContent>
			</Card>
		</div>
	);
};
