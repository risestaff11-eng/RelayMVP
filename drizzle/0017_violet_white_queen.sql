CREATE TABLE `company_knowledge_items` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`kind` text DEFAULT 'SCRIPT' NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`external_url` text,
	`object_key` text,
	`file_name` text,
	`mime_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PUBLISHED' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_company_knowledge_company_status` ON `company_knowledge_items` (`company_id`,`status`,`sort_order`);--> statement-breakpoint
ALTER TABLE `companies` ADD `logo_object_key` text;