CREATE INDEX `idx_messages_chat_id` ON `messages` (`chat_id`);--> statement-breakpoint
CREATE INDEX `idx_chats_archived_updated_at` ON `chats` (`archived`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_kb_chunks_document_id` ON `kb_chunks` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_kb_documents_collection_id` ON `kb_documents` (`collection_id`);