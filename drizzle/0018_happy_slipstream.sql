CREATE TABLE `company_methodology_briefs` (
	`company_id` text PRIMARY KEY NOT NULL,
	`offer` text DEFAULT '' NOT NULL,
	`ideal_customer` text DEFAULT '' NOT NULL,
	`decision_makers` text DEFAULT '' NOT NULL,
	`customer_problems` text DEFAULT '' NOT NULL,
	`sales_goal` text DEFAULT '' NOT NULL,
	`next_step` text DEFAULT '' NOT NULL,
	`channels_json` text DEFAULT '[]' NOT NULL,
	`tone` text DEFAULT 'Деловой и человеческий' NOT NULL,
	`proof_points` text DEFAULT '' NOT NULL,
	`must_say` text DEFAULT '' NOT NULL,
	`must_not_say` text DEFAULT '' NOT NULL,
	`language` text DEFAULT 'Русский' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `company_knowledge_items` ADD `summary` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_knowledge_items` ADD `agent_action` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_knowledge_items` ADD `channel` text DEFAULT 'ALL' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_knowledge_items` ADD `sales_stage` text DEFAULT 'PREPARE' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_knowledge_items` ADD `audience` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_knowledge_items` ADD `source_basis_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_knowledge_items` ADD `warnings_json` text DEFAULT '[]' NOT NULL;