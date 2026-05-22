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
		projectId: text('project_id').references(() => projects.id),
	},
	(t) => [
		// Compound index matches `WHERE archived = ? ORDER BY updated_at DESC`
		index('idx_chats_archived_updated_at').on(t.archived, t.updatedAt),
		index('idx_chats_project_updated_at').on(t.projectId, t.updatedAt),
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

export const projects = sqliteTable(
	'projects',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		description: text('description'),
		promptOverride: text('prompt_override'),
		memoryEnabled: integer('memory_enabled').notNull().default(1),
		remember: text('remember').notNull().default(''),
		neverSuggest: text('never_suggest').notNull().default(''),
		status: text('status', {
			enum: ['ideation', 'definition', 'execution', 'maintenance', 'planned', 'in_progress'],
		}).notNull().default('ideation'),
		planId: text('plan_id'),
		archivedAt: integer('archived_at'),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull(),
	},
	(t) => [
		index('idx_projects_archived_updated_at').on(t.archivedAt, t.updatedAt),
	],
);

export const projectFiles = sqliteTable(
	'project_files',
	{
		id: text('id').primaryKey(),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		mime: text('mime').notNull(),
		kind: text('kind', { enum: ['image', 'document'] })
			.notNull()
			.default('document'),
		path: text('path').notNull(),
		textPath: text('text_path'),
		sizeBytes: integer('size_bytes').notNull(),
		textBytes: integer('text_bytes'),
		archivedAt: integer('archived_at'),
		createdAt: integer('created_at').notNull(),
	},
	(t) => [
		index('idx_project_files_project_id').on(t.projectId, t.archivedAt),
	],
);

export const promptPresets = sqliteTable('prompt_presets', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	body: text('body').notNull(),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull(),
});

export const memoryEntries = sqliteTable(
	'memory_entries',
	{
		id: text('id').primaryKey(),
		scope: text('scope', { enum: ['global', 'project'] }).notNull(),
		projectId: text('project_id').references(() => projects.id, {
			onDelete: 'cascade',
		}),
		kind: text('kind', { enum: ['remember', 'never_suggest'] }).notNull(),
		body: text('body').notNull(),
		enabled: integer('enabled').notNull().default(1),
		origin: text('origin', { enum: ['user', 'imported', 'model_suggested'] })
			.notNull()
			.default('user'),
		archivedAt: integer('archived_at'),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull(),
	},
	(t) => [
		index('idx_memory_entries_scope_project').on(t.scope, t.projectId, t.archivedAt),
	],
);

export const projectFileChunks = sqliteTable(
	'project_file_chunks',
	{
		id: text('id').primaryKey(),
		projectFileId: text('project_file_id')
			.notNull()
			.references(() => projectFiles.id, { onDelete: 'cascade' }),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		ordinal: integer('ordinal').notNull(),
		tokenCount: integer('token_count').notNull(),
		text: text('text').notNull(),
	},
	(t) => [
		index('idx_project_file_chunks_project_id').on(t.projectId),
		index('idx_project_file_chunks_file_id').on(t.projectFileId),
	],
);

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
	project: one(projects, {
		fields: [chats.projectId],
		references: [projects.id],
	}),
	messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
	chat: one(chats, {
		fields: [messages.chatId],
		references: [chats.id],
	}),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
	chats: many(chats),
	files: many(projectFiles),
	memoryEntries: many(memoryEntries),
	tasks: many(tasks),
	plan: one(plans, { fields: [projects.planId], references: [plans.id] }),
}));

export const projectFilesRelations = relations(projectFiles, ({ one, many }) => ({
	project: one(projects, {
		fields: [projectFiles.projectId],
		references: [projects.id],
	}),
	chunks: many(projectFileChunks),
}));

export const memoryEntriesRelations = relations(memoryEntries, ({ one }) => ({
	project: one(projects, {
		fields: [memoryEntries.projectId],
		references: [projects.id],
	}),
}));

