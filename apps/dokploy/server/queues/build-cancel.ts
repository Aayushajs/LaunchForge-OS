const escapeRegex = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds the pkill pattern for one service's build processes. Matching only
 * on "docker build" used to cancel every build on the host, including other
 * workspaces' builds.
 */
export const buildCancelPattern = (
	type: "application" | "compose",
	appName: string,
) => {
	const name = escapeRegex(appName);
	return type === "application"
		? `(docker (buildx )?build|nixpacks build|pack build|railpack).*${name}`
		: `docker compose.*-p ${name}`;
};
