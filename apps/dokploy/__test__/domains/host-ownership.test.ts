import { beforeEach, describe, expect, it, vi } from "vitest";

const selectResults: unknown[][] = [];
const environmentOf: Record<string, string> = {};

vi.mock("@dokploy/server/db", () => {
	const chain = () => {
		const result = selectResults.shift() ?? [];
		const builder = {
			from: () => builder,
			leftJoin: () => builder,
			innerJoin: () => builder,
			where: () => Promise.resolve(result),
		};
		return builder;
	};
	return {
		db: {
			select: vi.fn(chain),
			query: {
				applications: {
					findFirst: vi.fn(async () => ({
						environmentId: environmentOf.target,
					})),
				},
				compose: { findFirst: vi.fn(async () => undefined) },
				previewDeployments: { findFirst: vi.fn(async () => undefined) },
			},
		},
	};
});

const { assertHostAvailable, normalizeHost, normalizePath } = await import(
	"@dokploy/server/services/domain-ownership"
);

const existingDomain = (environment: string, path = "/") => ({
	domainId: "domain-1",
	path,
	applicationEnv: environment,
	composeEnv: null,
	previewApplicationId: null,
});

const orgRows = (rows: Array<[string, string]>) =>
	rows.map(([environmentId, organizationId]) => ({
		environmentId,
		organizationId,
	}));

beforeEach(() => {
	selectResults.length = 0;
	environmentOf.target = "env-mine";
});

describe("normalizeHost / normalizePath", () => {
	it("compares hosts case-insensitively, without a trailing dot, as punycode", () => {
		expect(normalizeHost("  Portfolio.Example.COM. ")).toBe(
			"portfolio.example.com",
		);
		expect(normalizeHost("bücher.de")).toBe("xn--bcher-kva.de");
	});

	it("treats empty and trailing-slash paths consistently", () => {
		expect(normalizePath(undefined)).toBe("/");
		expect(normalizePath("")).toBe("/");
		expect(normalizePath("/api/")).toBe("/api");
	});
});

describe("assertHostAvailable", () => {
	it("allows a host nobody uses yet", async () => {
		selectResults.push([]);
		await expect(
			assertHostAvailable("new.example.com", "/", { applicationId: "app" }),
		).resolves.toBeUndefined();
	});

	it("blocks a host already routed by another workspace", async () => {
		selectResults.push([existingDomain("env-theirs")]);
		selectResults.push(
			orgRows([
				["env-theirs", "org-b"],
				["env-mine", "org-a"],
			]),
		);
		await expect(
			assertHostAvailable("shop.example.com", "/blog", {
				applicationId: "app",
			}),
		).rejects.toThrow(/another workspace/);
	});

	it("lets the owning workspace split a host by path", async () => {
		selectResults.push([existingDomain("env-mine", "/")]);
		selectResults.push(orgRows([["env-mine", "org-a"]]));
		await expect(
			assertHostAvailable("me.example.com", "/api", { applicationId: "app" }),
		).resolves.toBeUndefined();
	});

	it("blocks the same host and path twice, even within a workspace", async () => {
		selectResults.push([existingDomain("env-mine", "/api")]);
		selectResults.push(orgRows([["env-mine", "org-a"]]));
		await expect(
			assertHostAvailable("me.example.com", "/api/", { applicationId: "app" }),
		).rejects.toThrow(/another service/);
	});
});
