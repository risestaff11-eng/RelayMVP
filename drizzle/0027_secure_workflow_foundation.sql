CREATE TABLE `password_reset_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`destination` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_password_reset_codes_user_created` ON `password_reset_codes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_password_reset_codes_destination_created` ON `password_reset_codes` (`destination`,`created_at`);--> statement-breakpoint
ALTER TABLE `submissions` ADD `review_status` text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `sales_status` text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `ownership_status` text DEFAULT 'CLEAR' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `duplicate_of_submission_id` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `review_due_at` text;--> statement-breakpoint
UPDATE `submissions` SET
	`review_status` = CASE
		WHEN `status` = 'REVIEWING' THEN 'REVIEWING'
		WHEN `status` = 'REJECTED' THEN 'REJECTED'
		WHEN `status` IN ('ACCEPTED','IN_PROGRESS','DEAL','REWARDED') THEN 'ACCEPTED'
		ELSE 'PENDING'
	END,
	`sales_status` = CASE
		WHEN `status` = 'IN_PROGRESS' THEN 'IN_PROGRESS'
		WHEN `status` IN ('DEAL','REWARDED') THEN 'WON'
		ELSE 'NONE'
	END,
	`review_due_at` = datetime(`created_at`, '+48 hours');--> statement-breakpoint
CREATE INDEX `idx_submissions_company_review_status` ON `submissions` (`company_id`,`review_status`,`review_due_at`);--> statement-breakpoint
CREATE INDEX `idx_submissions_company_sales_status` ON `submissions` (`company_id`,`sales_status`);--> statement-breakpoint
CREATE INDEX `idx_submissions_duplicate_of` ON `submissions` (`duplicate_of_submission_id`);
