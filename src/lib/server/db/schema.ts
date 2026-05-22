import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
		doctrineLifecycle: text('doctrine_lifecycle', {
			enum: ['proposed', 'drafting', 'active', 'archived'],
		}).notNull().default('proposed'),
		missionNeedGap: text('mission_need_gap'),
		missionNeedContext: text('mission_need_context'),
		missionNeedPriority: text('mission_need_priority', {
			enum: ['low', 'medium', 'high', 'critical'],
		}),
		missionNeedSource: text('mission_need_source', {
			enum: ['folder_intake', 'manual_entry', 'chat_command', 'imported_document'],
		}),
		intentPurpose: text('intent_purpose'),
		intentEndState: text('intent_end_state'),
		intentKeyTasksJson: text('intent_key_tasks_json').notNull().default('[]'),
		intentConstraintsJson: text('intent_constraints_json').notNull().default('[]'),
		lineOfEffortJson: text('line_of_effort_json').notNull().default('[]'),
		oplanMissionStatement: text('oplan_mission_statement'),
		oplanExecutionTimelineJson: text('oplan_execution_timeline_json').notNull().default('[]'),
		oplanTaskOrganizationJson: text('oplan_task_organization_json').notNull().default('[]'),
		oplanSustainmentJson: text('oplan_sustainment_json').notNull().default('[]'),
		oplanAnnexesJson: text('oplan_annexes_json').notNull().default('[]'),
		oplanReferencesJson: text('oplan_references_json').notNull().default('[]'),
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
		index('idx_plans_doctrine_lifecycle').on(t.doctrineLifecycle),
		index('idx_plans_archived_at').on(t.archivedAt),
		index('idx_plans_project_id').on(t.projectId),
	],
);

