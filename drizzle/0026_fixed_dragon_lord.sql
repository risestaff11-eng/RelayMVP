CREATE TABLE `agent_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`industries_json` text DEFAULT '[]' NOT NULL,
	`experience` text DEFAULT '' NOT NULL,
	`network` text DEFAULT '' NOT NULL,
	`preferred_types_json` text DEFAULT '[]' NOT NULL,
	`availability` text DEFAULT '' NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agent_applications_status_created` ON `agent_applications` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_applications_identity` ON `agent_applications` (`email`,`phone`);--> statement-breakpoint
CREATE TABLE `agent_login_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agent_login_codes_identity_created` ON `agent_login_codes` (`email`,`phone`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_login_codes_expires` ON `agent_login_codes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `agent_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_identity` ON `agent_sessions` (`email`,`phone`);--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_expires` ON `agent_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `support_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`reason` text DEFAULT 'Оперативная техподдержка' NOT NULL,
	`expires_at` text NOT NULL,
	`last_used_at` text,
	`ended_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_support_sessions_company_created` ON `support_sessions` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_support_sessions_expires` ON `support_sessions` (`expires_at`);