import { describe, expect, it } from "vitest";
import {
	InMemoryQueue,
	type JobStore,
} from "../../server/queues/in-memory-queue";
import type { DeploymentJob } from "../../server/queues/queue-types";

const appJob = (applicationId: string): DeploymentJob => ({
	applicationId,
	titleLog: "deploy",
	descriptionLog: "",
	type: "deploy",
	applicationType: "application",
});

const memoryStore = () => {
	const rows = new Map<string, DeploymentJob>();
	const store: JobStore = {
		save: async (id, data) => {
			rows.set(id, data);
		},
		remove: async (ids) => {
			for (const id of ids) rows.delete(id);
		},
		loadAll: async () => [...rows].map(([id, data]) => ({ id, data })),
	};
	return { store, rows };
};

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("durable deployment queue", () => {
	it("persists a job when it is queued and forgets it once it finishes", async () => {
		const { store, rows } = memoryStore();
		let release!: () => void;
		const queue = new InMemoryQueue({ resolveConcurrency: () => 1, store });
		queue.process(
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				}),
		);

		await queue.add(appJob("portfolio"));
		expect(rows.size).toBe(1);

		await flush();
		release();
		await flush();
		expect(rows.size).toBe(0);
	});

	it("restores queued jobs after a restart and runs them", async () => {
		const { store, rows } = memoryStore();
		const beforeRestart = new InMemoryQueue({
			resolveConcurrency: () => 1,
			store,
		});
		await beforeRestart.add(appJob("portfolio"));
		await beforeRestart.add(appJob("blog"));
		expect(rows.size).toBe(2);

		const processed: string[] = [];
		const afterRestart = new InMemoryQueue({
			resolveConcurrency: () => 2,
			store,
		});
		afterRestart.process(async (job) => {
			processed.push((job.data as { applicationId: string }).applicationId);
		});
		expect(await afterRestart.restore()).toBe(2);
		await flush();
		await flush();

		expect(processed.sort()).toEqual(["blog", "portfolio"]);
		expect(rows.size).toBe(0);
	});

	it("forgets cancelled waiting jobs", async () => {
		const { store, rows } = memoryStore();
		const queue = new InMemoryQueue({ resolveConcurrency: () => 1, store });
		await queue.add(appJob("portfolio"));
		await queue.add(appJob("blog"));

		queue.removeWaiting(
			(data) => (data as { applicationId: string }).applicationId === "blog",
		);
		await flush();
		expect([...rows.values()]).toEqual([appJob("portfolio")]);

		queue.clearWaiting();
		await flush();
		expect(rows.size).toBe(0);
	});
});
