CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`body` text NOT NULL,
	`done` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_plan_id` ON `tasks` (`plan_id`, `created_at`);