export const projectFileChunksRelations = relations(projectFileChunks, ({ one }) => ({
	file: one(projectFiles, {
		fields: [projectFileChunks.projectFileId],
		references: [projectFiles.id],
	}),
	project: one(projects, {
		fields: [projectFileChunks.projectId],
		references: [projects.id],
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

// ── Intake scans ──────────────────────────────────────────────────────────────

export const intakeScans = sqliteTable(
	'intake_scans',
	{
		id:               text('id').primaryKey(),
		folderPath:       text('folder_path').notNull(),
		status:           text('status', {
			enum: ['queued', 'running', 'completed', 'cancelled', 'failed'],
		}).notNull().default('queued'),
		phase:            text('phase', {
			enum: ['queued', 'enumerating', 'classifying', 'completed'],
		}).notNull().default('queued'),
		filesFound:       integer('files_found').notNull().default(0),
		filesClassified:  integer('files_classified').notNull().default(0),
		errorMessage:     text('error_message'),
		resultJson:       text('result_json'),
		createdAt:        integer('created_at').notNull(),
		updatedAt:        integer('updated_at').notNull(),
		cancelledAt:      integer('cancelled_at'),
		completedAt:      integer('completed_at'),
	},
	(t) => [
		index('idx_intake_scans_status_created').on(t.status, t.createdAt),
	],
);

// ── Plans ─────────────────────────────────────────────────────────────────────

export const plans = sqliteTable(
	'plans',
	{
		id:        text('id').primaryKey(),
		name:      text('name').notNull(),
		summary:   text('summary'),
		planType:  text('plan_type'),
		startDate: text('start_date'),
		status:    text('status', {
			enum: ['ideation', 'definition', 'execution', 'maintenance', 'drafting', 'active'],
		}).notNull().default('ideation'),
		projectId:  text('project_id').references(() => projects.id, { onDelete: 'set null' }),
		archivedAt: integer('archived_at'),
		createdAt:  integer('created_at').notNull(),
		updatedAt:  integer('updated_at').notNull(),
	},
	(t) => [
		index('idx_plans_status_updated_at').on(t.status, t.updatedAt),
		index('idx_plans_archived_at').on(t.archivedAt),
		index('idx_plans_project_id').on(t.projectId),
	],
);

export const tasks = sqliteTable(
	'tasks',
	{
		id:          text('id').primaryKey(),
		planId:      text('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
		body:        text('body').notNull().default(''),
		done:        integer('done').notNull().default(0),
		title:       text('title').notNull().default(''),
		description: text('description'),
		status:      text('status', {
			enum: ['proposed', 'planned', 'in_progress', 'blocked', 'completed', 'archived'],
		}).notNull().default('planned'),
		projectId:   text('project_id').references(() => projects.id, { onDelete: 'set null' }),
		assignee:    text('assignee'),
		dueDate:     text('due_date'),
		sortOrder:   integer('sort_order'),
		createdAt:   integer('created_at').notNull(),
		updatedAt:   integer('updated_at').notNull(),
	},
	(t) => [
		index('idx_tasks_plan_id').on(t.planId, t.createdAt),
		index('idx_tasks_project_id').on(t.projectId, t.status),
	],
);

export const planCards = sqliteTable(
	'plan_cards',
	{
		id:            text('id').primaryKey(),
		planId:        text('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
		series:        text('series', {
			enum: ['100', '200', '300', '400', '500', '600', '700', '800', '900', '1000'],
		}).notNull().default('100'),
		title:         text('title').notNull(),
		body:          text('body'),
		sortOrder:     integer('sort_order'),
		locked:        integer('locked').notNull().default(0),
		contextWeight: text('context_weight', {
			enum: ['always', 'conditional', 'never'],
		}).notNull().default('conditional'),
		archivedAt:    integer('archived_at'),
		createdAt:     integer('created_at').notNull(),
		updatedAt:     integer('updated_at').notNull(),
	},
	(t) => [
		index('idx_plan_cards_plan_id').on(t.planId, t.archivedAt),
	],
);

export const routingLogs = sqliteTable(
	'routing_logs',
	{
		id:             text('id').primaryKey(),
		taskType:       text('task_type').notNull(),
		tier:           integer('tier').notNull(),
		model:          text('model').notNull(),
		remote:         integer('remote').notNull(),
		privacyDecision: text('privacy_decision').notNull(),
		tokensIn:       integer('tokens_in'),
		tokensOut:      integer('tokens_out'),
		errorCode:      text('error_code'),
		createdAt:      integer('created_at').notNull(),
	},
	(t) => [
		index('idx_routing_logs_created_at').on(t.createdAt),
	],
);

export const workspaceCheckpoints = sqliteTable(
	'workspace_checkpoints',
	{
		id:           text('id').primaryKey(),
		description:  text('description').notNull(),
		path:         text('path').notNull(),
		snapshotJson: text('snapshot_json').notNull(),
		createdAt:    integer('created_at').notNull(),
	},
);

export const syncAuditFindings = sqliteTable(
	'sync_audit_findings',
	{
		id:           text('id').primaryKey(),
		checkpointId: text('checkpoint_id').references(() => workspaceCheckpoints.id),
		severity:     text('severity', { enum: ['info', 'warning', 'error'] }).notNull(),
		code:         text('code').notNull(),
		message:      text('message').notNull(),
		path:         text('path'),
		resolvedAt:   integer('resolved_at'),
		createdAt:    integer('created_at').notNull(),
	},
	(t) => [
		index('idx_sync_audit_findings_checkpoint').on(t.checkpointId, t.resolvedAt),
	],
);

export const plansRelations = relations(plans, ({ many }) => ({
	tasks: many(tasks),
	cards: many(planCards),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
	plan: one(plans, { fields: [tasks.planId], references: [plans.id] }),
	project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
}));

export const planCardsRelations = relations(planCards, ({ one }) => ({
	plan: one(plans, { fields: [planCards.planId], references: [plans.id] }),
}));

export const workspaceCheckpointsRelations = relations(workspaceCheckpoints, ({ many }) => ({
	findings: many(syncAuditFindings),
}));

export const syncAuditFindingsRelations = relations(syncAuditFindings, ({ one }) => ({
	checkpoint: one(workspaceCheckpoints, {
		fields: [syncAuditFindings.checkpointId],
		references: [workspaceCheckpoints.id],
	}),
}));
