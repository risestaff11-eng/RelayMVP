CREATE TABLE `company_knowledge_items` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`kind` text DEFAULT 'SCRIPT' NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`external_url` text,
	`object_key` text,
	`file_name` text,
	`mime_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PUBLISHED' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_company_knowledge_company_status` ON `company_knowledge_items` (`company_id`,`status`,`sort_order`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_companies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`website` text NOT NULL,
	`contact_whatsapp` text DEFAULT '' NOT NULL,
	`contact_instagram` text DEFAULT '' NOT NULL,
	`logo_object_key` text,
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
INSERT INTO `__new_companies`("id", "owner_user_id", "name", "website", "contact_whatsapp", "contact_instagram", "logo_object_key", "industry", "team_size", "primary_goal", "onboarding_status", "plan_code", "ai_token_balance", "ai_tokens_used", "created_at", "updated_at") SELECT "id", "owner_user_id", "name", "website", "contact_whatsapp", "contact_instagram", NULL, "industry", "team_size", "primary_goal", "onboarding_status", "plan_code", "ai_token_balance", "ai_tokens_used", "created_at", "updated_at" FROM `companies`;--> statement-breakpoint
DROP TABLE `companies`;--> statement-breakpoint
ALTER TABLE `__new_companies` RENAME TO `companies`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `companies_owner_user_id_unique` ON `companies` (`owner_user_id`);--> statement-breakpoint
UPDATE `companies` SET `ai_token_balance` = 50000, `updated_at` = CURRENT_TIMESTAMP WHERE `ai_token_balance` = 0;
