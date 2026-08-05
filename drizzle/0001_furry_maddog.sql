CREATE TABLE `company_profile_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`source_website` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`business_description` text DEFAULT '' NOT NULL,
	`products_json` text DEFAULT '[]' NOT NULL,
	`target_audience` text DEFAULT '' NOT NULL,
	`advantages_json` text DEFAULT '[]' NOT NULL,
	`buying_triggers_json` text DEFAULT '[]' NOT NULL,
	`disqualifiers_json` text DEFAULT '[]' NOT NULL,
	`geographies_json` text DEFAULT '[]' NOT NULL,
	`partner_pitch` text DEFAULT '' NOT NULL,
	`missing_fields_json` text DEFAULT '[]' NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`confirmed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_company_profile_versions_company_version` ON `company_profile_versions` (`company_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `idx_company_profile_versions_company_status` ON `company_profile_versions` (`company_id`,`status`);--> statement-breakpoint
ALTER TABLE `companies` ADD `plan_code` text DEFAULT 'TRIAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `ai_token_balance` integer DEFAULT 100000 NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `ai_tokens_used` integer DEFAULT 0 NOT NULL;