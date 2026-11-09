import { formatDistanceToNow } from "date-fns";
import { Loader2, Lock, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GithubIcon } from "@/components/icons/data-tools-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { api } from "@/utils/api";

const VISIBLE_REPOS = 6;

interface Repo {
	name: string;
	owner: string;
	private: boolean;
	pushedAt: string | null;
	defaultBranch: string;
}

const ConnectGithub = ({ signInEnabled }: { signInEnabled: boolean }) => {
	const [pending, setPending] = useState(false);

	if (!signInEnabled) {
		return (
			<div className="flex flex-col gap-3 px-5 py-8 text-sm text-muted-foreground">
				<p>Connect a GitHub account to deploy your repositories from here.</p>
				<div className="flex flex-wrap gap-2">
					<Button asChild variant="secondary" size="sm">
						<Link href="/dashboard/settings/git-providers">
							Add a Git provider
						</Link>
					</Button>
					<Button asChild variant="ghost" size="sm">
						<Link href="/dashboard/settings/sign-in">
							Turn on Sign in with GitHub
						</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-start gap-3 px-5 py-8 text-sm text-muted-foreground">
			<p>
				Connect your GitHub account to list your repositories and deploy one
				with a click.
			</p>
			<Button
				size="sm"
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

const ImportDialog = ({
	githubId,
	repo,
	onClose,
}: {
	githubId: string;
	repo: Repo | null;
	onClose: () => void;
}) => {
	const router = useRouter();
	const utils = api.useUtils();
	const [branch, setBranch] = useState("");
	const [port, setPort] = useState(3000);
	const { data: branches, isPending: loadingBranches } =
		api.github.getGithubBranches.useQuery(
			{ githubId, owner: repo?.owner ?? "", repo: repo?.name ?? "" },
			{ enabled: !!repo },
		);
	const { mutateAsync, isPending } = api.github.importRepository.useMutation();

	useEffect(() => {
		setBranch(repo?.defaultBranch ?? "");
		setPort(3000);
	}, [repo]);

	const deploy = async () => {
		if (!repo) return;
		try {
			const result = await mutateAsync({
				githubId,
				owner: repo.owner,
				repository: repo.name,
				branch,
				port,
			});
			await utils.project.all.invalidate();
			toast.success(`Deploying ${repo.name}`, {
				description: result.autoDeployOnPush
					? `It will be live at ${result.url} and redeploys on every push.`
					: `It will be live at ${result.url}.`,
			});
			onClose();
			router.push(
				`/dashboard/project/${result.projectId}/environment/${result.environmentId}/services/application/${result.applicationId}?tab=deployments`,
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
	};

	return (
		<Dialog open={!!repo} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						Deploy {repo?.owner}/{repo?.name}
					</DialogTitle>
					<DialogDescription>
						A project named after the repository is created with the app, a
						generated domain and automatic deploys. Everything can be changed
						later in the app's settings.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4">
					<div className="grid gap-2">
						<Label>Branch</Label>
						<Select value={branch} onValueChange={setBranch}>
							<SelectTrigger>
								<SelectValue
									placeholder={loadingBranches ? "Loading branches" : "Branch"}
								/>
							</SelectTrigger>
							<SelectContent>
								{(branches ?? [{ name: branch }])
									.filter((item) => item.name)
									.map((item) => (
										<SelectItem key={item.name} value={item.name}>
											{item.name}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="import-port">Port your app listens on</Label>
						<Input
							id="import-port"
							type="number"
							min={1}
							max={65535}
							value={port}
							onChange={(event) => setPort(Number(event.target.value))}
						/>
						<p className="text-xs text-muted-foreground">
							Set as the PORT variable, which most frameworks read. Static sites
							built by Nixpacks listen on it too.
						</p>
					</div>
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={deploy}
						isLoading={isPending}
						disabled={!branch || !port}
					>
						Deploy
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export const ImportRepository = () => {
	const { data: connection, isPending: loadingConnection } =
		api.github.connection.useQuery();
	const { data: providers, isPending: loadingProviders } =
		api.github.githubProviders.useQuery(undefined, {
			enabled: !loadingConnection,
		});
	const [githubId, setGithubId] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<Repo | null>(null);

	useEffect(() => {
		if (githubId || !providers?.length) return;
		setGithubId(connection?.githubId ?? providers[0]?.githubId ?? null);
	}, [providers, connection, githubId]);

	const { data: repositories, isFetching: loadingRepos } =
		api.github.getGithubRepositories.useQuery(
			{ githubId: githubId ?? "" },
			{ enabled: !!githubId },
		);

	const repos = useMemo<Repo[]>(() => {
		const needle = query.trim().toLowerCase();
		return (repositories ?? [])
			.map((repo) => ({
				name: repo.name,
				owner: repo.owner.login,
				private: repo.private,
				pushedAt: repo.pushed_at ?? null,
				defaultBranch: repo.default_branch ?? "main",
			}))
			.filter(
				(repo) =>
					!needle ||
					`${repo.owner}/${repo.name}`.toLowerCase().includes(needle),
			)
			.slice(0, VISIBLE_REPOS);
	}, [repositories, query]);

	const loading = loadingConnection || (loadingProviders && !providers);
	const hasProviders = !!providers?.length;

	return (
		<div className="rounded-xl border bg-background">
			<div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2">
					<GithubIcon className="size-4 fill-current" />
					<span className="text-sm font-medium">Import a Git repository</span>
				</div>
				{hasProviders && (
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						{providers.length > 1 && (
							<Select
								value={githubId ?? undefined}
								onValueChange={(value) => setGithubId(value)}
							>
								<SelectTrigger className="h-8 sm:w-48">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{providers.map((provider) => (
										<SelectItem
											key={provider.githubId}
											value={provider.githubId}
										>
											{provider.gitProvider.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						<div className="relative sm:w-64">
							<Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Search repositories"
								className="h-8 pl-8"
							/>
						</div>
					</div>
				)}
			</div>

			{loading ? (
				<div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					Loading
				</div>
			) : !hasProviders ? (
				<ConnectGithub signInEnabled={!!connection?.signInEnabled} />
			) : loadingRepos && !repositories ? (
				<div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					Loading repositories
				</div>
			) : repos.length === 0 ? (
				<p className="px-5 py-10 text-center text-sm text-muted-foreground">
					{query
						? "No repository matches that search."
						: "No repositories found."}
				</p>
			) : (
				<ul className="divide-y">
					{repos.map((repo) => (
						<li
							key={`${repo.owner}/${repo.name}`}
							className="flex items-center gap-3 px-5 py-3"
						>
							<div className="flex min-w-0 flex-1 flex-col">
								<div className="flex items-center gap-2">
									<span className="truncate text-sm font-medium">
										{repo.owner}/{repo.name}
									</span>
									{repo.private && (
										<Badge variant="outline" className="gap-1 text-xs">
											<Lock className="size-3" />
											Private
										</Badge>
									)}
								</div>
								{repo.pushedAt && (
									<span className="text-xs text-muted-foreground">
										Updated{" "}
										{formatDistanceToNow(new Date(repo.pushedAt), {
											addSuffix: true,
										})}
									</span>
								)}
							</div>
							<Button
								size="sm"
								variant="secondary"
								onClick={() => setSelected(repo)}
							>
								Import
							</Button>
						</li>
					))}
				</ul>
			)}

			{connection?.error && (
				<p className="border-t px-5 py-3 text-xs text-muted-foreground">
					{connection.error}
				</p>
			)}

			{githubId && (
				<ImportDialog
					githubId={githubId}
					repo={selected}
					onClose={() => setSelected(null)}
				/>
			)}
		</div>
	);
};
