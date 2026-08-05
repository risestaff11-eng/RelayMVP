ALTER TABLE `partner_profiles` ADD `first_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `partner_profiles` ADD `last_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `partner_profiles` ADD `middle_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `partner_profiles` ADD `instagram` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `partner_profiles` ADD `avatar_object_key` text;--> statement-breakpoint
ALTER TABLE `partners` ADD `phone` text DEFAULT '' NOT NULL;