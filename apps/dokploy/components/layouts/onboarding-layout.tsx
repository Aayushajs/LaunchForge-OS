import { Check } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useTranslation } from "@/lib/i18n";
import { useWhitelabelingPublic } from "@/utils/hooks/use-whitelabeling";
import { GithubIcon } from "../icons/data-tools-icons";
import { LanguageSwitcher } from "../shared/language-switcher";
import { Logo } from "../shared/logo";
import { Button } from "../ui/button";

interface Props {
	children: React.ReactNode;
	/** Overrides the default content of the left panel (desktop only). */
	leftPanel?: React.ReactNode;
}

const STAGES = [
	{ label: "Push received", time: "0.2s" },
	{ label: "Building image", time: "41s" },
	{ label: "Health check", time: "6s" },
	{ label: "Live", time: "" },
];

const DeployPreview = () => {
	const { t } = useTranslation();
	return (
		<div
			aria-hidden
			className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm"
		>
			<div className="flex items-center gap-2 border-b border-white/10 pb-3">
				<span className="size-2.5 rounded-full bg-[var(--brand-live)] shadow-[0_0_0_4px_color-mix(in_oklch,var(--brand-live)_20%,transparent)]" />
				<span className="font-medium">portfolio</span>
				<span className="ml-auto font-mono text-xs text-white/50">main</span>
			</div>
			<ol className="mt-3 space-y-1">
				{STAGES.map(({ label, time }) => (
					<li
						key={label}
						className="flex items-center gap-3 rounded-md px-2 py-1.5 text-white/85"
					>
						<span className="grid size-4 place-items-center rounded-full bg-[var(--brand-live)] text-black">
							<Check className="size-3" strokeWidth={3} />
						</span>
						{t(label)}
						<span className="ml-auto font-mono text-xs text-white/50">
							{time}
						</span>
					</li>
				))}
			</ol>
			<div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
				<div className="h-full w-full rounded-full bg-[var(--brand-live)]" />
			</div>
			<p className="mt-4 rounded-md bg-white/[0.04] px-3 py-2 font-mono text-xs text-white/80">
				https://portfolio.example.dev
			</p>
		</div>
	);
};

export const OnboardingLayout = ({ children, leftPanel }: Props) => {
	const { config: whitelabeling } = useWhitelabelingPublic();
	const { t } = useTranslation();
	const appName = whitelabeling?.appName || "LaunchForge";
	const logoUrl =
		whitelabeling?.loginLogoUrl || whitelabeling?.logoUrl || undefined;
	const logoLightUrl =
		whitelabeling?.loginLogoLightUrl ||
		whitelabeling?.logoLightUrl ||
		undefined;

	const points = [
		t("Apps, databases and Compose stacks on servers you control"),
		t("HTTPS, health-checked rollouts and one-click rollback"),
		t("A private, isolated workspace for every team"),
	];

	return (
		<div className="relative grid min-h-svh w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			{/* The brand panel stays dark in both themes, like the product site. */}
			<aside className="relative hidden flex-col overflow-hidden bg-black bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:56px_56px] p-10 text-zinc-50 lg:flex">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_30%_0%,rgba(91,91,246,0.28),transparent_65%),radial-gradient(ellipse_90%_70%_at_50%_100%,#000_30%,transparent)]"
				/>
				<Link
					href="/"
					className="relative z-10 flex items-center gap-3 text-lg font-semibold tracking-tight"
				>
					<Logo
						className="size-9"
						logoUrl={logoUrl}
						logoLightUrl={logoLightUrl}
					/>
					{appName}
				</Link>
				<div className="relative z-10 my-auto max-w-md py-12">
					{leftPanel ?? (
						<>
							<h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.04em] xl:text-5xl">
								{whitelabeling?.appDescription ||
									t("Push to git. Get a live URL. On your own servers.")}
							</h2>
							<ul className="mt-8 space-y-3 text-[0.95rem] text-white/75">
								{points.map((point) => (
									<li key={point} className="flex gap-3">
										<Check
											className="mt-0.5 size-4 shrink-0 text-[var(--brand-live)]"
											strokeWidth={2.5}
										/>
										{point}
									</li>
								))}
							</ul>
							<div className="mt-10">
								<DeployPreview />
							</div>
						</>
					)}
				</div>
			</aside>
			<main className="flex min-h-svh w-full flex-col">
				<div className="flex items-center justify-end gap-2 p-4">
					<LanguageSwitcher />
				</div>
				<div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center space-y-6 px-6 py-8">
					{children}
				</div>
				<div className="mx-auto flex w-full max-w-md items-center justify-center px-6 pb-6 text-muted-foreground">
					<Button variant="ghost" size="icon" asChild>
						<Link
							href="https://github.com/Aayushajs/LaunchForge-OS"
							aria-label="GitHub"
						>
							<GithubIcon />
						</Link>
					</Button>
				</div>
			</main>
		</div>
	);
};
