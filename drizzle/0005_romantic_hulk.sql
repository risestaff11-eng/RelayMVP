CREATE TABLE `contact_verification_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`channel` text NOT NULL,
	`destination` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contact_verification_partner_channel` ON `contact_verification_codes` (`partner_id`,`channel`,`created_at`);--> statement-breakpoint
CREATE TABLE `legal_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`program_id` text NOT NULL,
	`document_version` text NOT NULL,
	`accepted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_legal_acceptances_user_program` ON `legal_acceptances` (`user_id`,`program_id`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `role`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_roles_role` ON `user_roles` (`role`);--> statement-breakpoint
ALTER TABLE `partner_profiles` ADD `email_verified_at` text;--> statement-breakpoint
ALTER TABLE `partner_profiles` ADD `whatsapp_verified_at` text;--> statement-breakpoint
ALTER TABLE `partners` ADD `user_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `idx_partners_user_id` ON `partners` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
PRAGMA optimize;
