import { db } from "@dokploy/server/db";
import { deploymentJob } from "@dokploy/server/db/schema";
import { asc, inArray } from "drizzle-orm";
import type { JobStore } from "./in-memory-queue";
import type { DeploymentJob } from "./queue-types";

export const postgresJobStore: JobStore = {
	save: async (id, data) => {
		await db.insert(deploymentJob).values({ id, data });
	},
	remove: async (ids) => {
		await db.delete(deploymentJob).where(inArray(deploymentJob.id, ids));
	},
	loadAll: async () => {
		const rows = await db
			.select()
			.from(deploymentJob)
			.orderBy(asc(deploymentJob.createdAt));
		return rows.map((row) => ({
			id: row.id,
			data: row.data as DeploymentJob,
		}));
	},
};
