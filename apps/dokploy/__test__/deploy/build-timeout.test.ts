import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@dokploy/server/utils/process/execAsync", () => ({
	execAsync: vi.fn(),
	execAsyncRemote: vi.fn(),
}));

const { BuildTimeoutError, buildTimeoutMs, runWithBuildTimeout } = await import(
	"@dokploy/server/utils/builders/build-timeout"
);

afterEach(() => {
	delete process.env.BUILD_TIMEOUT_SECONDS;
});

describe("runWithBuildTimeout", () => {
	it("returns the build result when it finishes in time", async () => {
		const onTimeout = vi.fn(async () => {});
		await expect(
			runWithBuildTimeout(async () => "built", onTimeout, 1000),
		).resolves.toBe("built");
		expect(onTimeout).not.toHaveBeenCalled();
	});

	it("kills the build and fails once the limit is reached", async () => {
		const onTimeout = vi.fn(async () => {});
		const hung = () => new Promise<string>(() => {});
		await expect(
			runWithBuildTimeout(hung, onTimeout, 20),
		).rejects.toBeInstanceOf(BuildTimeoutError);
		expect(onTimeout).toHaveBeenCalledTimes(1);
	});

	it("passes build failures through unchanged", async () => {
		await expect(
			runWithBuildTimeout(
				async () => {
					throw new Error("nixpacks failed");
				},
				async () => {},
				1000,
			),
		).rejects.toThrow("nixpacks failed");
	});
});

describe("buildTimeoutMs", () => {
	it("defaults to one hour and can be disabled", () => {
		expect(buildTimeoutMs()).toBe(3_600_000);
		process.env.BUILD_TIMEOUT_SECONDS = "0";
		expect(buildTimeoutMs()).toBeUndefined();
		process.env.BUILD_TIMEOUT_SECONDS = "900";
		expect(buildTimeoutMs()).toBe(900_000);
	});
});
