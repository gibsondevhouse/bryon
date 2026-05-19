CREATE VIRTUAL TABLE `messages_fts` USING fts5(
	`id` UNINDEXED,
	`chat_id` UNINDEXED,
	`role` UNINDEXED,
	`content`,
	content='messages',
	content_rowid='rowid'
);
--> statement-breakpoint
CREATE TRIGGER `messages_fts_ai` AFTER INSERT ON `messages` BEGIN
	INSERT INTO `messages_fts` (`rowid`, `id`, `chat_id`, `role`, `content`)
	VALUES (new.`rowid`, new.`id`, new.`chat_id`, new.`role`, new.`content`);
END;
--> statement-breakpoint
CREATE TRIGGER `messages_fts_ad` AFTER DELETE ON `messages` BEGIN
	INSERT INTO `messages_fts` (`messages_fts`, `rowid`, `id`, `chat_id`, `role`, `content`)
	VALUES ('delete', old.`rowid`, old.`id`, old.`chat_id`, old.`role`, old.`content`);
END;
--> statement-breakpoint
CREATE TRIGGER `messages_fts_au` AFTER UPDATE ON `messages` BEGIN
	INSERT INTO `messages_fts` (`messages_fts`, `rowid`, `id`, `chat_id`, `role`, `content`)
	VALUES ('delete', old.`rowid`, old.`id`, old.`chat_id`, old.`role`, old.`content`);

	INSERT INTO `messages_fts` (`rowid`, `id`, `chat_id`, `role`, `content`)
	VALUES (new.`rowid`, new.`id`, new.`chat_id`, new.`role`, new.`content`);
END;
--> statement-breakpoint
INSERT INTO `messages_fts` (`messages_fts`) VALUES ('rebuild');
