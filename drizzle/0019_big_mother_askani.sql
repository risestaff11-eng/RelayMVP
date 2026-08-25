CREATE TABLE `mission_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`mission_id` text NOT NULL,
	`company_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mission_resources_mission` ON `mission_resources` (`mission_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_mission_resources_company` ON `mission_resources` (`company_id`);