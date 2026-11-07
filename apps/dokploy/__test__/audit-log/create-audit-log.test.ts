import { beforeEach, describe, expect, it, vi } from "vitest";

const values = vi.fn();

vi.mock("@dokploy/server/db", () => ({
	db: { insert: vi.fn(() => ({ values })) },
}));

const { createAuditLog } = await import("@dokploy/server/services/audit-log");

const baseInput = {
	organizationId: "org-1",
	userId: "user-1",
	userEmail: "owner@example.com",
	userRole: "owner",
	action: "deploy" as const,
	resourceType: "application" as const,
};

describe("createAuditLog", () => {
	beforeEach(() => {
		values.mockReset();
	});

	it("writes every event without requiring a license", async () => {
		values.mockResolvedValue(undefined);
		await createAuditLog({ ...baseInput, resourceName: "portfolio" });
		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId: "org-1",
				action: "deploy",
				resourceName: "portfolio",
				resourceId: null,
				metadata: null,
			}),
		);
	});

	it("serializes metadata as JSON", async () => {
		values.mockResolvedValue(undefined);
		await createAuditLog({ ...baseInput, metadata: { branch: "main" } });
		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({ metadata: '{"branch":"main"}' }),
		);
	});

	it("never fails the caller when the insert fails", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		values.mockRejectedValue(new Error("db down"));
		await expect(createAuditLog(baseInput)).resolves.toBeUndefined();
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});
});
