import { Check, Cloud, GitBranch, Server } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { api } from "@/utils/api";

interface Props {
	projects: number;
	services: number;
	deployments: number;
}

const Step = ({
	index,
	done,
	title,
	detail,
	action,
}: {
	index: number;
	done: boolean;
	title: string;
	detail: string;
	action?: React.ReactNode;
}) => (
	<li className="flex gap-4 py-4 first:pt-0 last:pb-0">
		<span
			className={cn(
				"mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium tabular-nums",
				done
					? "border-transparent bg-foreground text-background"
					: "border-border text-muted-foreground",
			)}
		>
			{done ? <Check className="size-3.5" strokeWidth={3} /> : index}
		</span>
		<div className="flex min-w-0 flex-1 flex-col gap-1">
			<span
				className={cn(
					"text-sm font-medium",
					done && "text-muted-foreground line-through decoration-1",
				)}
			>
				{title}
			</span>
			<span className="text-sm text-muted-foreground">{detail}</span>
		</div>
		{action && !done && <div className="shrink-0 self-center">{action}</div>}
	</li>
);

/**
 * First-run guide on the home page: the steps to a live app, and the two
 * places it can run. It disappears once the first deployment exists.
 */
export const GetStarted = ({ projects, services, deployments }: Props) => {
	const { t } = useTranslation();
	const { data: serverCount } = api.server.count.useQuery();
	const { data: gitProviders } = api.gitProvider.getAll.useQuery();
	const providers = gitProviders?.length ?? 0;

	return (
		<section className="grid gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-[1.25fr_1fr]">
			<div className="flex flex-col gap-5 bg-card p-6">
				<div>
					<h2 className="text-lg font-semibold tracking-tight">
						{t("Deploy your first app")}
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{t("Four steps from a repository to a live HTTPS address.")}
					</p>
				</div>
				<ol className="divide-y divide-border">
					<Step
						index={1}
						done={projects > 0}
						title={t("Create a project")}
						detail={t(
							"A project groups the apps and databases of one product, with environments such as production and staging.",
						)}
						action={
							<Button asChild size="sm">
								<Link href="/dashboard/projects">{t("New project")}</Link>
							</Button>
						}
					/>
					<Step
						index={2}
						done={services > 0}
						title={t("Add an application")}
						detail={t(
							"Inside the project, choose Create Service, then Application. The source can be GitHub, GitLab, Bitbucket, Gitea, any Git URL or a Docker image.",
						)}
					/>
					<Step
						index={3}
						done={deployments > 0}
						title={t("Deploy it")}
						detail={t(
							"Press Deploy and follow the build log in the Deployments tab. The new version takes traffic only once it is healthy.",
						)}
					/>
					<Step
						index={4}
						done={false}
						title={t("Add a domain")}
						detail={t(
							"In the Domains tab, add your hostname. HTTPS certificates are issued automatically once DNS points at the server.",
						)}
					/>
				</ol>
				<div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm">
					<GitBranch className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<p className="text-muted-foreground">
						{providers > 0
							? t("{count} Git account(s) connected.", { count: providers })
							: t(
									"Public repositories need no connection: pick Git as the source and paste the repository URL.",
								)}{" "}
						<Link
							href="/dashboard/settings/git-providers"
							className="font-medium text-foreground underline-offset-4 hover:underline"
						>
							{providers > 0
								? t("Manage Git accounts")
								: t("Connect GitHub, GitLab, Bitbucket or Gitea")}
						</Link>
					</p>
				</div>
			</div>

			<div className="flex flex-col gap-4 bg-card p-6">
				<div>
					<h2 className="text-lg font-semibold tracking-tight">
						{t("Where should it run?")}
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{t("Pick per app. You can move an app between servers later.")}
					</p>
				</div>
				<div className="flex flex-1 flex-col gap-3">
					<div className="flex flex-1 flex-col gap-3 rounded-lg border p-4">
						<div className="flex items-center gap-2.5">
							<Cloud className="size-4" />
							<span className="text-sm font-medium">
								{t("On this platform")}
							</span>
						</div>
						<p className="text-sm text-muted-foreground">
							{t(
								"Nothing to set up. Apps run on the platform's servers within your workspace quota, like on Render or Railway.",
							)}
						</p>
						<Button
							asChild
							variant="outline"
							size="sm"
							className="mt-auto w-fit"
						>
							<Link href="/dashboard/projects">{t("Create a project")}</Link>
						</Button>
					</div>
					<div className="flex flex-1 flex-col gap-3 rounded-lg border p-4">
						<div className="flex items-center gap-2.5">
							<Server className="size-4" />
							<span className="text-sm font-medium">
								{t("On your own server")}
							</span>
							{!!serverCount && (
								<span className="ml-auto rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
									{t("{count} connected", { count: serverCount })}
								</span>
							)}
						</div>
						<p className="text-sm text-muted-foreground">
							{t(
								"Connect any VPS over SSH and press Setup Server: Docker and everything else is installed for you. No quota applies there.",
							)}
						</p>
						<Button
							asChild
							variant="outline"
							size="sm"
							className="mt-auto w-fit"
						>
							<Link href="/dashboard/settings/servers">
								{t("Add a server")}
							</Link>
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
};
