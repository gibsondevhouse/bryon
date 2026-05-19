CREATE TABLE `kb_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`page` integer,
	`token_count` integer NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `kb_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `kb_collections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kb_collections_name_unique` ON `kb_collections` (`name`);--> statement-breakpoint
CREATE TABLE `kb_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`path` text NOT NULL,
	`hash` text NOT NULL,
	`mime` text NOT NULL,
	`title` text,
	`ingested_at` integer,
	`error_message` text,
	FOREIGN KEY (`collection_id`) REFERENCES `kb_collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kb_documents_collection_path_unique` ON `kb_documents` (`collection_id`, `path`);
--> statement-breakpoint
CREATE VIRTUAL TABLE `kb_chunks_fts` USING fts5(chunk_id UNINDEXED, text, content=`kb_chunks`, content_rowid=`rowid`);
--> statement-breakpoint
CREATE TRIGGER `kb_chunks_fts_insert` AFTER INSERT ON `kb_chunks` BEGIN
  INSERT INTO `kb_chunks_fts`(rowid, chunk_id, text) VALUES (new.rowid, new.id, new.text);
END;
--> statement-breakpoint
CREATE TRIGGER `kb_chunks_fts_delete` AFTER DELETE ON `kb_chunks` BEGIN
  INSERT INTO `kb_chunks_fts`(`kb_chunks_fts`, rowid, chunk_id, text) VALUES ('delete', old.rowid, old.id, old.text);
END;
