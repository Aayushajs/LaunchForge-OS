import { quote } from "shell-quote";
import { execAsync, execAsyncRemote } from "../process/execAsync";

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

export const killBuildProcesses = async (
	type: "application" | "compose",
	appName: string,
	serverId?: string | null,
) => {
	const command = `pkill -2 -f -- ${quote([buildCancelPattern(type, appName)])}`;
	try {
		if (serverId) {
			await execAsyncRemote(serverId, command);
		} else {
			await execAsync(command);
		}
	} catch (error) {
		// pkill exits 1 when nothing matched, which is not an error here.
		console.error(error);
	}
};

const DEFAULT_BUILD_TIMEOUT_SECONDS = 60 * 60;

export const buildTimeoutMs = () => {
	const configured = process.env.BUILD_TIMEOUT_SECONDS;
	if (configured === undefined || configured === "") {
		return DEFAULT_BUILD_TIMEOUT_SECONDS * 1000;
	}
	const seconds = Number(configured);
	if (!Number.isFinite(seconds) || seconds < 0) {
		return DEFAULT_BUILD_TIMEOUT_SECONDS * 1000;
	}
	return seconds === 0 ? undefined : seconds * 1000;
};

export class BuildTimeoutError extends Error {}

/**
 * Runs a build step with an upper time bound. On timeout the build's own
 * processes are killed (via `onTimeout`) so a hung build cannot hold a queue
 * slot forever. BUILD_TIMEOUT_SECONDS=0 disables the limit.
 */
export const runWithBuildTimeout = async <T>(
	run: () => Promise<T>,
	onTimeout: () => Promise<void>,
	timeoutMs = buildTimeoutMs(),
): Promise<T> => {
	if (!timeoutMs) return run();
	const task = run();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			// The killed build rejects later; that outcome is already reported.
			task.catch(() => {});
			onTimeout()
				.catch(() => {})
				.finally(() =>
					reject(
						new BuildTimeoutError(
							`Build timed out after ${Math.round(timeoutMs / 1000)}s`,
						),
					),
				);
		}, timeoutMs);
	});
	try {
		return await Promise.race([task, timeout]);
	} finally {
		clearTimeout(timer);
	}
};
