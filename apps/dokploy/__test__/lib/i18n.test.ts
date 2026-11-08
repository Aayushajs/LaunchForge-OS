import { describe, expect, it } from "vitest";
import { LOCALES, translate } from "@/lib/i18n";
import { matchLocale } from "@/lib/i18n/locales";
import { MESSAGES } from "@/lib/i18n/messages";

// Product and protocol names read the same in every language.
const UNTRANSLATED = new Set(["Docker", "AI", "Git", "Traefik"]);

describe("i18n", () => {
	it("translates and falls back to the English source text", () => {
		expect(translate("hi", "Projects")).toBe("प्रोजेक्ट");
		expect(translate("de", "Something without a translation")).toBe(
			"Something without a translation",
		);
		expect(translate("en", "Projects")).toBe("Projects");
	});

	it("fills in variables", () => {
		expect(translate("es", "Version {version}", { version: "v0.3.0" })).toBe(
			"Versión v0.3.0",
		);
		expect(translate("en", "Version {version}")).toBe("Version {version}");
	});

	it("picks the first supported browser language", () => {
		expect(matchLocale(["xx-YY", "hi-IN", "en-US"])).toBe("hi");
		expect(matchLocale(["pt-BR"])).toBe("pt");
		expect(matchLocale(["xx"])).toBe("en");
		expect(matchLocale([])).toBe("en");
	});

	it("has every string in every language", () => {
		const keys = new Set(
			Object.values(MESSAGES).flatMap((messages) => Object.keys(messages)),
		);
		for (const { code } of LOCALES) {
			if (code === "en") continue;
			const missing = [...keys].filter(
				(key) => !UNTRANSLATED.has(key) && !(key in MESSAGES[code]),
			);
			expect(missing, `missing ${code} translations`).toEqual([]);
		}
	});

	it("keeps the placeholders of the source text", () => {
		for (const messages of Object.values(MESSAGES)) {
			for (const [source, translated] of Object.entries(messages)) {
				const placeholders = (text: string) =>
					(text.match(/\{\w+\}/g) ?? []).sort();
				expect(placeholders(translated)).toEqual(placeholders(source));
			}
		}
	});
});
