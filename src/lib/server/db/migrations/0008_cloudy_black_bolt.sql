CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`summary` text,
	`plan_type` text,
	`start_date` text,
	`status` text DEFAULT 'ideation' NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_plans_status_updated_at` ON `plans` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_plans_archived_at` ON `plans` (`archived_at`);--> statement-breakpoint
ALTER TABLE `projects` ADD `status` text DEFAULT 'ideation' NOT NULL;
