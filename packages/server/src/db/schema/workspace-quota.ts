import { relations } from "drizzle-orm";
import {
	integer,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { organization } from "./account";

/** Limits for one workspace (organization). A null column means unlimited. */
export const workspaceQuota = pgTable("workspace_quota", {
	organizationId: text("organization_id")
		.primaryKey()
		.references(() => organization.id, { onDelete: "cascade" }),
	maxCpu: real("max_cpu"),
	maxMemoryMb: integer("max_memory_mb"),
	maxApplications: integer("max_applications"),
	maxDatabases: integer("max_databases"),
	maxDomains: integer("max_domains"),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workspaceQuotaRelations = relations(workspaceQuota, ({ one }) => ({
	organization: one(organization, {
		fields: [workspaceQuota.organizationId],
		references: [organization.id],
	}),
}));

/** Hourly resource usage per workspace, aggregated from container stats. */
export const workspaceUsage = pgTable(
	"workspace_usage",
	{
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		hour: timestamp("hour").notNull(),
		samples: integer("samples").notNull().default(0),
		cpuCoreSeconds: real("cpu_core_seconds").notNull().default(0),
		avgMemoryMb: real("avg_memory_mb").notNull().default(0),
		peakMemoryMb: real("peak_memory_mb").notNull().default(0),
		containers: integer("containers").notNull().default(0),
	},
	(t) => [
		uniqueIndex("workspaceUsage_org_hour_idx").on(t.organizationId, t.hour),
	],
);

const limit = z.number().int().positive().nullable();

export const apiSetWorkspaceQuota = z.object({
	organizationId: z.string().min(1),
	maxCpu: z.number().positive().max(1024).nullable(),
	maxMemoryMb: limit,
	maxApplications: limit,
	maxDatabases: limit,
	maxDomains: limit,
});

export type WorkspaceQuota = typeof workspaceQuota.$inferSelect;
