CREATE TABLE `conops_phases` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`ordinal` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`summary` text,
	`start_event` text,
	`end_event` text,
	`objectives_json` text DEFAULT '[]' NOT NULL,
	`decision_points_json` text DEFAULT '[]' NOT NULL,
	`branches_json` text DEFAULT '[]' NOT NULL,
	`contingencies_json` text DEFAULT '[]' NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_conops_phases_plan_id` ON `conops_phases` (`plan_id`,`ordinal`);--> statement-breakpoint
CREATE INDEX `idx_conops_phases_archived_at` ON `conops_phases` (`archived_at`);--> statement-breakpoint
CREATE TABLE `opords` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`paragraphs_json` text DEFAULT '{"situation":null,"mission":null,"execution":null,"sustainment":null,"commandAndSignal":null}' NOT NULL,
	`issued_at` integer,
	`pushed_at` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_opords_plan_id` ON `opords` (`plan_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_opords_archived_at` ON `opords` (`archived_at`);--> statement-breakpoint
CREATE TABLE `fragos` (
	`id` text PRIMARY KEY NOT NULL,
	`opord_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`change_type` text NOT NULL,
	`targets_json` text DEFAULT '[]' NOT NULL,
	`original_text` text,
	`amended_text` text,
	`reason` text,
	`effective_at` integer,
	`issued_at` integer,
	`applied_at` integer,
	`acknowledged_at` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`opord_id`) REFERENCES `opords`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_fragos_opord_id` ON `fragos` (`opord_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_fragos_archived_at` ON `fragos` (`archived_at`);--> statement-breakpoint
CREATE TABLE `frago_impacts` (
	`id` text PRIMARY KEY NOT NULL,
	`frago_id` text NOT NULL,
	`entity_kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`impact_kind` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`frago_id`) REFERENCES `fragos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_frago_impacts_frago_id` ON `frago_impacts` (`frago_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_frago_impacts_entity` ON `frago_impacts` (`frago_id`,`entity_kind`,`entity_id`);--> statement-breakpoint
CREATE TABLE `aars` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`project_id` text,
	`opord_id` text,
	`frago_id` text,
	`checkpoint_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`what_happened` text,
	`what_was_supposed_to_happen` text,
	`what_went_right` text,
	`what_went_wrong` text,
	`recommendations` text,
	`related_task_ids_json` text DEFAULT '[]' NOT NULL,
	`completed_at` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`opord_id`) REFERENCES `opords`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`frago_id`) REFERENCES `fragos`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`checkpoint_id`) REFERENCES `workspace_checkpoints`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_aars_plan_id` ON `aars` (`plan_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_aars_project_id` ON `aars` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_aars_checkpoint_id` ON `aars` (`checkpoint_id`);--> statement-breakpoint
CREATE INDEX `idx_aars_archived_at` ON `aars` (`archived_at`);--> statement-breakpoint
CREATE TABLE `aar_lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`aar_id` text NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`proposed_target_kind` text DEFAULT 'review' NOT NULL,
	`lesson` text NOT NULL,
	`evidence_json` text DEFAULT '[]' NOT NULL,
	`accepted_at` integer,
	`rejected_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`aar_id`) REFERENCES `aars`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_aar_lessons_aar_id` ON `aar_lessons` (`aar_id`,`status`);--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `doctrine_lifecycle` text DEFAULT 'proposed' NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `mission_need_gap` text;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `mission_need_context` text;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `mission_need_priority` text;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `mission_need_source` text;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `intent_purpose` text;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `intent_end_state` text;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `intent_key_tasks_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `intent_constraints_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `line_of_effort_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `oplan_mission_statement` text;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `oplan_execution_timeline_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `oplan_task_organization_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `oplan_sustainment_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `oplan_annexes_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD COLUMN `oplan_references_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_plans_doctrine_lifecycle` ON `plans` (`doctrine_lifecycle`);--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `source_kind` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `source_key` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `source_opord_id` text REFERENCES `opords`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `source_opord_paragraph` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `source_frago_id` text REFERENCES `fragos`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `phase_id` text REFERENCES `conops_phases`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `push_batch_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD COLUMN `source_fingerprint` text;--> statement-breakpoint
CREATE INDEX `idx_tasks_phase_id` ON `tasks` (`phase_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_source_opord_id` ON `tasks` (`source_opord_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_source_frago_id` ON `tasks` (`source_frago_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tasks_source_fingerprint` ON `tasks` (`source_fingerprint`);
