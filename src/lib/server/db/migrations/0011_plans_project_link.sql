ALTER TABLE `plans` ADD COLUMN `project_id` text;
--> statement-breakpoint
CREATE INDEX `idx_plans_project_id` ON `plans` (`project_id`);
