PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_companies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`website` text NOT NULL,
	`contact_whatsapp` text DEFAULT '' NOT NULL,
	`contact_instagram` text DEFAULT '' NOT NULL,
	`industry` text NOT NULL,
	`team_size` text NOT NULL,
	`primary_goal` text NOT NULL,
	`onboarding_status` text DEFAULT 'COMPANY_CREATED' NOT NULL,
	`plan_code` text DEFAULT 'TRIAL' NOT NULL,
	`ai_token_balance` integer DEFAULT 50000 NOT NULL,
	`ai_tokens_used` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_companies`("id", "owner_user_id", "name", "website", "contact_whatsapp", "contact_instagram", "industry", "team_size", "primary_goal", "onboarding_status", "plan_code", "ai_token_balance", "ai_tokens_used", "created_at", "updated_at") SELECT "id", "owner_user_id", "name", "website", "contact_whatsapp", "contact_instagram", "industry", "team_size", "primary_goal", "onboarding_status", "plan_code", "ai_token_balance", "ai_tokens_used", "created_at", "updated_at" FROM `companies`;--> statement-breakpoint
DROP TABLE `companies`;--> statement-breakpoint
ALTER TABLE `__new_companies` RENAME TO `companies`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `companies_owner_user_id_unique` ON `companies` (`owner_user_id`);