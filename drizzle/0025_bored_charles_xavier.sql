CREATE TABLE `agent_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`partner_id` text NOT NULL,
	`program_id` text,
	`template_id` text,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`template_snapshot_json` text DEFAULT '[]' NOT NULL,
	`answers_json` text DEFAULT '{}' NOT NULL,
	`metrics_json` text DEFAULT '{}' NOT NULL,
	`transcript` text DEFAULT '' NOT NULL,
	`audio_duration_seconds` integer DEFAULT 0 NOT NULL,
	`ai_summary_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`company_comment` text DEFAULT '' NOT NULL,
	`submitted_at` text,
	`viewed_at` text,
	`accepted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `report_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_agent_reports_company_status_period` ON `agent_reports` (`company_id`,`status`,`period_end`);--> statement-breakpoint
CREATE INDEX `idx_agent_reports_partner_period` ON `agent_reports` (`partner_id`,`period_end`);--> statement-breakpoint
CREATE INDEX `idx_agent_reports_program_period` ON `agent_reports` (`program_id`,`period_end`);--> statement-breakpoint
CREATE TABLE `report_files` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`company_id` text NOT NULL,
	`partner_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`kind` text DEFAULT 'ATTACHMENT' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `agent_reports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_report_files_report` ON `report_files` (`report_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `report_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`snapshot_json` text DEFAULT '{}' NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `agent_reports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_report_revisions_report_created` ON `report_revisions` (`report_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `report_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`program_id` text,
	`name` text DEFAULT 'Регулярный отчёт' NOT NULL,
	`fields_json` text DEFAULT '[]' NOT NULL,
	`metrics_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_report_templates_company_status` ON `report_templates` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_report_templates_program` ON `report_templates` (`program_id`);