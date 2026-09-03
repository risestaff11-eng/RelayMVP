CREATE TABLE `request_rate_limits` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_request_rate_limits_reset_at` ON `request_rate_limits` (`reset_at`);
