import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { DEFAULT_LOCALE, isLocale, type Locale, matchLocale } from "./locales";
import { MESSAGES } from "./messages";

export { LOCALES, type Locale } from "./locales";

const STORAGE_KEY = "lf-locale";

type Vars = Record<string, string | number>;

export const translate = (locale: Locale, text: string, vars?: Vars) => {
	const template = MESSAGES[locale][text] ?? text;
	if (!vars) return template;
	return template.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in vars ? String(vars[name]) : match,
	);
};

interface I18nValue {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	t: (text: string, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue>({
	locale: DEFAULT_LOCALE,
	setLocale: () => {},
	t: (text, vars) => translate(DEFAULT_LOCALE, text, vars),
});

const readStoredLocale = () => {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return isLocale(stored) ? stored : null;
	} catch {
		return null;
	}
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
	// The server always renders English; the saved or browser language is
	// applied after hydration so server and client markup match.
	const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

	useEffect(() => {
		setLocaleState(readStoredLocale() ?? matchLocale(navigator.languages));
	}, []);

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next);
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {}
	}, []);

	const value = useMemo<I18nValue>(
		() => ({
			locale,
			setLocale,
			t: (text, vars) => translate(locale, text, vars),
		}),
		[locale, setLocale],
	);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = () => useContext(I18nContext);
