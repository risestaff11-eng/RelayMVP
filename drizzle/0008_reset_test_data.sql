DROP TABLE IF EXISTS `__new_companies`;--> statement-breakpoint
DELETE FROM `contact_verification_codes`;--> statement-breakpoint
DELETE FROM `submission_disputes`;--> statement-breakpoint
DELETE FROM `submission_status_events`;--> statement-breakpoint
DELETE FROM `submission_attachments`;--> statement-breakpoint
DELETE FROM `rewards`;--> statement-breakpoint
DELETE FROM `submissions`;--> statement-breakpoint
DELETE FROM `partner_mission_acceptances`;--> statement-breakpoint
DELETE FROM `partner_access_links`;--> statement-breakpoint
DELETE FROM `partner_profiles`;--> statement-breakpoint
DELETE FROM `legal_acceptances`;--> statement-breakpoint
DELETE FROM `partners`;--> statement-breakpoint
DELETE FROM `missions`;--> statement-breakpoint
DELETE FROM `programs`;--> statement-breakpoint
DELETE FROM `company_profile_versions`;--> statement-breakpoint
DELETE FROM `company_members`;--> statement-breakpoint
DELETE FROM `user_roles`;--> statement-breakpoint
DELETE FROM `companies`;--> statement-breakpoint
DELETE FROM `users`;--> statement-breakpoint
PRAGMA optimize;
