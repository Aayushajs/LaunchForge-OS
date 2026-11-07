export const PRODUCT_REPO_URL = "https://github.com/Aayushajs/LaunchForge-OS";

export interface BrandingConfig {
	appName: string;
	appDescription: string;
	logoUrl: string | null;
	logoLightUrl: string | null;
	loginLogoUrl: string | null;
	loginLogoLightUrl: string | null;
	faviconUrl: string | null;
	faviconLightUrl: string | null;
	ogImageUrl: string | null;
	docsUrl: string;
	supportUrl: string;
	supportEmail: string | null;
	footerText: string | null;
	errorPageTitle: string | null;
	errorPageDescription: string | null;
	passwordResetGuide: string | null;
}

export const BRANDING: BrandingConfig = {
	appName: "LaunchForge",
	appDescription: "Push to Git. Ship to production. On servers you own.",
	logoUrl: null,
	logoLightUrl: null,
	loginLogoUrl: null,
	loginLogoLightUrl: null,
	faviconUrl: null,
	faviconLightUrl: null,
	ogImageUrl: null,
	docsUrl: `${PRODUCT_REPO_URL}#readme`,
	supportUrl: `${PRODUCT_REPO_URL}/issues`,
	supportEmail: null,
	footerText: null,
	errorPageTitle: null,
	errorPageDescription: null,
	passwordResetGuide: null,
};
