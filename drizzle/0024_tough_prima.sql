CREATE TABLE `company_account_deletion_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`original_user_id` text NOT NULL,
	`original_company_id` text,
	`company_name` text DEFAULT '' NOT NULL,
	`email_masked` text DEFAULT '' NOT NULL,
	`email_domain` text DEFAULT '' NOT NULL,
	`programs_count` integer DEFAULT 0 NOT NULL,
	`agents_count` integer DEFAULT 0 NOT NULL,
	`submissions_count` integer DEFAULT 0 NOT NULL,
	`paid_rewards_count` integer DEFAULT 0 NOT NULL,
	`paid_rewards_amount` integer DEFAULT 0 NOT NULL,
	`storage_cleanup_status` text DEFAULT 'PENDING' NOT NULL,
	`deleted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_company_deletion_logs_deleted_at` ON `company_account_deletion_logs` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_company_deletion_logs_email_domain` ON `company_account_deletion_logs` (`email_domain`);--> statement-breakpoint
ALTER TABLE `users` ADD `last_login_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `login_count` integer DEFAULT 0 NOT NULL;