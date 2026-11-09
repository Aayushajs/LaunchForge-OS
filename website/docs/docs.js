(() => {
	const root = document.documentElement;
	const config = window.LF_CONFIG ?? {};
	const pages = window.LF_DOCS_INDEX ?? [];
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

	document.getElementById("theme-toggle").addEventListener("click", () => {
		const next = root.dataset.theme === "dark" ? "light" : "dark";
		root.dataset.theme = next;
		store.set("lf-theme", next);
	});

	// Header menus behave as on the landing page: hover with a mouse, click otherwise.
	const menus = [...document.querySelectorAll(".site-header .menu")];
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

	const burger = document.querySelector(".burger");
	const mobileNav = document.getElementById("mobile-nav");
	burger.addEventListener("click", () => {
		const open = mobileNav.hidden;
		mobileNav.hidden = !open;
		burger.setAttribute("aria-expanded", String(open));
	});

	const panelDialog = document.getElementById("panel-dialog");
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
			panelDialog.showModal();
		});
	}

	const copyText = async (button, text, fallbackNode) => {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			const range = document.createRange();
			range.selectNodeContents(fallbackNode);
			getSelection().removeAllRanges();
			getSelection().addRange(range);
			return;
		}
		button.classList.add("is-done");
		button.setAttribute("aria-label", "Copied");
		setTimeout(() => {
			button.classList.remove("is-done");
			button.setAttribute("aria-label", "Copy code");
		}, 1800);
	};
	for (const button of document.querySelectorAll("[data-copy]")) {
		const source = document.getElementById(button.dataset.copy);
		button.addEventListener("click", () =>
			copyText(button, source.textContent, source),
		);
	}
	for (const button of document.querySelectorAll("[data-copy-code]")) {
		const code = button.closest(".code").querySelector("code");
		button.addEventListener("click", () =>
			copyText(button, code.textContent.replace(/\n$/, ""), code),
		);
	}

	// Below 900px the sidebar becomes a full-height drawer under the docs bar.
	const sidebar = document.getElementById("docs-sidebar");
	const menuButton = document.querySelector(".docs-menu-btn");
	const setSidebar = (open) => {
		sidebar.classList.toggle("is-open", open);
		menuButton.setAttribute("aria-expanded", String(open));
		document.body.classList.toggle("nav-open", open);
	};
	menuButton.addEventListener("click", () =>
		setSidebar(!sidebar.classList.contains("is-open")),
	);
	matchMedia("(min-width: 901px)").addEventListener("change", () =>
		setSidebar(false),
	);
	sidebar
		.querySelector('[aria-current="page"]')
		?.scrollIntoView({ block: "nearest" });

	const tocLinks = [...document.querySelectorAll(".docs-toc a")];
	if (tocLinks.length) {
		const headings = tocLinks
			.map((link) => document.getElementById(link.hash.slice(1)))
			.filter(Boolean);
		const markActive = () => {
			const offset =
				Number.parseFloat(
					getComputedStyle(root).getPropertyValue("--header-h"),
				) + 40;
			let current = headings[0];
			for (const heading of headings) {
				if (heading.getBoundingClientRect().top - offset <= 0)
					current = heading;
			}
			const atBottom =
				innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
			if (atBottom) current = headings[headings.length - 1];
			for (const link of tocLinks) {
				link.classList.toggle("is-active", link.hash === `#${current.id}`);
			}
		};
		let queued = false;
		addEventListener(
			"scroll",
			() => {
				if (queued) return;
				queued = true;
				requestAnimationFrame(() => {
					queued = false;
					markActive();
				});
			},
			{ passive: true },
		);
		markActive();
	}

	// Search over page titles, descriptions and headings from search-index.js.
	const dialog = document.getElementById("search-dialog");
	const input = document.getElementById("search-input");
	const list = document.getElementById("search-results");
	const entries = pages.flatMap((page) => [
		{
			title: page.t,
			path: page.s,
			url: page.u,
			haystack: `${page.t} ${page.s}`.toLowerCase(),
			extra: page.d.toLowerCase(),
			page: true,
		},
		...page.h.map(([text, id]) => ({
			title: text,
			path: `${page.s} / ${page.t}`,
			url: `${page.u}#${id}`,
			haystack: `${text} ${page.t}`.toLowerCase(),
			extra: "",
			page: false,
		})),
	]);
	const suggested = [
		"quickstart.html",
		"deploy-a-portfolio.html",
		"applications.html",
		"domains.html",
		"troubleshooting.html",
	];

	const score = (entry, terms, query) => {
		const title = entry.title.toLowerCase();
		let total = 0;
		for (const term of terms) {
			if (entry.haystack.includes(term)) total += 10;
			else if (entry.extra.includes(term)) total += 3;
			else return 0;
		}
		if (title === query) total += 60;
		else if (title.startsWith(query)) total += 40;
		else if (title.includes(query)) total += 20;
		if (entry.page) total += 8;
		return total;
	};

	const escapeHtml = (text) =>
		text.replace(
			/[&<>"]/g,
			(char) =>
				({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char],
		);
	const mark = (text, terms) => {
		let html = escapeHtml(text);
		for (const term of terms) {
			if (term.length < 2) continue;
			const pattern = new RegExp(
				`(${escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
				"ig",
			);
			html = html.replace(pattern, "<mark>$1</mark>");
		}
		return html;
	};

	let results = [];
	let active = 0;
	const renderResults = () => {
		const query = input.value.trim().toLowerCase();
		const terms = query.split(/\s+/).filter(Boolean);
		if (!terms.length) {
			results = suggested
				.map((url) => entries.find((entry) => entry.page && entry.url === url))
				.filter(Boolean);
		} else {
			results = entries
				.map((entry) => ({ entry, value: score(entry, terms, query) }))
				.filter((item) => item.value > 0)
				.sort((a, b) => b.value - a.value)
				.slice(0, 12)
				.map((item) => item.entry);
		}
		active = 0;
		if (!results.length) {
			list.innerHTML = `<p class="search-empty">No results for “${escapeHtml(input.value.trim())}”</p>`;
			input.removeAttribute("aria-activedescendant");
			return;
		}
		const heading = terms.length ? "" : '<p class="r-group">Suggested</p>';
		list.innerHTML =
			heading +
			results
				.map(
					(entry, index) =>
						`<a id="result-${index}" role="option" href="${entry.url}"><span class="r-title">${mark(entry.title, terms)}</span><span class="r-path">${escapeHtml(entry.path)}</span></a>`,
				)
				.join("");
		highlightActive();
	};
	const highlightActive = () => {
		list.querySelectorAll("a").forEach((link, index) => {
			const on = index === active;
			link.classList.toggle("is-active", on);
			link.setAttribute("aria-selected", String(on));
			if (on) {
				input.setAttribute("aria-activedescendant", link.id);
				link.scrollIntoView({ block: "nearest" });
			}
		});
	};

	const openSearch = () => {
		setSidebar(false);
		if (!dialog.open) dialog.showModal();
		input.select();
		renderResults();
	};
	for (const trigger of document.querySelectorAll("[data-search-open]")) {
		trigger.addEventListener("click", openSearch);
	}
	input.addEventListener("input", renderResults);
	input.addEventListener("keydown", (event) => {
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (!results.length) return;
			const step = event.key === "ArrowDown" ? 1 : -1;
			active = (active + step + results.length) % results.length;
			highlightActive();
		} else if (event.key === "Enter" && results[active]) {
			event.preventDefault();
			dialog.close();
			location.href = results[active].url;
		}
	});
	list.addEventListener("click", (event) => {
		if (event.target.closest("a")) dialog.close();
	});
	dialog.addEventListener("click", (event) => {
		if (event.target === dialog) dialog.close();
	});

	document.addEventListener("keydown", (event) => {
		const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(
			document.activeElement?.tagName ?? "",
		);
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
			event.preventDefault();
			openSearch();
		} else if (event.key === "/" && !typing && !dialog.open) {
			event.preventDefault();
			openSearch();
		} else if (event.key === "Escape") {
			for (const menu of menus) setOpen(menu, false);
			if (sidebar.classList.contains("is-open")) {
				setSidebar(false);
				menuButton.focus();
			}
		}
	});

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
})();
