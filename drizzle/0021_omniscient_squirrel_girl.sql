CREATE TABLE `partner_referral_links` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_referral_links_token_hash_unique` ON `partner_referral_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_partner_referral_links_partner` ON `partner_referral_links` (`partner_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_partner_referral_links_mission` ON `partner_referral_links` (`mission_id`);