ALTER TABLE "webServerSettings" ADD COLUMN "authProviders" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "webServerSettings" ADD COLUMN "smtpConfig" jsonb;