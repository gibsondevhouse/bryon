CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`prompt_override` text,
	`memory_enabled` integer DEFAULT 1 NOT NULL,
	`remember` text DEFAULT '' NOT NULL,
	`never_suggest` text DEFAULT '' NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `chats` ADD `project_id` text REFERENCES `projects`(`id`);
--> statement-breakpoint
CREATE INDEX `idx_projects_archived_updated_at` ON `projects` (`archived_at`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_chats_project_updated_at` ON `chats` (`project_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `project_files` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`kind` text DEFAULT 'document' NOT NULL,
	`path` text NOT NULL,
	`text_path` text,
	`size_bytes` integer NOT NULL,
	`text_bytes` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_project_files_project_id` ON `project_files` (`project_id`,`archived_at`);
--> statement-breakpoint
CREATE TABLE `prompt_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memory_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`project_id` text,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`origin` text DEFAULT 'user' NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_memory_entries_scope_project` ON `memory_entries` (`scope`,`project_id`,`archived_at`);
--> statement-breakpoint
CREATE TABLE `project_file_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_file_id` text NOT NULL,
	`project_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`token_count` integer NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`project_file_id`) REFERENCES `project_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_project_file_chunks_project_id` ON `project_file_chunks` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_project_file_chunks_file_id` ON `project_file_chunks` (`project_file_id`);
--> statement-breakpoint
CREATE VIRTUAL TABLE `project_file_chunks_fts` USING fts5(
	`chunk_id` UNINDEXED,
	`project_id` UNINDEXED,
	`text`
);
--> statement-breakpoint
CREATE TRIGGER `project_file_chunks_fts_ai` AFTER INSERT ON `project_file_chunks` BEGIN
	INSERT INTO `project_file_chunks_fts` (`rowid`, `chunk_id`, `project_id`, `text`)
	VALUES (new.`rowid`, new.`id`, new.`project_id`, new.`text`);
END;
--> statement-breakpoint
CREATE TRIGGER `project_file_chunks_fts_ad` AFTER DELETE ON `project_file_chunks` BEGIN
	DELETE FROM `project_file_chunks_fts` WHERE `rowid` = old.`rowid`;
END;
