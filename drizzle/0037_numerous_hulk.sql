CREATE TABLE `agent_drafts` (
	`partner_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`values_json` text DEFAULT '{}' NOT NULL,
	`request_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`partner_id`, `mission_id`),
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_agent_drafts_expiry` ON `agent_drafts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `agent_email_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text NOT NULL,
	`lease_token` text,
	`lease_until` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_agent_email_due` ON `agent_email_jobs` (`status`,`next_attempt_at`);--> statement-breakpoint
ALTER TABLE `partner_profiles` ADD `notifications_read_at` text;