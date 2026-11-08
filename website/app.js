(() => {
	const messages = window.LF_MESSAGES;
	const config = window.LF_CONFIG ?? {};
	const root = document.documentElement;
	const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
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

	// Language
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
		document.getElementById("lang-current").textContent = code.toUpperCase();
		for (const item of document.querySelectorAll("[data-lang]")) {
			item.setAttribute("aria-checked", String(item.dataset.lang === code));
		}
		requestAnimationFrame(movePill);
	};

	document.getElementById("lang-select").addEventListener("change", (event) => {
		applyLanguage(event.target.value);
		store.set("lf-lang", event.target.value);
	});

	for (const item of document.querySelectorAll("[data-lang]")) {
		item.addEventListener("click", () => {
			applyLanguage(item.dataset.lang);
			store.set("lf-lang", item.dataset.lang);
			const menu = item.closest(".menu");
			menu.classList.remove("open");
			menu
				.querySelector(".menu-trigger")
				.setAttribute("aria-expanded", "false");
		});
	}

	document.getElementById("theme-toggle").addEventListener("click", () => {
		const next = root.dataset.theme === "dark" ? "light" : "dark";
		root.dataset.theme = next;
		store.set("lf-theme", next);
	});

	// Header menus: open on hover with a pointer, on click otherwise.
	const menus = [...document.querySelectorAll(".menu")];
	const setOpen = (menu, open) => {
		menu.classList.toggle("open", open);
		menu
			.querySelector(".menu-trigger")
			.setAttribute("aria-expanded", String(open));
	};
	for (const menu of menus) {
		const trigger = menu.querySelector(".menu-trigger");
		let closeTimer;
		menu.addEventListener("pointerenter", (event) => {
			if (event.pointerType !== "mouse") return;
			clearTimeout(closeTimer);
			for (const other of menus) setOpen(other, other === menu);
		});
		menu.addEventListener("pointerleave", (event) => {
			if (event.pointerType !== "mouse") return;
			closeTimer = setTimeout(() => setOpen(menu, false), 120);
		});
		trigger.addEventListener("click", () => {
			const open = !menu.classList.contains("open");
			for (const other of menus) setOpen(other, false);
			setOpen(menu, open);
		});
	}
	document.addEventListener("click", (event) => {
		if (!event.target.closest(".menu"))
			for (const menu of menus) setOpen(menu, false);
	});
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") for (const menu of menus) setOpen(menu, false);
	});

	const burger = document.querySelector(".burger");
	const mobileNav = document.getElementById("mobile-nav");
	burger.addEventListener("click", () => {
		const open = mobileNav.hidden;
		mobileNav.hidden = !open;
		burger.setAttribute("aria-expanded", String(open));
	});
	mobileNav.addEventListener("click", (event) => {
		if (event.target.closest("a")) {
			mobileNav.hidden = true;
			burger.setAttribute("aria-expanded", "false");
		}
	});

	// Sign in and sign up go to the hosted dashboard once one is configured.
	const dialog = document.getElementById("panel-dialog");
	for (const link of document.querySelectorAll("[data-panel]")) {
		if (config.panelUrl) {
			link.href =
				link.dataset.panel === "signup"
					? `${config.panelUrl}/register`
					: config.panelUrl;
			continue;
		}
		link.addEventListener("click", (event) => {
			event.preventDefault();
			dialog.showModal();
		});
	}

	// Copy buttons
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

	// Product tour tabs with a sliding highlight.
	const tabList = document.querySelector(".tabs");
	const pill = tabList.querySelector(".tab-pill");
	const tabs = [...tabList.querySelectorAll('[role="tab"]')];
	const shot = document.getElementById("tour-shot");
	const caption = document.getElementById("tour-caption");
	function movePill() {
		const active = tabList.querySelector('[aria-selected="true"]');
		if (!active) return;
		pill.style.width = `${active.offsetWidth}px`;
		pill.style.height = `${active.offsetHeight}px`;
		pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
	}
	const select = (tab) => {
		for (const other of tabs) {
			other.setAttribute("aria-selected", String(other === tab));
			other.tabIndex = other === tab ? 0 : -1;
		}
		movePill();
		caption.dataset.i18n = tab.dataset.caption;
		caption.textContent = t(tab.dataset.caption);
		const next = `assets/screens/${tab.dataset.shot}.png`;
		if (shot.getAttribute("src") === next) return;
		shot.classList.add("is-loading");
		setTimeout(() => {
			shot.src = next;
		}, 180);
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
	addEventListener("resize", movePill);

	// Feature cells follow the pointer with a soft glow.
	for (const cell of document.querySelectorAll(".cell")) {
		cell.addEventListener("pointermove", (event) => {
			const box = cell.getBoundingClientRect();
			cell.style.setProperty("--mx", `${event.clientX - box.left}px`);
			cell.style.setProperty("--my", `${event.clientY - box.top}px`);
		});
	}

	// Count numbers up when they scroll into view.
	const countUp = (el) => {
		const target = Number(el.dataset.count);
		if (reduceMotion) return;
		const format = new Intl.NumberFormat(language);
		const start = performance.now();
		const tick = (now) => {
			const progress = Math.min(1, (now - start) / 1400);
			const eased = 1 - (1 - progress) ** 3;
			el.textContent = format.format(Math.round(target * eased));
			if (progress < 1) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	};

	// Reveal sections as they scroll into view.
	const revealer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				entry.target.classList.add("is-visible");
				for (const counter of entry.target.querySelectorAll("[data-count]")) {
					countUp(counter);
				}
				revealer.unobserve(entry.target);
			}
		},
		{ threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
	);
	for (const el of document.querySelectorAll("[data-reveal]"))
		revealer.observe(el);

	// The demo plays silently while the laptop is on screen.
	const video = document.getElementById("demo-video");
	const laptop = video.closest(".laptop");
	const playButton = document.getElementById("play-demo");
	const start = () => {
		laptop.classList.add("is-playing");
		video.play().catch(() => laptop.classList.remove("is-playing"));
	};
	playButton.addEventListener("click", () => {
		video.controls = true;
		start();
	});
	video.addEventListener("click", () =>
		video.paused ? start() : video.pause(),
	);
	if (!reduceMotion) {
		new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) start();
				else video.pause();
			},
			{ threshold: 0.35 },
		).observe(video);
	}

	// Live star count, with the dash as a fallback.
	fetch("https://api.github.com/repos/Aayushajs/LaunchForge-OS")
		.then((response) => (response.ok ? response.json() : null))
		.then((repo) => {
			if (typeof repo?.stargazers_count !== "number") return;
			document.getElementById("star-count").textContent = new Intl.NumberFormat(
				"en",
				{ notation: "compact" },
			).format(repo.stargazers_count);
		})
		.catch(() => {});

	// The badge, footer and release count follow the published releases; the
	// markup carries fallbacks for when the GitHub API is unreachable.
	fetch(
		"https://api.github.com/repos/Aayushajs/LaunchForge-OS/releases?per_page=100",
	)
		.then((response) => (response.ok ? response.json() : null))
		.then((releases) => {
			if (!Array.isArray(releases) || releases.length === 0) return;
			const latest = releases[0].tag_name;
			document.getElementById("badge-version").textContent = latest;
			document.getElementById("footer-version").textContent = latest;
			const count = document.getElementById("release-count");
			count.dataset.count = String(releases.length);
			count.textContent = String(releases.length);
		})
		.catch(() => {});

	// Light up a few grid squares behind the hero, each on its own timer.
	const heroGrid = document.getElementById("hero-grid");
	if (!reduceMotion) {
		// Must match the grid's background-size so squares sit in the cells.
		const CELL = 72;
		const centre = Math.floor(heroGrid.offsetWidth / CELL / 2);
		const used = new Set();
		for (let n = 0; n < 14; n++) {
			const col = centre + Math.floor(Math.random() * 16) - 8;
			const row = Math.floor(Math.random() * 7);
			if (used.has(`${col},${row}`)) continue;
			used.add(`${col},${row}`);
			const square = document.createElement("span");
			square.className = "sq";
			square.style.left = `${col * CELL}px`;
			square.style.top = `${row * CELL}px`;
			square.style.animationDelay = `${(Math.random() * 6).toFixed(2)}s`;
			square.style.animationDuration = `${(5 + Math.random() * 4).toFixed(2)}s`;
			heroGrid.append(square);
		}
	}

	// Each stat card gets a corner of tiles, three of which light up.
	for (const corner of document.querySelectorAll(".pixels")) {
		const tiles = [];
		for (let n = 0; n < 42; n++) {
			const tile = document.createElement("b");
			corner.append(tile);
			tiles.push(tile);
		}
		for (let n = 0; n < 3; n++) {
			const tile = tiles[Math.floor(Math.random() * 18)];
			tile.classList.add("on");
			tile.style.animationDelay = `${(Math.random() * 5).toFixed(2)}s`;
		}
	}

	applyLanguage(pickLanguage());
})();
