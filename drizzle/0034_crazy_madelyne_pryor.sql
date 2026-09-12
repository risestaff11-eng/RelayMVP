CREATE TABLE `product_milestones` (
	`company_id` text NOT NULL,
	`event` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`company_id`, `event`),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_product_milestones_event` ON `product_milestones` (`event`,`created_at`);--> statement-breakpoint
CREATE TABLE `subscription_events` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`revision` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`plan_code` text NOT NULL,
	`ends_at` text,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`credits_granted` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_subscription_company_revision` ON `subscription_events` (`company_id`,`revision`);--> statement-breakpoint
ALTER TABLE `companies` ADD `subscription_status` text DEFAULT 'LEGACY' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `subscription_started_at` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `subscription_ends_at` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `subscription_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `assigned_to_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `submissions` ADD `next_action` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `next_action_at` text;--> statement-breakpoint
CREATE INDEX `idx_submissions_company_created_id` ON `submissions` (`company_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_submissions_company_next_action` ON `submissions` (`company_id`,`next_action_at`);