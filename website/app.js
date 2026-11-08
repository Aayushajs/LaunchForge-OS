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
		button.addEventListener("click", async () => {
			const source = document.getElementById(button.dataset.copy);
			try {
				await navigator.clipboard.writeText(source.textContent);
			} catch {
				const range = document.createRange();
				range.selectNodeContents(source);
				getSelection().removeAllRanges();
				getSelection().addRange(range);
				return;
			}
			button.classList.add("is-done");
			setTimeout(() => button.classList.remove("is-done"), 1800);
		});
	}

	const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
	const shot = document.getElementById("tour-shot");
	const caption = document.getElementById("tour-caption");
	const select = (tab) => {
		for (const other of tabs) {
			other.setAttribute("aria-selected", String(other === tab));
			other.tabIndex = other === tab ? 0 : -1;
		}
		caption.dataset.i18n = tab.dataset.caption;
		caption.textContent = t(tab.dataset.caption);
		shot.classList.add("is-loading");
		shot.src = `assets/screens/${tab.dataset.shot}.png`;
	};
	shot.addEventListener("load", () => shot.classList.remove("is-loading"));
	tabs.forEach((tab, index) => {
		tab.tabIndex = index === 0 ? 0 : -1;
		tab.addEventListener("click", () => select(tab));
		tab.addEventListener("keydown", (event) => {
			const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
			if (!step) return;
			const next = tabs[(index + step + tabs.length) % tabs.length];
			next.focus();
			select(next);
		});
	});

	const video = document.getElementById("demo-video");
	const card = video.closest(".video-card");
	document.getElementById("play-demo").addEventListener("click", () => {
		card.classList.add("is-playing");
		video.play();
	});
	video.addEventListener("play", () => card.classList.add("is-playing"));

	// The header shows the latest release; the markup carries a fallback.
	fetch("https://api.github.com/repos/Aayushajs/LaunchForge-OS/releases/latest")
		.then((response) => (response.ok ? response.json() : null))
		.then((release) => {
			if (release?.tag_name) {
				document.getElementById("gh-version").textContent = release.tag_name;
			}
		})
		.catch(() => {});
})();
