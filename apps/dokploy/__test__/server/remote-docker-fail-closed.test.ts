import { describe, expect, it, vi } from "vitest";

const server = {
	name: "edge-1",
	ipAddress: "10.0.0.5",
	port: 22,
	username: "root",
};

vi.mock("@dokploy/server/services/server", () => ({
	findServerById: vi.fn(async (serverId: string) =>
		serverId === "no-key"
			? { ...server, sshKeyId: null, sshKey: null }
			: { ...server, sshKeyId: "key-1", sshKey: { privateKey: "KEY" } },
	),
}));

const { getRemoteDocker } = await import(
	"@dokploy/server/utils/servers/remote-docker"
);
const { docker: localDocker } = await import("@dokploy/server/constants");

describe("getRemoteDocker", () => {
	it("uses the local daemon only when no server is requested", async () => {
		expect(await getRemoteDocker(undefined)).toBe(localDocker);
	});

	it("refuses to fall back to the local daemon for a server without an SSH key", async () => {
		await expect(getRemoteDocker("no-key")).rejects.toThrow(/no SSH key/);
	});

	it("connects over SSH when the server has a key", async () => {
		const client = await getRemoteDocker("with-key");
		expect(client).not.toBe(localDocker);
	});
});
