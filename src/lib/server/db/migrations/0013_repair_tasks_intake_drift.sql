-- Repair schema drift from migrations 0010 / 0012 that drizzle-kit registered
-- in `__drizzle_migrations` but never executed (timestamp-ordering bug — their
-- `when` values predate already-applied migrations, so the migrator skipped the
-- DDL while still recording the hashes).
--
-- Symptom on affected installs:
--   * `tasks` table is missing the `body` / `done` columns and the
--     0012-era columns (title, description, status, project_id, assignee,
--     due_date, sort_order) — POST /api/plans/:id/tasks 500s.
--   * `intake_scans` table is the pre-0009 shape (root_path / progress_json)
--     instead of the canonical folder_path / phase / files_found / ... shape —
--     /intake 500s.
--
-- These tables were never user-writable on drifted installs (every insert
-- crashed), so we can safely DROP and recreate from the canonical schema.

DROP TABLE IF EXISTS `tasks`;
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`body` text NOT NULL DEFAULT '',
	`done` integer NOT NULL DEFAULT 0,
	`title` text NOT NULL DEFAULT '',
	`description` text,
	`status` text NOT NULL DEFAULT 'planned',
	`project_id` text,
	`assignee` text,
	`due_date` text,
	`sort_order` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_plan_id` ON `tasks` (`plan_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_tasks_project_id` ON `tasks` (`project_id`, `status`);
--> statement-breakpoint
DROP TABLE IF EXISTS `intake_scans`;
--> statement-breakpoint
CREATE TABLE `intake_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`folder_path` text NOT NULL,
	`status` text NOT NULL DEFAULT 'queued',
	`phase` text NOT NULL DEFAULT 'queued',
	`files_found` integer NOT NULL DEFAULT 0,
	`files_classified` integer NOT NULL DEFAULT 0,
	`error_message` text,
	`result_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`cancelled_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_intake_scans_status_created` ON `intake_scans` (`status`, `created_at`);
