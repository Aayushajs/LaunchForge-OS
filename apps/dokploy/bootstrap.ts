import { exit } from "node:process";
import { setupDirectories } from "@dokploy/server/setup/config-paths";
import {
	createDefaultMiddlewares,
	createDefaultServerTraefikConfig,
	createDefaultTraefikConfig,
	initializeStandaloneTraefik,
} from "@dokploy/server/setup/traefik-setup";

/**
 * One-time host bootstrap run by scripts/install.sh from inside the panel
 * image (with the Docker socket and /etc/dokploy mounted). Swarm, the
 * network, secrets and Postgres are created by the installer itself.
 */
(async () => {
	try {
		setupDirectories();
		createDefaultMiddlewares();
		createDefaultTraefikConfig();
		createDefaultServerTraefikConfig();
		await initializeStandaloneTraefik();
		console.log("LaunchForge bootstrap completed");
		exit(0);
	} catch (error) {
		console.error("LaunchForge bootstrap failed", error);
		exit(1);
	}
})();