export const conopsPhases = sqliteTable(
	'conops_phases',
	{
		id:            text('id').primaryKey(),
		planId:        text('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
		ordinal:       integer('ordinal').notNull().default(0),
		name:          text('name').notNull(),
		summary:       text('summary'),
		startEvent:    text('start_event'),
		endEvent:      text('end_event'),
		objectivesJson: text('objectives_json').notNull().default('[]'),
		decisionPointsJson: text('decision_points_json').notNull().default('[]'),
		branchesJson:  text('branches_json').notNull().default('[]'),
		contingenciesJson: text('contingencies_json').notNull().default('[]'),
		archivedAt:    integer('archived_at'),
		createdAt:     integer('created_at').notNull(),
		updatedAt:     integer('updated_at').notNull(),
	},
	(t) => [
		index('idx_conops_phases_plan_id').on(t.planId, t.ordinal),
		index('idx_conops_phases_archived_at').on(t.archivedAt),
	],
);

export const opords = sqliteTable(
	'opords',
	{
		id:         text('id').primaryKey(),
		planId:     text('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
		status:     text('status', {
			enum: ['draft', 'issued', 'superseded', 'archived'],
		}).notNull().default('draft'),
		paragraphsJson: text('paragraphs_json').notNull().default('{"situation":null,"mission":null,"execution":null,"sustainment":null,"commandAndSignal":null}'),
		issuedAt:   integer('issued_at'),
		pushedAt:   integer('pushed_at'),
		archivedAt: integer('archived_at'),
		createdAt:  integer('created_at').notNull(),
		updatedAt:  integer('updated_at').notNull(),
	},
	(t) => [
		index('idx_opords_plan_id').on(t.planId, t.status),
		index('idx_opords_archived_at').on(t.archivedAt),
	],
);

export const fragos = sqliteTable(
	'fragos',
	{
		id:         text('id').primaryKey(),
		opordId:    text('opord_id').notNull().references(() => opords.id, { onDelete: 'cascade' }),
		status:     text('status', {
			enum: ['draft', 'issued', 'applied', 'archived'],
		}).notNull().default('draft'),
		changeType: text('change_type', {
			enum: ['addition', 'modification', 'deletion'],
		}).notNull(),
		targetsJson: text('targets_json').notNull().default('[]'),
		originalText: text('original_text'),
		amendedText: text('amended_text'),
		reason:     text('reason'),
		effectiveAt: integer('effective_at'),
		issuedAt:   integer('issued_at'),
		appliedAt:  integer('applied_at'),
		acknowledgedAt: integer('acknowledged_at'),
		archivedAt: integer('archived_at'),
		createdAt:  integer('created_at').notNull(),
		updatedAt:  integer('updated_at').notNull(),
	},
	(t) => [
		index('idx_fragos_opord_id').on(t.opordId, t.status),
		index('idx_fragos_archived_at').on(t.archivedAt),
	],
);

export const fragoImpacts = sqliteTable(
	'frago_impacts',
	{
		id:         text('id').primaryKey(),
		fragoId:    text('frago_id').notNull().references(() => fragos.id, { onDelete: 'cascade' }),
		entityKind: text('entity_kind', {
			enum: ['task', 'project', 'phase', 'plan_card', 'opord_paragraph'],
		}).notNull(),
		entityId:   text('entity_id').notNull(),
		impactKind: text('impact_kind', {
			enum: ['added', 'modified', 'deleted', 'flagged'],
		}).notNull(),
		createdAt:  integer('created_at').notNull(),
	},
	(t) => [
		index('idx_frago_impacts_frago_id').on(t.fragoId),
		uniqueIndex('uq_frago_impacts_entity').on(t.fragoId, t.entityKind, t.entityId),
	],
);

export const aars = sqliteTable(
	'aars',
	{
		id:         text('id').primaryKey(),
		planId:     text('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
		projectId:  text('project_id').references(() => projects.id, { onDelete: 'set null' }),
		opordId:    text('opord_id').references(() => opords.id, { onDelete: 'set null' }),
		fragoId:    text('frago_id').references(() => fragos.id, { onDelete: 'set null' }),
		checkpointId: text('checkpoint_id').references(() => workspaceCheckpoints.id, { onDelete: 'set null' }),
		status:     text('status', {
			enum: ['draft', 'in_review', 'complete', 'archived'],
		}).notNull().default('draft'),
		whatHappened: text('what_happened'),
		whatWasSupposedToHappen: text('what_was_supposed_to_happen'),
		whatWentRight: text('what_went_right'),
		whatWentWrong: text('what_went_wrong'),
		recommendations: text('recommendations'),
		relatedTaskIdsJson: text('related_task_ids_json').notNull().default('[]'),
		completedAt: integer('completed_at'),
		archivedAt: integer('archived_at'),
		createdAt:  integer('created_at').notNull(),
		updatedAt:  integer('updated_at').notNull(),
	},
	(t) => [
		index('idx_aars_plan_id').on(t.planId, t.status),
		index('idx_aars_project_id').on(t.projectId),
		index('idx_aars_checkpoint_id').on(t.checkpointId),
		index('idx_aars_archived_at').on(t.archivedAt),
	],
);

export const aarLessons = sqliteTable(
	'aar_lessons',
	{
		id:         text('id').primaryKey(),
		aarId:      text('aar_id').notNull().references(() => aars.id, { onDelete: 'cascade' }),
		status:     text('status', {
			enum: ['proposed', 'accepted', 'rejected'],
		}).notNull().default('proposed'),
		proposedTargetKind: text('proposed_target_kind', {
			enum: ['review', 'rule', 'standard', 'workflow', 'project'],
		}).notNull().default('review'),
		lesson:     text('lesson').notNull(),
		evidenceJson: text('evidence_json').notNull().default('[]'),
		acceptedAt: integer('accepted_at'),
		rejectedAt: integer('rejected_at'),
		createdAt:  integer('created_at').notNull(),
		updatedAt:  integer('updated_at').notNull(),
	},
	(t) => [
		index('idx_aar_lessons_aar_id').on(t.aarId, t.status),
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
		sourceKind:  text('source_kind', {
			enum: ['manual', 'opord', 'frago', 'intake', 'expansion'],
		}).notNull().default('manual'),
		sourceKey:   text('source_key'),
		sourceOpordId: text('source_opord_id').references(() => opords.id, { onDelete: 'set null' }),
		sourceOpordParagraph: text('source_opord_paragraph'),
		sourceFragoId: text('source_frago_id').references(() => fragos.id, { onDelete: 'set null' }),
		phaseId:     text('phase_id').references(() => conopsPhases.id, { onDelete: 'set null' }),
		pushBatchId: text('push_batch_id'),
		sourceFingerprint: text('source_fingerprint'),
		createdAt:   integer('created_at').notNull(),
		updatedAt:   integer('updated_at').notNull(),
	},
	(t) => [
		index('idx_tasks_plan_id').on(t.planId, t.createdAt),
		index('idx_tasks_project_id').on(t.projectId, t.status),
		index('idx_tasks_phase_id').on(t.phaseId),
		index('idx_tasks_source_opord_id').on(t.sourceOpordId),
		index('idx_tasks_source_frago_id').on(t.sourceFragoId),
		uniqueIndex('uq_tasks_source_fingerprint').on(t.sourceFingerprint),
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
	phases: many(conopsPhases),
	opords: many(opords),
	fragos: many(fragos),
	aars: many(aars),
}));

export const conopsPhasesRelations = relations(conopsPhases, ({ one, many }) => ({
	plan: one(plans, {
		fields: [conopsPhases.planId],
		references: [plans.id],
	}),
	tasks: many(tasks),
}));

export const opordsRelations = relations(opords, ({ one, many }) => ({
	plan: one(plans, {
		fields: [opords.planId],
		references: [plans.id],
	}),
	tasks: many(tasks),
	fragos: many(fragos),
	aars: many(aars),
}));

export const fragosRelations = relations(fragos, ({ one, many }) => ({
	opord: one(opords, {
		fields: [fragos.opordId],
		references: [opords.id],
	}),
	impacts: many(fragoImpacts),
	tasks: many(tasks),
	aars: many(aars),
}));

export const fragoImpactsRelations = relations(fragoImpacts, ({ one }) => ({
	frago: one(fragos, {
		fields: [fragoImpacts.fragoId],
		references: [fragos.id],
	}),
}));

export const aarsRelations = relations(aars, ({ one, many }) => ({
	plan: one(plans, {
		fields: [aars.planId],
		references: [plans.id],
	}),
	project: one(projects, {
		fields: [aars.projectId],
		references: [projects.id],
	}),
	opord: one(opords, {
		fields: [aars.opordId],
		references: [opords.id],
	}),
	frago: one(fragos, {
		fields: [aars.fragoId],
		references: [fragos.id],
	}),
	checkpoint: one(workspaceCheckpoints, {
		fields: [aars.checkpointId],
		references: [workspaceCheckpoints.id],
	}),
	lessons: many(aarLessons),
}));

export const aarLessonsRelations = relations(aarLessons, ({ one }) => ({
	aar: one(aars, {
		fields: [aarLessons.aarId],
		references: [aars.id],
	}),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
	plan: one(plans, { fields: [tasks.planId], references: [plans.id] }),
	project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
	phase: one(conopsPhases, { fields: [tasks.phaseId], references: [conopsPhases.id] }),
	sourceOpord: one(opords, { fields: [tasks.sourceOpordId], references: [opords.id] }),
	sourceFrago: one(fragos, { fields: [tasks.sourceFragoId], references: [fragos.id] }),
}));

export const planCardsRelations = relations(planCards, ({ one }) => ({
	plan: one(plans, { fields: [planCards.planId], references: [plans.id] }),
}));

export const workspaceCheckpointsRelations = relations(workspaceCheckpoints, ({ many }) => ({
	findings: many(syncAuditFindings),
	aars: many(aars),
}));

export const syncAuditFindingsRelations = relations(syncAuditFindings, ({ one }) => ({
	checkpoint: one(workspaceCheckpoints, {
		fields: [syncAuditFindings.checkpointId],
		references: [workspaceCheckpoints.id],
	}),
}));
