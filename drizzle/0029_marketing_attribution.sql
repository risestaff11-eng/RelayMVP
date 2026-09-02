ALTER TABLE `marketing_events` ADD `utm_source` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `marketing_events` ADD `utm_medium` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `marketing_events` ADD `utm_campaign` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_marketing_events_utm_created` ON `marketing_events` (`utm_source`,`utm_campaign`,`created_at`);
