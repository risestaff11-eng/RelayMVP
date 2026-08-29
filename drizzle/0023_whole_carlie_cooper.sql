CREATE TABLE `company_email_verification_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`destination` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_company_email_verification_user_created` ON `company_email_verification_codes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_company_email_verification_destination_created` ON `company_email_verification_codes` (`destination`,`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` text;