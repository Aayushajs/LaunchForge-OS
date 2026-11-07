import { beforeEach, describe, expect, it, vi } from "vitest";

const MB = 1024 * 1024;
const NANO = 1_000_000_000;

const state = {
	quota: null as Record<string, number | null> | null,
	// Rows returned per service table, in resourceTables order.
	serviceRows: [] as Array<
		Array<{ id: string; memoryLimit: string | null; cpuLimit: string | null }>
	>,
};

vi.mock("@dokploy/server/db", () => {
	let call = 0;
	const select = vi.fn(() => {
		const index = call++;
		const builder = {
			from: () => builder,
			innerJoin: () => builder,
			where: () =>
				Promise.resolve(
					index === 0
						? [{ environmentId: "env-1" }]
						: (state.serviceRows[index - 1] ?? []),
				),
		};
		return builder;
	});
	return {
		db: {
			select,
			query: {
				workspaceQuota: {
					findFirst: vi.fn(async () => state.quota),
				},
			},
		},
		__resetCalls: () => {
			call = 0;
		},
	};
});

const dbModule = (await import("@dokploy/server/db")) as unknown as {
	__resetCalls: () => void;
};
const { withWorkspaceQuota, QuotaExceededError } = await import(
	"@dokploy/server/services/workspace-quota"
);

const resources = (memoryMb?: number, cpu?: number) => ({
	Limits: {
		MemoryBytes: memoryMb ? memoryMb * MB : undefined,
		NanoCPUs: cpu ? cpu * NANO : undefined,
	},
	Reservations: {},
});

beforeEach(() => {
	dbModule.__resetCalls();
	state.quota = null;
	state.serviceRows = [];
});

describe("withWorkspaceQuota", () => {
	it("leaves resources untouched when the workspace has no quota", async () => {
		const input = resources();
		expect(await withWorkspaceQuota("org-1", "app-1", input)).toBe(input);
	});

	it("applies default limits to services that set none", async () => {
		state.quota = { maxMemoryMb: 4096, maxCpu: 4 };
		const result = await withWorkspaceQuota("org-1", "app-1", resources());
		expect(result.Limits?.MemoryBytes).toBe(512 * MB);
		expect(result.Limits?.NanoCPUs).toBe(0.5 * NANO);
	});

	it("allows a deploy that fits in the remaining quota", async () => {
		state.quota = { maxMemoryMb: 2048, maxCpu: 2 };
		state.serviceRows = [
			[{ id: "other", memoryLimit: String(1024 * MB), cpuLimit: String(NANO) }],
		];
		const result = await withWorkspaceQuota(
			"org-1",
			"app-1",
			resources(1024, 1),
		);
		expect(result.Limits?.MemoryBytes).toBe(1024 * MB);
	});

	it("rejects a deploy that would exceed the memory quota", async () => {
		state.quota = { maxMemoryMb: 1024, maxCpu: null };
		state.serviceRows = [
			[{ id: "other", memoryLimit: String(768 * MB), cpuLimit: null }],
		];
		await expect(
			withWorkspaceQuota("org-1", "app-1", resources(512)),
		).rejects.toBeInstanceOf(QuotaExceededError);
	});

	it("counts unlimited services at the default when summing the quota", async () => {
		state.quota = { maxMemoryMb: null, maxCpu: 1 };
		state.serviceRows = [
			[{ id: "a", memoryLimit: null, cpuLimit: null }],
			[{ id: "b", memoryLimit: null, cpuLimit: null }],
		];
		await expect(
			withWorkspaceQuota("org-1", "app-1", resources(undefined, 0.25)),
		).rejects.toThrow(/CPU quota exceeded/);
	});

	it("does not count the service being redeployed twice", async () => {
		state.quota = { maxMemoryMb: 1024, maxCpu: null };
		state.serviceRows = [
			[{ id: "app-1", memoryLimit: String(1024 * MB), cpuLimit: null }],
		];
		await expect(
			withWorkspaceQuota("org-1", "app-1", resources(1024)),
		).resolves.toBeDefined();
	});
});
