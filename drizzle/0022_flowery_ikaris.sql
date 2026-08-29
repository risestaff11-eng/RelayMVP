CREATE TABLE `password_reset_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`key_hash` text NOT NULL,
	`successful` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_password_reset_attempts_key_created` ON `password_reset_attempts` (`key_hash`,`created_at`);