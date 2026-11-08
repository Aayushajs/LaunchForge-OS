export const LOCALES = [
	{ code: "en", label: "English" },
	{ code: "hi", label: "हिन्दी" },
	{ code: "es", label: "Español" },
	{ code: "pt", label: "Português" },
	{ code: "de", label: "Deutsch" },
	{ code: "fr", label: "Français" },
	{ code: "ja", label: "日本語" },
	{ code: "zh", label: "简体中文" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (value: unknown): value is Locale =>
	LOCALES.some((locale) => locale.code === value);

/** Picks the first supported language from a list such as navigator.languages. */
export const matchLocale = (
	candidates: readonly (string | null | undefined)[],
) => {
	for (const candidate of candidates) {
		const code = candidate?.slice(0, 2).toLowerCase();
		if (isLocale(code)) return code;
	}
	return DEFAULT_LOCALE;
};
