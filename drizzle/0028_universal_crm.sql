ALTER TABLE `companies` ADD `crm_monthly_goal` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `crm_average_check` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `crm_conversion_rate` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `crm_leads_per_ambassador` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `crm_goal_currency` text DEFAULT 'KZT' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `estimated_deal_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `deal_amount` integer DEFAULT 0 NOT NULL;
