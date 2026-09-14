CREATE TABLE `lead_notification_jobs` (
	`submission_id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`lease_token` text,
	`lease_until` text,
	`last_error` text DEFAULT '' NOT NULL,
	`sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lead_notifications_due` ON `lead_notification_jobs` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `idx_lead_notifications_company` ON `lead_notification_jobs` (`company_id`,`status`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS lead_notification_after_submission
AFTER INSERT ON submissions
BEGIN
  INSERT OR IGNORE INTO lead_notification_jobs (submission_id, company_id) VALUES (NEW.id, NEW.company_id);
END;
