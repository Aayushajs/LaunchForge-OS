import { docker } from "@dokploy/server/constants";
import { findServerById } from "@dokploy/server/services/server";
import Dockerode from "dockerode";
import { sshKeepalive } from "../process/execAsync";

export const getRemoteDocker = async (serverId?: string | null) => {
	if (!serverId) return docker;
	const server = await findServerById(serverId);
	// Falling back to the local daemon here would run another workspace's
	// remote operation against the control-plane host.
	if (!server.sshKeyId) {
		throw new Error(
			`Server ${server.name} has no SSH key; add one before using it.`,
		);
	}
	const dockerode = new Dockerode({
		host: server.ipAddress,
		port: server.port,
		username: server.username,
		protocol: "ssh",
		// @ts-expect-error
		sshOptions: {
			privateKey: server.sshKey?.privateKey,
			...sshKeepalive,
		},
	});

	return dockerode;
};
