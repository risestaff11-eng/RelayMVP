CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_admin_sessions_expires` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `company_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`visit_id` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`company` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`first_utm_source` text DEFAULT '' NOT NULL,
	`first_utm_medium` text DEFAULT '' NOT NULL,
	`first_utm_campaign` text DEFAULT '' NOT NULL,
	`last_utm_source` text DEFAULT '' NOT NULL,
	`last_utm_medium` text DEFAULT '' NOT NULL,
	`last_utm_campaign` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`notification_status` text DEFAULT 'PENDING' NOT NULL,
	`notification_attempts` integer DEFAULT 0 NOT NULL,
	`next_notification_at` text,
	`notified_at` text,
	`last_error` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_company_applications_created` ON `company_applications` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_company_applications_notification` ON `company_applications` (`notification_status`,`next_notification_at`);--> statement-breakpoint
CREATE INDEX `idx_company_applications_visit` ON `company_applications` (`visit_id`);--> statement-breakpoint
CREATE TABLE `pending_company_registrations` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`phone` text NOT NULL,
	`company_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`marketing_attribution_json` text DEFAULT '{}' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_pending_company_registrations_email` ON `pending_company_registrations` (`email`);--> statement-breakpoint
CREATE INDEX `idx_pending_company_registrations_expires` ON `pending_company_registrations` (`expires_at`);--> statement-breakpoint
CREATE TABLE `reward_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`reward_id` text NOT NULL,
	`company_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`previous_amount` integer NOT NULL,
	`amount` integer NOT NULL,
	`difference` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`reward_id`) REFERENCES `rewards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reward_adjustments_reward_created` ON `reward_adjustments` (`reward_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_reward_adjustments_company_created` ON `reward_adjustments` (`company_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `companies` ADD `review_sla_hours` integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `payout_sla_days` integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `marketing_events` ADD `visit_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketing_events` ADD `last_utm_source` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketing_events` ADD `last_utm_medium` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketing_events` ADD `last_utm_campaign` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_marketing_events_visit_created` ON `marketing_events` (`visit_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `missions` ADD `reward_trigger` text DEFAULT 'SALE_PAID' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `is_test` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `marketing_attribution_json` text DEFAULT '{}' NOT NULL;