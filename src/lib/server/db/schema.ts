import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const personas = sqliteTable('personas', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	systemPrompt: text('system_prompt').notNull(),
	defaultModel: text('default_model'),
	toolsJson: text('tools').notNull().default('[]'),
	paramsJson: text('params_json'),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull(),
});

export const chats = sqliteTable(
	'chats',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		model: text('model'),
		personaId: text('persona_id')
			.notNull()
			.references(() => personas.id),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull(),
		archived: integer('archived').notNull().default(0),
		paramsJson: text('params_json'),
	},
	(t) => [
		// Compound index matches `WHERE archived = ? ORDER BY updated_at DESC`
		index('idx_chats_archived_updated_at').on(t.archived, t.updatedAt),
	],
);

export const messages = sqliteTable(
	'messages',
	{
		id: text('id').primaryKey(),
		chatId: text('chat_id')
			.notNull()
			.references(() => chats.id, { onDelete: 'cascade' }),
		role: text('role', {
			enum: ['system', 'user', 'assistant', 'tool_call', 'tool_result'],
		}).notNull(),
		content: text('content').notNull(),
		tokensIn: integer('tokens_in'),
		tokensOut: integer('tokens_out'),
		msToFirst: integer('ms_to_first'),
		msTotal: integer('ms_total'),
		createdAt: integer('created_at').notNull(),
		summarized: integer('summarized').notNull().default(0),
		attachmentsJson: text('attachments_json'),
	},
	(t) => [
		// Supports `WHERE chat_id = ? ORDER BY created_at DESC` in listMessages()
		index('idx_messages_chat_id').on(t.chatId),
	],
);

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
});

export const kbCollections = sqliteTable('kb_collections', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	description: text('description'),
	createdAt: integer('created_at').notNull(),
});

export const kbDocuments = sqliteTable(
	'kb_documents',
	{
		id: text('id').primaryKey(),
		collectionId: text('collection_id')
			.notNull()
			.references(() => kbCollections.id, { onDelete: 'cascade' }),
		path: text('path').notNull(),
		hash: text('hash').notNull(),
		mime: text('mime').notNull(),
		title: text('title'),
		ingestedAt: integer('ingested_at'),
		errorMessage: text('error_message'),
	},
	(t) => [
		index('idx_kb_documents_collection_id').on(t.collectionId),
	],
);

export const kbChunks = sqliteTable(
	'kb_chunks',
	{
		id: text('id').primaryKey(),
		documentId: text('document_id')
			.notNull()
			.references(() => kbDocuments.id, { onDelete: 'cascade' }),
		ordinal: integer('ordinal').notNull(),
		page: integer('page'),
		tokenCount: integer('token_count').notNull(),
		text: text('text').notNull(),
	},
	(t) => [
		index('idx_kb_chunks_document_id').on(t.documentId),
	],
);

export const personasRelations = relations(personas, ({ many }) => ({
	chats: many(chats),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
	persona: one(personas, {
		fields: [chats.personaId],
		references: [personas.id],
	}),
	messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
	chat: one(chats, {
		fields: [messages.chatId],
		references: [chats.id],
	}),
}));

export const kbCollectionsRelations = relations(kbCollections, ({ many }) => ({
	documents: many(kbDocuments),
}));

export const kbDocumentsRelations = relations(kbDocuments, ({ one, many }) => ({
	collection: one(kbCollections, {
		fields: [kbDocuments.collectionId],
		references: [kbCollections.id],
	}),
	chunks: many(kbChunks),
}));

export const kbChunksRelations = relations(kbChunks, ({ one }) => ({
	document: one(kbDocuments, {
		fields: [kbChunks.documentId],
		references: [kbDocuments.id],
	}),
}));
