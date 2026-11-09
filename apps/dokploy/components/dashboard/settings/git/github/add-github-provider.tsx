import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GithubIcon } from "@/components/icons/data-tools-icons";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth-client";
import { api } from "@/utils/api";
import { DEFAULT_GITHUB_URL, resolveGithubBaseUrl } from "@/utils/github-utils";
import { isPublicHost } from "@/utils/public-host";

const ConnectGithubAccount = ({ enabled }: { enabled: boolean }) => {
	const { data: connection } = api.github.connection.useQuery(undefined, {
		enabled,
	});
	const [pending, setPending] = useState(false);

	if (!connection) return null;

	if (connection.githubId) {
		return (
			<div className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
				<p className="font-medium">Your GitHub account is connected</p>
				<p className="text-muted-foreground">
					Your repositories are listed on Home. Pick one and click Import to
					deploy it.
				</p>
				<Button asChild size="sm" className="w-fit">
					<Link href="/dashboard/home">Go to Home</Link>
				</Button>
			</div>
		);
	}

	if (!connection.signInEnabled) {
		return (
			<p className="rounded-lg border p-4 text-sm text-muted-foreground">
				For one-click access to your repositories, turn on GitHub under
				Settings, Sign-in & Email. Otherwise create a GitHub App below.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
			<p className="font-medium">Connect your GitHub account</p>
			<p className="text-muted-foreground">
				Recommended. Lists all your repositories, public and private, so you can
				deploy one straight from Home. No app to create.
			</p>
			<Button
				size="sm"
				className="w-fit"
				isLoading={pending}
				onClick={async () => {
					setPending(true);
					const { error } = await authClient.linkSocial({
						provider: "github",
						callbackURL: "/dashboard/home",
					});
					if (error) {
						toast.error(error.message ?? "Could not connect GitHub");
						setPending(false);
					}
				}}
			>
				<GithubIcon className="size-4 fill-current" />
				Connect GitHub
			</Button>
		</div>
	);
};

export const AddGithubProvider = () => {
	const [isOpen, setIsOpen] = useState(false);
	const { data: activeOrganization } = api.organization.active.useQuery();

	const { data: session } = api.user.session.useQuery();
	const { data } = api.user.get.useQuery();
	const [manifest, setManifest] = useState("");
	const [isOrganization, setIsOrganization] = useState(false);
	const [organizationName, setOrganization] = useState("");
	const [githubUrl, setGithubUrl] = useState(DEFAULT_GITHUB_URL);

	const { baseUrl, error: githubUrlError } = resolveGithubBaseUrl(githubUrl);

	const randomString = () => Math.random().toString(36).slice(2, 8);
	const [reachable, setReachable] = useState(true);

	useEffect(() => {
		const url = document.location.origin;
		// GitHub rejects an app whose webhook URL it cannot reach, so a
		// dashboard on localhost or a private address gets an app without
		// webhooks: repositories work, pushes do not deploy by themselves.
		const publicHost = isPublicHost(document.location.hostname);
		setReachable(publicHost);
		const manifest = JSON.stringify(
			{
				redirect_url: `${origin}/api/providers/github/setup?organizationId=${activeOrganization?.id ?? ""}&userId=${session?.user?.id ?? ""}&githubUrl=${encodeURIComponent(baseUrl)}`,
				name: `LaunchForge-${format(new Date(), "yyyy-MM-dd")}-${randomString()}`,
				url: origin,
				...(publicHost
					? { hook_attributes: { url: `${url}/api/deploy/github` } }
					: {}),
				callback_urls: [`${origin}/api/providers/github/setup`],
				public: false,
				request_oauth_on_install: true,
				default_permissions: {
					contents: "read",
					metadata: "read",
					emails: "read",
					pull_requests: "write",
				},
				...(publicHost ? { default_events: ["pull_request", "push"] } : {}),
			},
			null,
			4,
		);

		setManifest(manifest);
	}, [activeOrganization?.id, session?.user?.id, baseUrl]);

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant="secondary" className="flex items-center space-x-1">
					<GithubIcon className="text-current fill-current" />
					<span>Github</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl ">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						Github Provider <GithubIcon className="size-5" />
					</DialogTitle>
				</DialogHeader>

				<div id="hook-form-add-project" className="grid w-full gap-1">
					<CardContent className="p-0">
						<div className="flex flex-col ">
							<ConnectGithubAccount enabled={isOpen} />
							<p className="mt-5 text-sm font-medium">Or create a GitHub App</p>
							<p className="text-muted-foreground text-sm">
								Use an app for GitHub organisations, GitHub Enterprise, or pull
								request preview deployments. GitHub asks you to name and install
								it; LaunchForge fills in the rest.
							</p>
							{!reachable && (
								<p className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
									This dashboard runs on a private address that GitHub cannot
									reach, so the app is created without webhooks. You can still
									connect repositories and deploy them; to deploy on every push,
									give the dashboard a public domain under Settings, Web Server,
									and create the app again.
								</p>
							)}
							<div className="mt-4 flex flex-col gap-4">
								<div className="flex flex-col gap-2">
									<span className="text-sm">GitHub URL</span>
									<Input
										placeholder={DEFAULT_GITHUB_URL}
										value={githubUrl}
										onChange={(e) => setGithubUrl(e.target.value)}
									/>
									<span className="text-muted-foreground text-xs">
										Leave as is for github.com. For GitHub Enterprise, use your
										instance URL (e.g. https://acme.ghe.com or
										https://github.acme.com).
									</span>
									{githubUrlError && (
										<span className="text-destructive text-xs">
											{githubUrlError}
										</span>
									)}
								</div>

								<div className="flex flex-row gap-4">
									<span>Organization?</span>
									<Switch
										checked={isOrganization}
										onCheckedChange={(checked) => setIsOrganization(checked)}
									/>
								</div>

								{isOrganization && (
									<Input
										required
										placeholder="Organization name"
										onChange={(e) => setOrganization(e.target.value)}
									/>
								)}
							</div>
							<form
								action={
									isOrganization
										? `${baseUrl}/organizations/${organizationName}/settings/apps/new?state=gh_init:${activeOrganization?.id}:${session?.user?.id ?? ""}`
										: `${baseUrl}/settings/apps/new?state=gh_init:${activeOrganization?.id}:${session?.user?.id ?? ""}`
								}
								method="post"
							>
								<input
									type="text"
									name="manifest"
									id="manifest"
									defaultValue={manifest}
									className="invisible"
								/>
								<br />

								<div className="flex w-full items-center justify-between">
									<a
										href={
											isOrganization && organizationName
												? `${baseUrl}/organizations/${organizationName}/settings/installations`
												: `${baseUrl}/settings/installations`
										}
										className={`text-muted-foreground text-sm hover:underline duration-300
											 ${
													isOrganization && !organizationName
														? "pointer-events-none opacity-50"
														: ""
}`}
										target="_blank"
										rel="noopener noreferrer"
									>
										Unsure if you already have an app?
									</a>
									<Button
										disabled={
											!!githubUrlError ||
											(isOrganization && organizationName.length < 1)
										}
										type="submit"
										className="self-end"
									>
										Create GitHub App
									</Button>
								</div>
							</form>
						</div>
					</CardContent>
				</div>
			</DialogContent>
		</Dialog>
	);
};
