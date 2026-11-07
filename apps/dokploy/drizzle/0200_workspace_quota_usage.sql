CREATE TABLE "workspace_quota" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"max_cpu" real,
	"max_memory_mb" integer,
	"max_applications" integer,
	"max_databases" integer,
	"max_domains" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_usage" (
	"organization_id" text NOT NULL,
	"hour" timestamp NOT NULL,
	"samples" integer DEFAULT 0 NOT NULL,
	"cpu_core_seconds" real DEFAULT 0 NOT NULL,
	"avg_memory_mb" real DEFAULT 0 NOT NULL,
	"peak_memory_mb" real DEFAULT 0 NOT NULL,
	"containers" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_quota" ADD CONSTRAINT "workspace_quota_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_usage" ADD CONSTRAINT "workspace_usage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspaceUsage_org_hour_idx" ON "workspace_usage" USING btree ("organization_id","hour");