CREATE TABLE `missions` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`instructions_json` text DEFAULT '[]' NOT NULL,
	`proof_requirements_json` text DEFAULT '[]' NOT NULL,
	`reward_mode` text DEFAULT 'FIXED' NOT NULL,
	`reward_value` integer DEFAULT 0 NOT NULL,
	`reward_label` text DEFAULT '' NOT NULL,
	`verification_rules` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_missions_program_sort` ON `missions` (`program_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `partners` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`program_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_active_at` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_partners_program_email` ON `partners` (`program_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_partners_company_status` ON `partners` (`company_id`,`status`);--> statement-breakpoint
CREATE TABLE `rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`partner_id` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'KZT' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`approved_at` text,
	`paid_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rewards_submission_id_unique` ON `rewards` (`submission_id`);--> statement-breakpoint
CREATE INDEX `idx_rewards_company_status` ON `rewards` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_rewards_partner_status` ON `rewards` (`partner_id`,`status`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`program_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`partner_id` text NOT NULL,
	`type` text NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`contact_company` text DEFAULT '' NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`contact_phone` text DEFAULT '' NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'SUBMITTED' NOT NULL,
	`company_comment` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_submissions_company_status` ON `submissions` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_submissions_program_created` ON `submissions` (`program_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `programs` ADD `profile_version_id` text;--> statement-breakpoint
ALTER TABLE `programs` ADD `slug` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `goal` text DEFAULT 'LEADS' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `currency` text DEFAULT 'KZT' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `payout_terms` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `legal_terms` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `expires_at` text;--> statement-breakpoint
ALTER TABLE `programs` ADD `published_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `programs_slug_unique` ON `programs` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_programs_company_status` ON `programs` (`company_id`,`status`);
