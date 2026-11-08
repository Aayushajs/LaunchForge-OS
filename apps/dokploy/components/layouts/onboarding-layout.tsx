import Link from "next/link";
import type React from "react";
import { useTranslation } from "@/lib/i18n";
import { useWhitelabelingPublic } from "@/utils/hooks/use-whitelabeling";
import { LanguageSwitcher } from "../shared/language-switcher";
import { Logo } from "../shared/logo";

interface Props {
	children: React.ReactNode;
	/** Kept for pages that still pass it; the layout has no side panel. */
	leftPanel?: React.ReactNode;
}

/**
 * Sign-in, sign-up and invitation pages: one centred column on a quiet grid,
 * with the product name above and plain links below.
 */
export const OnboardingLayout = ({ children }: Props) => {
	const { config: whitelabeling } = useWhitelabelingPublic();
	const { t } = useTranslation();
	const appName = whitelabeling?.appName || "LaunchForge";
	const logoUrl =
		whitelabeling?.loginLogoUrl || whitelabeling?.logoUrl || undefined;
	const logoLightUrl =
		whitelabeling?.loginLogoLightUrl ||
		whitelabeling?.logoLightUrl ||
		undefined;

	return (
		<div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_55%_at_50%_40%,#000_20%,transparent_75%)]"
			/>

			<header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
				<Link
					href="/"
					className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight"
				>
					<Logo
						className="size-7"
						logoUrl={logoUrl}
						logoLightUrl={logoLightUrl}
					/>
					{appName}
				</Link>
				<LanguageSwitcher />
			</header>

			<main className="relative z-10 flex flex-1 items-center justify-center px-6 py-10">
				<div className="w-full max-w-[400px]">{children}</div>
			</main>

			<footer className="relative z-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 pb-8 text-xs text-muted-foreground">
				<Link
					href="https://github.com/Aayushajs/LaunchForge-OS/tree/main/docs"
					className="hover:text-foreground"
					target="_blank"
				>
					{t("Documentation")}
				</Link>
				<Link
					href="https://github.com/Aayushajs/LaunchForge-OS"
					className="hover:text-foreground"
					target="_blank"
				>
					GitHub
				</Link>
				<Link
					href="https://github.com/Aayushajs/LaunchForge-OS/blob/main/SECURITY.md"
					className="hover:text-foreground"
					target="_blank"
				>
					{t("Security")}
				</Link>
			</footer>
		</div>
	);
};
