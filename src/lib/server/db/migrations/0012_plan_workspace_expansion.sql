--> statement-breakpoint
ALTER TABLE projects ADD COLUMN plan_id TEXT;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN title TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN description TEXT;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'planned';
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN project_id TEXT;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN assignee TEXT;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN due_date TEXT;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN sort_order INTEGER;
--> statement-breakpoint
UPDATE tasks SET title = body WHERE title = '';
--> statement-breakpoint
CREATE TABLE `plan_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL REFERENCES `plans`(`id`) ON DELETE CASCADE,
	`series` text NOT NULL DEFAULT '100',
	`title` text NOT NULL,
	`body` text,
	`sort_order` integer,
	`locked` integer NOT NULL DEFAULT 0,
	`context_weight` text NOT NULL DEFAULT 'conditional',
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_plan_cards_plan_id` ON `plan_cards` (`plan_id`,`archived_at`);
--> statement-breakpoint
CREATE TABLE `routing_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_type` text NOT NULL,
	`tier` integer NOT NULL,
	`model` text NOT NULL,
	`remote` integer NOT NULL,
	`privacy_decision` text NOT NULL,
	`tokens_in` integer,
	`tokens_out` integer,
	`error_code` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_routing_logs_created_at` ON `routing_logs` (`created_at`);
--> statement-breakpoint
CREATE TABLE `workspace_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`path` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_audit_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`checkpoint_id` text REFERENCES `workspace_checkpoints`(`id`),
	`severity` text NOT NULL,
	`code` text NOT NULL,
	`message` text NOT NULL,
	`path` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sync_audit_findings_checkpoint` ON `sync_audit_findings` (`checkpoint_id`,`resolved_at`);
