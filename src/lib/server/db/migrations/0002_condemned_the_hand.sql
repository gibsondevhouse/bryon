ALTER TABLE `personas` ADD `default_model` text;--> statement-breakpoint
ALTER TABLE `personas` ADD `tools` text DEFAULT '[]' NOT NULL;