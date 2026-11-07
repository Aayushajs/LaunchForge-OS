import {
	evaluateRollout,
	type RolloutTask,
	waitForRollout,
} from "@dokploy/server/utils/builders/rollout";
import { describe, expect, it, vi } from "vitest";

const replicated = (replicas: number, update?: string, message?: string) => ({
	Spec: { Mode: { Replicated: { Replicas: replicas } } },
	...(update ? { UpdateStatus: { State: update, Message: message } } : {}),
});

const task = (
	generation: number,
	state: string,
	desired = "running",
	err?: string,
): RolloutTask => ({
	Spec: { ForceUpdate: generation },
	DesiredState: desired,
	Status: { State: state, Err: err },
});

describe("evaluateRollout", () => {
	it("is healthy once every replica of the new generation runs", () => {
		expect(
			evaluateRollout(
				replicated(2, "completed"),
				[
					task(3, "running"),
					task(3, "running"),
					task(2, "shutdown", "shutdown"),
				],
				3,
			),
		).toEqual({ state: "healthy" });
	});

	it("stays pending while a health check is still starting", () => {
		expect(
			evaluateRollout(replicated(1, "updating"), [task(3, "starting")], 3),
		).toEqual({ state: "pending" });
	});

	it("ignores tasks from the previous generation", () => {
		expect(evaluateRollout(replicated(1), [task(2, "running")], 3)).toEqual({
			state: "pending",
		});
	});

	it("waits for the update to complete even if tasks are running", () => {
		expect(
			evaluateRollout(replicated(1, "updating"), [task(3, "running")], 3),
		).toEqual({ state: "pending" });
	});

	it("fails when Swarm rolls back", () => {
		const verdict = evaluateRollout(
			replicated(1, "rollback_completed", "update rolled back due to failure"),
			[task(3, "failed", "shutdown")],
			3,
		);
		expect(verdict.state).toBe("failed");
		expect(verdict).toMatchObject({
			reason: expect.stringContaining("rolled back"),
		});
	});

	it("fails on a crash loop and reports the container error", () => {
		const verdict = evaluateRollout(
			replicated(1),
			[
				task(3, "failed", "shutdown", "exit code 1"),
				task(3, "failed", "shutdown", "exit code 1"),
				task(3, "failed", "shutdown", "task: non-zero exit (1)"),
			],
			3,
		);
		expect(verdict).toEqual({
			state: "failed",
			reason: "the container keeps crashing: task: non-zero exit (1)",
		});
	});

	it("ignores a rollback status left over from the previous deployment", () => {
		expect(
			evaluateRollout(
				replicated(1, "rollback_completed"),
				[task(2, "running")],
				3,
			),
		).toEqual({ state: "pending" });
	});

	it("treats a service scaled to zero as healthy", () => {
		expect(evaluateRollout(replicated(0), [], 1)).toEqual({ state: "healthy" });
	});
});

describe("waitForRollout", () => {
	const docker = (service: object, tasks: RolloutTask[][]) => {
		const listTasks = vi.fn();
		for (const batch of tasks) listTasks.mockResolvedValueOnce(batch);
		listTasks.mockResolvedValue(tasks.at(-1));
		return {
			getService: () => ({ inspect: async () => service }),
			listTasks,
		} as never;
	};

	it("resolves when the new version becomes healthy", async () => {
		await expect(
			waitForRollout(
				docker(replicated(1), [[task(1, "starting")], [task(1, "running")]]),
				"portfolio",
				1,
				1000,
				1,
			),
		).resolves.toBeUndefined();
	});

	it("rejects with a timeout when the app never becomes healthy", async () => {
		await expect(
			waitForRollout(
				docker(replicated(1), [[task(1, "starting")]]),
				"portfolio",
				1,
				20,
				5,
			),
		).rejects.toThrow(/not running and healthy/);
	});
});
