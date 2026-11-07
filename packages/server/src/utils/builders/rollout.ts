import type Dockerode from "dockerode";

export interface RolloutTask {
	Spec?: { ForceUpdate?: number };
	DesiredState?: string;
	Status?: { State?: string; Err?: string };
}

export interface RolloutService {
	Spec?: {
		Mode?: { Replicated?: { Replicas?: number }; Global?: object };
	};
	UpdateStatus?: { State?: string; Message?: string };
}

export type RolloutVerdict =
	| { state: "pending" }
	| { state: "healthy" }
	| { state: "failed"; reason: string };

const FAILED_TASK_STATES = new Set(["failed", "rejected"]);
const CRASH_LOOP_THRESHOLD = 3;

/**
 * Decides whether a rollout of `generation` (the service's ForceUpdate
 * counter) has finished. Swarm only moves a task with a health check from
 * "starting" to "running" once the check passes, so "running" means healthy.
 */
export const evaluateRollout = (
	service: RolloutService,
	tasks: RolloutTask[],
	generation: number,
): RolloutVerdict => {
	const current = tasks.filter(
		(task) => (task.Spec?.ForceUpdate ?? 0) === generation,
	);
	// UpdateStatus still describes the previous update until Swarm starts on
	// this one, so it only counts once tasks of this generation exist.
	const update = current.length > 0 ? service.UpdateStatus?.State : "updating";
	if (update === "rollback_started" || update === "rollback_completed") {
		return {
			state: "failed",
			reason: `the new version failed and Swarm rolled back to the previous one${
				service.UpdateStatus?.Message
					? ` (${service.UpdateStatus.Message})`
					: ""
			}`,
		};
	}
	if (update === "paused") {
		return {
			state: "failed",
			reason: `the update was paused${
				service.UpdateStatus?.Message ? `: ${service.UpdateStatus.Message}` : ""
			}`,
		};
	}

	const failures = current.filter((task) =>
		FAILED_TASK_STATES.has(task.Status?.State ?? ""),
	);
	if (failures.length >= CRASH_LOOP_THRESHOLD) {
		const lastError = failures.at(-1)?.Status?.Err;
		return {
			state: "failed",
			reason: `the container keeps crashing${lastError ? `: ${lastError}` : ""}`,
		};
	}

	const wanted = current.filter((task) => task.DesiredState === "running");
	const desiredReplicas = service.Spec?.Mode?.Replicated
		? (service.Spec.Mode.Replicated.Replicas ?? 1)
		: wanted.length;

	if (desiredReplicas === 0) {
		return { state: "healthy" };
	}

	const running = wanted.filter((task) => task.Status?.State === "running");
	const updateDone = update === undefined || update === "completed";
	if (running.length >= desiredReplicas && desiredReplicas > 0 && updateDone) {
		return { state: "healthy" };
	}
	return { state: "pending" };
};

const DEFAULT_TIMEOUT_SECONDS = 120;

export const rolloutTimeoutMs = () => {
	const configured = Number(process.env.DEPLOY_HEALTH_TIMEOUT_SECONDS);
	return (
		(Number.isFinite(configured) && configured > 0
			? configured
			: DEFAULT_TIMEOUT_SECONDS) * 1000
	);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Blocks until the new version is running (and healthy, when a health check
 * is configured) or fails. A deployment is only reported as done after this
 * returns, instead of a few seconds after the service update was accepted.
 */
export const waitForRollout = async (
	docker: Dockerode,
	appName: string,
	generation: number,
	timeoutMs = rolloutTimeoutMs(),
	pollMs = 2000,
) => {
	const deadline = Date.now() + timeoutMs;
	while (true) {
		const [service, tasks] = await Promise.all([
			docker.getService(appName).inspect() as Promise<RolloutService>,
			docker.listTasks({
				filters: JSON.stringify({ service: [appName] }),
			}) as Promise<RolloutTask[]>,
		]);
		const verdict = evaluateRollout(service, tasks, generation);
		if (verdict.state === "healthy") return;
		if (verdict.state === "failed") {
			throw new Error(`Deployment failed: ${verdict.reason}.`);
		}
		if (Date.now() >= deadline) {
			throw new Error(
				`Deployment failed: the new version was not running and healthy after ${Math.round(timeoutMs / 1000)}s. Check the application logs and its health check.`,
			);
		}
		await sleep(pollMs);
	}
};
