CREATE TABLE `partner_access_links` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_access_links_token_hash_unique` ON `partner_access_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_partner_access_links_partner` ON `partner_access_links` (`partner_id`);--> statement-breakpoint
CREATE TABLE `partner_mission_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`accepted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_partner_missions_unique` ON `partner_mission_acceptances` (`partner_id`,`mission_id`);--> statement-breakpoint
CREATE INDEX `idx_partner_missions_partner_status` ON `partner_mission_acceptances` (`partner_id`,`status`);--> statement-breakpoint
CREATE TABLE `partner_profiles` (
	`partner_id` text PRIMARY KEY NOT NULL,
	`skills_json` text DEFAULT '[]' NOT NULL,
	`industries_json` text DEFAULT '[]' NOT NULL,
	`geographies_json` text DEFAULT '[]' NOT NULL,
	`preferred_types_json` text DEFAULT '[]' NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`useful_action_streak` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `submission_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`object_key` text,
	`external_url` text,
	`file_name` text NOT NULL,
	`mime_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_submission_attachments_submission` ON `submission_attachments` (`submission_id`);--> statement-breakpoint
CREATE TABLE `submission_disputes` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`partner_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_submission_disputes_submission_status` ON `submission_disputes` (`submission_id`,`status`);--> statement-breakpoint
CREATE TABLE `submission_status_events` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`actor_type` text NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_submission_events_submission_created` ON `submission_status_events` (`submission_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `rewards` ADD `planned_at` text;--> statement-breakpoint
PRAGMA optimize;
