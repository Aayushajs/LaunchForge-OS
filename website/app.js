(() => {
	const messages = window.LF_MESSAGES;
	const root = document.documentElement;
	const store = {
		get(key) {
			try {
				return localStorage.getItem(key);
			} catch {
				return null;
			}
		},
		set(key, value) {
			try {
				localStorage.setItem(key, value);
			} catch {}
		},
	};

	const pickLanguage = () => {
		const fromUrl = new URLSearchParams(location.search).get("lang");
		const candidates = [fromUrl, store.get("lf-lang"), ...navigator.languages];
		for (const candidate of candidates) {
			const code = candidate?.slice(0, 2).toLowerCase();
			if (code && messages[code]) return code;
		}
		return "en";
	};

	let language = "en";
	const t = (key) => messages[language][key] ?? messages.en[key] ?? key;

	const applyLanguage = (code) => {
		language = code;
		root.lang = code;
		for (const el of document.querySelectorAll("[data-i18n]")) {
			el.textContent = t(el.dataset.i18n);
		}
		for (const el of document.querySelectorAll("[data-i18n-aria]")) {
			el.setAttribute("aria-label", t(el.dataset.i18nAria));
		}
		document.getElementById("lang-select").value = code;
	};

	applyLanguage(pickLanguage());
	document.getElementById("lang-select").addEventListener("change", (event) => {
		applyLanguage(event.target.value);
		store.set("lf-lang", event.target.value);
	});

	document.getElementById("theme-toggle").addEventListener("click", () => {
		const next = root.dataset.theme === "dark" ? "light" : "dark";
		root.dataset.theme = next;
		store.set("lf-theme", next);
	});

	for (const button of document.querySelectorAll("[data-copy]")) {
		const label = button.querySelector("[data-i18n]");
		button.addEventListener("click", async () => {
			const text = document.getElementById(button.dataset.copy).textContent;
			try {
				await navigator.clipboard.writeText(text);
			} catch {
				const range = document.createRange();
				range.selectNodeContents(document.getElementById(button.dataset.copy));
				getSelection().removeAllRanges();
				getSelection().addRange(range);
				return;
			}
			label.textContent = t("hero.copied");
			button.classList.add("is-done");
			setTimeout(() => {
				label.textContent = t("hero.copy");
				button.classList.remove("is-done");
			}, 1800);
		});
	}

	const forge = document.querySelector(".forge");
	const stages = [...forge.querySelectorAll(".stages li")];
	const heat = forge.querySelector(".ingot");

	const show = (step) => {
		stages.forEach((li, index) => {
			li.classList.toggle(
				"is-done",
				index < step || (step === stages.length - 1 && index === step),
			);
			li.classList.toggle(
				"is-active",
				index === step && step < stages.length - 1,
			);
		});
		heat.style.setProperty(
			"--progress",
			`${((step + 1) / stages.length) * 100}%`,
		);
		forge.classList.toggle("is-live", step === stages.length - 1);
	};

	if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
		show(stages.length - 1);
		return;
	}

	const durations = [700, 1900, 1200];
	let step = 0;
	const advance = () => {
		show(step);
		if (step < stages.length - 1) {
			setTimeout(advance, durations[step]);
			step += 1;
		}
	};
	setTimeout(advance, 400);
})();
