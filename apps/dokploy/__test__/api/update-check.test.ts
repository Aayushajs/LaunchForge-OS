import { afterEach, describe, expect, it, vi } from "vitest";

const { getUpdateData, getLaunchForgeImageFor, LAUNCHFORGE_RELEASES_URL } =
	await import("@dokploy/server/services/settings");

const mockLatestRelease = (body: unknown, ok = true) =>
	vi.spyOn(globalThis, "fetch").mockResolvedValue({
		ok,
		json: async () => body,
	} as Response);

afterEach(() => {
	vi.restoreAllMocks();
	delete process.env.LAUNCHFORGE_IMAGE;
});

describe("update check", () => {
	it("asks LaunchForge's own GitHub releases, not the upstream registry", async () => {
		const fetchSpy = mockLatestRelease({ tag_name: "v0.2.0" });

		await getUpdateData("v0.1.0");

		expect(fetchSpy).toHaveBeenCalledWith(
			LAUNCHFORGE_RELEASES_URL,
			expect.anything(),
		);
		expect(LAUNCHFORGE_RELEASES_URL).toContain("Aayushajs/LaunchForge-OS");
	});

	it("reports an update when the latest release is newer", async () => {
		mockLatestRelease({ tag_name: "v0.2.0" });

		await expect(getUpdateData("v0.1.0")).resolves.toEqual({
			latestVersion: "v0.2.0",
			updateAvailable: true,
		});
	});

	it("reports no update on the latest release", async () => {
		mockLatestRelease({ tag_name: "v0.1.0" });

		await expect(getUpdateData("v0.1.0")).resolves.toEqual({
			latestVersion: "v0.1.0",
			updateAvailable: false,
		});
	});

	it("reports no update when GitHub is unreachable or rate limited", async () => {
		mockLatestRelease({ message: "API rate limit exceeded" }, false);

		await expect(getUpdateData("v0.1.0")).resolves.toEqual({
			latestVersion: null,
			updateAvailable: false,
		});
	});

	it("maps a release tag to the matching image tag", () => {
		expect(getLaunchForgeImageFor("v1.4.2")).toBe(
			"ghcr.io/aayushajs/launchforge:1.4.2",
		);
		process.env.LAUNCHFORGE_IMAGE = "registry.example.com/me/launchforge";
		expect(getLaunchForgeImageFor("v1.4.2")).toBe(
			"registry.example.com/me/launchforge:1.4.2",
		);
	});
});
