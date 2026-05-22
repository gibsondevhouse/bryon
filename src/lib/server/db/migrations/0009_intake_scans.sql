CREATE TABLE `intake_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`folder_path` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`phase` text DEFAULT 'queued' NOT NULL,
	`files_found` integer DEFAULT 0 NOT NULL,
	`files_classified` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`result_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`cancelled_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_intake_scans_status_created` ON `intake_scans` (`status`,`created_at`);
