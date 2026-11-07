import { describe, expect, it, vi } from "vitest";

vi.mock("@dokploy/server/db", () => ({ db: {} }));
vi.mock("@dokploy/server/utils/process/execAsync", () => ({
	execAsync: vi.fn(),
	execAsyncRemote: vi.fn(),
}));

const { aggregateSamples, parseCpuCores, parseMemoryMb, startOfHour } =
	await import("@dokploy/server/utils/metering/collector");

describe("docker stats parsing", () => {
	it("reads memory in any unit as MB", () => {
		expect(parseMemoryMb("512MiB / 1.9GiB")).toBe(512);
		expect(parseMemoryMb("1.5GiB / 4GiB")).toBe(1536);
		expect(parseMemoryMb("2048KiB / 1GiB")).toBe(2);
		expect(parseMemoryMb("garbage")).toBe(0);
	});

	it("reads CPU percentages as cores", () => {
		expect(parseCpuCores("150.00%")).toBe(1.5);
		expect(parseCpuCores("0.50%")).toBe(0.005);
		expect(parseCpuCores("--")).toBe(0);
	});
});

describe("aggregateSamples", () => {
	const ps = [
		"aaaaaaaaaaaa org-a",
		"bbbbbbbbbbbb org-a",
		"cccccccccccc org-b",
		"dddddddddddd",
	].join("\n");
	const stats = [
		JSON.stringify({
			ID: "aaaaaaaaaaaa",
			CPUPerc: "50%",
			MemUsage: "100MiB / 2GiB",
		}),
		JSON.stringify({
			ID: "bbbbbbbbbbbb",
			CPUPerc: "25%",
			MemUsage: "50MiB / 2GiB",
		}),
		JSON.stringify({
			ID: "cccccccccccc",
			CPUPerc: "100%",
			MemUsage: "1GiB / 2GiB",
		}),
		JSON.stringify({
			ID: "dddddddddddd",
			CPUPerc: "90%",
			MemUsage: "900MiB / 2GiB",
		}),
		"not json",
	].join("\n");

	it("sums containers per workspace and skips unlabelled ones", () => {
		const samples = aggregateSamples(ps, stats).sort((x, y) =>
			x.organizationId.localeCompare(y.organizationId),
		);
		expect(samples).toEqual([
			{ organizationId: "org-a", cpuCores: 0.75, memoryMb: 150, containers: 2 },
			{ organizationId: "org-b", cpuCores: 1, memoryMb: 1024, containers: 1 },
		]);
	});
});

describe("startOfHour", () => {
	it("truncates to the UTC hour", () => {
		expect(
			startOfHour(new Date("2026-11-07T10:47:13.500Z")).toISOString(),
		).toBe("2026-11-07T10:00:00.000Z");
	});
});
