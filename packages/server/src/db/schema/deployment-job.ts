import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Deployment jobs that were queued but have not finished yet. */
export const deploymentJob = pgTable(
	"deployment_job",
	{
		id: text("id").primaryKey(),
		data: jsonb("data").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [index("deploymentJob_createdAt_idx").on(t.createdAt)],
);
