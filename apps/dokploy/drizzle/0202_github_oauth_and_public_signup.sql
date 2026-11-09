ALTER TABLE "github" ADD COLUMN "githubOauthAccountId" text;--> statement-breakpoint
ALTER TABLE "webServerSettings" ADD COLUMN "allowPublicSignup" boolean DEFAULT false NOT NULL;