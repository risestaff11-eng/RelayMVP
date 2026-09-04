CREATE TABLE `external_entity_links` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`local_id` text NOT NULL,
	`external_id` text NOT NULL,
	`external_url` text,
	`sync_version` integer DEFAULT 1 NOT NULL,
	`last_synced_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connection_id`) REFERENCES `integration_connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_external_entity_links_connection_entity_local` ON `external_entity_links` (`connection_id`,`entity_type`,`local_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_external_entity_links_connection_entity_external` ON `external_entity_links` (`connection_id`,`entity_type`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_external_entity_links_company_entity` ON `external_entity_links` (`company_id`,`entity_type`);--> statement-breakpoint
CREATE TABLE `integration_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`token_prefix` text NOT NULL,
	`token_hash` text NOT NULL,
	`scopes_json` text DEFAULT '[]' NOT NULL,
	`last_used_at` text,
	`expires_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_api_keys_token_hash_unique` ON `integration_api_keys` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_integration_api_keys_company_created` ON `integration_api_keys` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `integration_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`direction` text DEFAULT 'OUTBOUND' NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`encrypted_credentials` text,
	`last_success_at` text,
	`last_error_at` text,
	`last_error` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_integration_connections_company_status` ON `integration_connections` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_integration_connections_company_provider` ON `integration_connections` (`company_id`,`provider`);--> statement-breakpoint
CREATE TABLE `integration_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`response_status` integer,
	`last_error` text DEFAULT '' NOT NULL,
	`delivered_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `integration_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connection_id`) REFERENCES `integration_connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_integration_deliveries_event_connection` ON `integration_deliveries` (`event_id`,`connection_id`);--> statement-breakpoint
CREATE INDEX `idx_integration_deliveries_connection_status_next` ON `integration_deliveries` (`connection_id`,`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `integration_delivery_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`response_status` integer,
	`error` text DEFAULT '' NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`delivery_id`) REFERENCES `integration_deliveries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_integration_attempts_delivery_number` ON `integration_delivery_attempts` (`delivery_id`,`attempt_number`);--> statement-breakpoint
CREATE INDEX `idx_integration_attempts_delivery_created` ON `integration_delivery_attempts` (`delivery_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `integration_events` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`event_type` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_events_idempotency_key_unique` ON `integration_events` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_integration_events_company_created` ON `integration_events` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_integration_events_aggregate` ON `integration_events` (`aggregate_type`,`aggregate_id`,`created_at`);