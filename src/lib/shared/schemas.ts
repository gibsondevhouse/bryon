import { z } from 'zod';
import { normalizeRoutingCategories } from './routing';

export const defaultLLMParams = {
	temperature: 1.0,
	top_p: 0.95,
	top_k: 64,
	repeat_penalty: 1.1,
	num_ctx: 16384,
	num_predict: 1024,
	keep_alive: '10m',
} as const;

export const defaultAppSettings = {
	host: '127.0.0.1',
	port: 5174,
	data_dir: '~/.local/share/bryon',
	workspace_dir: '.',
} as const;

export const defaultLLMSettings = {
	backend: 'ollama',
	base_url: 'http://127.0.0.1:11434',
	model: 'gemma4:e4b',
	vision_model: 'gemma4:e4b',
	small_model: '',
	large_model: 'gemma4:31b',
	flash_model: '',
	gemini_api: { enabled: false, model: '', api_key: '' },
	thinking: 'normal' as 'off' | 'auto' | 'light' | 'normal' | 'extended',
	params: defaultLLMParams,
} as const;

export const defaultPrivacySettings = {
	tier3_enabled: false,
	require_remote_preview: false,
	local_only_categories: [] as string[],
};

export const defaultWebSearchSettings = {
	enabled: true,
	searxng_url: '',
	max_results: 5,
} as const;

export const defaultMemorySettings = {
	enabled: true,
	remember: '',
	never_suggest: '',
} as const;

export const messageRoleSchema = z.enum([
	'system',
	'user',
	'assistant',
	'tool_call',
	'tool_result',
]);

export const modelSourceSchema = z.enum([
	'chat_pin',
	'persona_default',
	'global_default',
	'llm_fallback',
]);

export const llmParamsSchema = z.object({
	temperature: z.number().min(0).max(2).default(defaultLLMParams.temperature),
	top_p: z.number().min(0).max(1).default(defaultLLMParams.top_p),
	top_k: z.number().int().positive().default(defaultLLMParams.top_k),
	repeat_penalty: z
		.number()
		.positive()
		.default(defaultLLMParams.repeat_penalty),
	num_ctx: z.number().int().positive().default(defaultLLMParams.num_ctx),
	num_predict: z
		.number()
		.int()
		.positive()
		.default(defaultLLMParams.num_predict),
	keep_alive: z.string().min(1).default(defaultLLMParams.keep_alive),
});

export const personaSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	systemPrompt: z.string().min(1),
	// Legacy v1.5 columns are still parsed for DB compatibility, but v1 only
	// uses the default Bryon persona and global chat settings.
	defaultModel: z.string().min(1).nullable().default(null),
	tools: z.array(z.string().min(1)).default([]),
	paramsJson: llmParamsSchema.partial().nullable().default(null),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

export const chatSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	model: z.string().min(1).nullable().default(null),
	resolvedModel: z.string().min(1).nullable().default(null),
	modelSource: modelSourceSchema.nullable().default(null),
	personaId: z.string().min(1),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
	archived: z.boolean().default(false),
	params: llmParamsSchema.partial().nullable().default(null),
	projectId: z.string().min(1).nullable().default(null),
});

export const attachmentKindSchema = z.enum(['image', 'document']);

export const attachmentSchema = z.object({
	id: z.string().min(1),
	path: z.string().min(1),
	name: z.string().min(1).default('Attachment'),
	kind: attachmentKindSchema.default('image'),
	mime: z.string().min(1),
	sizeBytes: z.number().int().nonnegative(),
	width: z.number().int().positive().optional(),
	height: z.number().int().positive().optional(),
	title: z.string().nullable().optional(),
	textPath: z.string().min(1).nullable().optional(),
	textBytes: z.number().int().nonnegative().nullable().optional(),
	errorMessage: z.string().nullable().optional(),
});

export const messageSchema = z.object({
	id: z.string().min(1),
	chatId: z.string().min(1),
	role: messageRoleSchema,
	content: z.string(),
	tokensIn: z.number().int().nonnegative().nullable().default(null),
	tokensOut: z.number().int().nonnegative().nullable().default(null),
	msToFirst: z.number().int().nonnegative().nullable().default(null),
	msTotal: z.number().int().nonnegative().nullable().default(null),
	createdAt: z.number().int().nonnegative(),
	summarized: z.boolean().default(false),
	attachmentsJson: z.string().nullable().default(null),
});

export const planStatusSchema = z.enum([
	'ideation',
	'definition',
	'execution',
	'maintenance',
	'drafting',
	'active',
]);

export const projectStatusSchema = z.enum([
	'ideation',
	'definition',
	'execution',
	'maintenance',
	'planned',
	'in_progress',
]);

export const taskStatusSchema = z.enum([
	'proposed',
	'planned',
	'in_progress',
	'blocked',
	'completed',
	'archived',
]);

export const doctrineLifecycleSchema = z.enum([
	'proposed',
	'drafting',
	'active',
	'archived',
]);

export const opordStatusSchema = z.enum([
	'draft',
	'issued',
	'superseded',
	'archived',
]);

export const fragoStatusSchema = z.enum([
	'draft',
	'issued',
	'applied',
	'archived',
]);

export const aarStatusSchema = z.enum([
	'draft',
	'in_review',
	'complete',
	'archived',
]);

export const missionNeedPrioritySchema = z.enum([
	'low',
	'medium',
	'high',
	'critical',
]);

export const missionNeedSourceSchema = z.enum([
	'folder_intake',
	'manual_entry',
	'chat_command',
	'imported_document',
]);

export const taskSourceKindSchema = z.enum([
	'manual',
	'opord',
	'frago',
	'intake',
	'expansion',
]);

export const lessonTargetKindSchema = z.enum([
	'review',
	'rule',
	'standard',
	'workflow',
	'project',
]);

export const missionNeedSchema = z.object({
	gap: z.string().nullable().default(null),
	context: z.string().nullable().default(null),
	priority: missionNeedPrioritySchema.nullable().default(null),
	source: missionNeedSourceSchema.nullable().default(null),
});

const defaultMissionNeed = {
	gap: null,
	context: null,
	priority: null,
	source: null,
} satisfies z.infer<typeof missionNeedSchema>;

export const commandersIntentSchema = z.object({
	purpose: z.string().nullable().default(null),
	keyTasks: z.array(z.string().min(1)).default([]),
	endState: z.string().nullable().default(null),
	constraints: z.array(z.string().min(1)).default([]),
});

const defaultCommandersIntent = {
	purpose: null,
	keyTasks: [],
	endState: null,
	constraints: [],
} satisfies z.infer<typeof commandersIntentSchema>;

export const oplanSchema = z.object({
	missionStatement: z.string().nullable().default(null),
	executionTimeline: z.array(z.string().min(1)).default([]),
	taskOrganization: z.array(z.string().min(1)).default([]),
	sustainment: z.array(z.string().min(1)).default([]),
	annexes: z.array(z.string().min(1)).default([]),
	references: z.array(z.string().min(1)).default([]),
});

const defaultOplan = {
	missionStatement: null,
	executionTimeline: [],
	taskOrganization: [],
	sustainment: [],
	annexes: [],
	references: [],
} satisfies z.infer<typeof oplanSchema>;

export const planDoctrineSchema = z.object({
	lifecycle: doctrineLifecycleSchema.nullable().default(null),
	missionNeed: missionNeedSchema.default(defaultMissionNeed),
	commandersIntent: commandersIntentSchema.default(defaultCommandersIntent),
	lineOfEffort: z.array(z.string().min(1)).default([]),
	oplan: oplanSchema.default(defaultOplan),
});

const defaultPlanDoctrine = {
	lifecycle: null,
	missionNeed: defaultMissionNeed,
	commandersIntent: defaultCommandersIntent,
	lineOfEffort: [],
	oplan: defaultOplan,
} satisfies z.infer<typeof planDoctrineSchema>;

export const conopsDecisionPointSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	trigger: z.string().nullable().default(null),
	branch: z.string().nullable().default(null),
	notes: z.string().nullable().default(null),
});

export const conopsPhaseSchema = z.object({
	id: z.string().min(1),
	planId: z.string().min(1),
	ordinal: z.number().int().nonnegative(),
	name: z.string().min(1),
	summary: z.string().nullable().default(null),
	startEvent: z.string().nullable().default(null),
	endEvent: z.string().nullable().default(null),
	objectives: z.array(z.string().min(1)).default([]),
	decisionPoints: z.array(conopsDecisionPointSchema).default([]),
	branches: z.array(z.string().min(1)).default([]),
	contingencies: z.array(z.string().min(1)).default([]),
	archivedAt: z.number().int().nonnegative().nullable().default(null),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

export const opordParagraphsSchema = z.object({
	situation: z.string().nullable().default(null),
	mission: z.string().nullable().default(null),
	execution: z.string().nullable().default(null),
	sustainment: z.string().nullable().default(null),
	commandAndSignal: z.string().nullable().default(null),
});

export const opordSchema = z.object({
	id: z.string().min(1),
	planId: z.string().min(1),
	status: opordStatusSchema.default('draft'),
	paragraphs: opordParagraphsSchema,
	issuedAt: z.number().int().nonnegative().nullable().default(null),
	pushedAt: z.number().int().nonnegative().nullable().default(null),
	archivedAt: z.number().int().nonnegative().nullable().default(null),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

export const fragoTargetSchema = z.object({
	kind: z.enum([
		'plan',
		'phase',
		'opord_paragraph',
		'project',
		'task',
		'plan_card',
	]),
	id: z.string().min(1),
	paragraph: z.string().nullable().default(null),
	note: z.string().nullable().default(null),
});

export const fragoSchema = z.object({
	id: z.string().min(1),
	opordId: z.string().min(1),
	status: fragoStatusSchema.default('draft'),
	changeType: z.enum(['addition', 'modification', 'deletion']),
	targets: z.array(fragoTargetSchema).default([]),
	originalText: z.string().nullable().default(null),
	amendedText: z.string().nullable().default(null),
	reason: z.string().nullable().default(null),
	effectiveAt: z.number().int().nonnegative().nullable().default(null),
	issuedAt: z.number().int().nonnegative().nullable().default(null),
	appliedAt: z.number().int().nonnegative().nullable().default(null),
	acknowledgedAt: z.number().int().nonnegative().nullable().default(null),
	archivedAt: z.number().int().nonnegative().nullable().default(null),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

export const fragoImpactSchema = z.object({
	id: z.string().min(1),
	fragoId: z.string().min(1),
	entityKind: z.enum([
		'task',
		'project',
		'phase',
		'plan_card',
		'opord_paragraph',
	]),
	entityId: z.string().min(1),
	impactKind: z.enum(['added', 'modified', 'deleted', 'flagged']),
	createdAt: z.number().int().nonnegative(),
});

export const aarSchema = z.object({
	id: z.string().min(1),
	planId: z.string().min(1),
	projectId: z.string().min(1).nullable().default(null),
	opordId: z.string().min(1).nullable().default(null),
	fragoId: z.string().min(1).nullable().default(null),
	checkpointId: z.string().min(1).nullable().default(null),
	status: aarStatusSchema.default('draft'),
	whatHappened: z.string().nullable().default(null),
	whatWasSupposedToHappen: z.string().nullable().default(null),
	whatWentRight: z.string().nullable().default(null),
	whatWentWrong: z.string().nullable().default(null),
	recommendations: z.string().nullable().default(null),
	relatedTaskIds: z.array(z.string().min(1)).default([]),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
	completedAt: z.number().int().nonnegative().nullable().default(null),
	archivedAt: z.number().int().nonnegative().nullable().default(null),
});

export const aarLessonSchema = z.object({
	id: z.string().min(1),
	aarId: z.string().min(1),
	status: z.enum(['proposed', 'accepted', 'rejected']).default('proposed'),
	proposedTargetKind: lessonTargetKindSchema.default('review'),
	lesson: z.string().min(1),
	evidence: z.array(z.string().min(1)).default([]),
	acceptedAt: z.number().int().nonnegative().nullable().default(null),
	rejectedAt: z.number().int().nonnegative().nullable().default(null),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

// ── Intake scans ──────────────────────────────────────────────────────────────

export const intakeScanStatusSchema = z.enum([
	'queued',
	'running',
	'completed',
	'cancelled',
	'failed',
]);

export const intakeScanPhaseSchema = z.enum([
	'queued',
	'enumerating',
	'classifying',
	'completed',
]);

export const intakeScanFileKindSchema = z.enum([
	'image',
	'document',
	'text',
	'code',
	'data',
	'media',
	'other',
]);

export const intakeScanFileSchema = z.object({
	id: z.string().min(1),
	path: z.string().min(1),
	size: z.number().int().nonnegative(),
	kind: intakeScanFileKindSchema,
	ext: z.string(),
	sensitive: z.boolean().default(false),
	category: z.string().default('other'),
	reviewState: z.enum(['pending', 'included', 'excluded']).default('pending'),
	proposedPlanName: z.string().nullable().default(null),
	proposedProjectName: z.string().nullable().default(null),
});

export const intakeScanSchema = z.object({
	id: z.string().min(1),
	folderPath: z.string().min(1),
	status: intakeScanStatusSchema,
	phase: intakeScanPhaseSchema,
	filesFound: z.number().int().nonnegative(),
	filesClassified: z.number().int().nonnegative(),
	errorMessage: z.string().nullable().default(null),
	result: z.array(intakeScanFileSchema).nullable().default(null),
	progress: z
		.object({
			phase: intakeScanPhaseSchema,
			scanned: z.number().int().nonnegative(),
		})
		.default({ phase: 'queued', scanned: 0 }),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
	cancelledAt: z.number().int().nonnegative().nullable().default(null),
	completedAt: z.number().int().nonnegative().nullable().default(null),
});

export const taskSchema = z.object({
	id: z.string().min(1),
	planId: z.string().min(1),
	body: z.string().default(''),
	done: z.boolean().default(false),
	title: z.string().default(''),
	description: z.string().nullable().default(null),
	status: taskStatusSchema.default('planned'),
	projectId: z.string().nullable().default(null),
	assignee: z.string().nullable().default(null),
	dueDate: z.string().nullable().default(null),
	sortOrder: z.number().int().nullable().default(null),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

export const taskTraceabilitySchema = z.object({
	sourceKind: taskSourceKindSchema.default('manual'),
	sourceKey: z.string().min(1).nullable().default(null),
	sourceOpordId: z.string().min(1).nullable().default(null),
	sourceOpordParagraph: z.string().min(1).nullable().default(null),
	sourceFragoId: z.string().min(1).nullable().default(null),
	phaseId: z.string().min(1).nullable().default(null),
	pushBatchId: z.string().min(1).nullable().default(null),
	sourceFingerprint: z.string().min(1).nullable().default(null),
});

export const planCardSeriesSchema = z.enum([
	'100',
	'200',
	'300',
	'400',
	'500',
	'600',
	'700',
	'800',
	'900',
	'1000',
]);

export const planCardContextWeightSchema = z.enum([
	'always',
	'conditional',
	'never',
]);

export const createPlanCardSchema = z.object({
	series: planCardSeriesSchema,
	title: z.string().trim().min(1),
	body: z.string().optional(),
	sortOrder: z.number().int().nonnegative().optional(),
	locked: z.boolean().optional(),
	contextWeight: planCardContextWeightSchema.optional(),
});

export const updatePlanCardSchema = z.object({
	series: planCardSeriesSchema.optional(),
	title: z.string().trim().min(1).optional(),
	body: z.string().optional(),
	sortOrder: z.number().int().nonnegative().optional(),
	locked: z.boolean().optional(),
	contextWeight: planCardContextWeightSchema.optional(),
	archived: z.boolean().optional(),
});

export const proposePlanSchema = z.object({
	name: z.string().trim().min(1),
	missionNeed: z.object({
		capabilityGap: z.string().trim().min(1),
		operationalContext: z.string().trim().min(1),
	}),
	initialCards: z
		.array(
			z.object({
				series: planCardSeriesSchema,
				title: z.string().trim().min(1),
				body: z.string().optional(),
			}),
		)
		.default([]),
});

export const planCardSchema = z.object({
	id: z.string().min(1),
	planId: z.string().min(1),
	series: planCardSeriesSchema.default('100'),
	title: z.string().min(1),
	body: z.string().nullable().default(null),
	sortOrder: z.number().int().nullable().default(null),
	locked: z.boolean().default(false),
	contextWeight: planCardContextWeightSchema.default('conditional'),
	archivedAt: z.number().int().nonnegative().nullable().default(null),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

// Phase 101: status is canonical. Doctrine columns (doctrineLifecycle, missionNeed*,
// intent*, oplan*, lineOfEffort) exist in DB; 102A wires them via planDoctrineSchema.
export const planSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	summary: z.string().nullable().default(null),
	planType: z.string().nullable().default(null),
	startDate: z.string().nullable().default(null),
	projectId: z.string().nullable().default(null),
	status: planStatusSchema,
	doctrineLifecycle: doctrineLifecycleSchema.default('proposed'),
	doctrine: planDoctrineSchema.default(defaultPlanDoctrine),
	archivedAt: z.number().int().nonnegative().nullable().default(null),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

export const projectSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().nullable().default(null),
	promptOverride: z.string().nullable().default(null),
	memoryEnabled: z.boolean().default(true),
	remember: z.string().default(''),
	neverSuggest: z.string().default(''),
	status: projectStatusSchema.default('ideation'),
	planId: z.string().nullable().default(null),
	archivedAt: z.number().int().nonnegative().nullable().default(null),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

export const projectFileSchema = z.object({
	id: z.string().min(1),
	projectId: z.string().min(1),
	name: z.string().min(1),
	mime: z.string().min(1),
	kind: attachmentKindSchema,
	path: z.string().min(1),
	textPath: z.string().min(1).nullable().default(null),
	sizeBytes: z.number().int().nonnegative(),
	textBytes: z.number().int().nonnegative().nullable().default(null),
	archivedAt: z.number().int().nonnegative().nullable().default(null),
	createdAt: z.number().int().nonnegative(),
});

export const promptPresetSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	body: z.string().min(1),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

export const memoryEntrySchema = z.object({
	id: z.string().min(1),
	scope: z.enum(['global', 'project']),
	projectId: z.string().min(1).nullable().default(null),
	kind: z.enum(['remember', 'never_suggest']),
	body: z.string().min(1),
	enabled: z.boolean().default(true),
	origin: z.enum(['user', 'imported', 'model_suggested']).default('user'),
	archivedAt: z.number().int().nonnegative().nullable().default(null),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

export const appSettingsSchema = z.object({
	host: z.string().min(1).default(defaultAppSettings.host),
	port: z.number().int().positive().default(defaultAppSettings.port),
	data_dir: z.string().min(1).default(defaultAppSettings.data_dir),
	workspace_dir: z.string().default(defaultAppSettings.workspace_dir),
});

export const llmSettingsSchema = z.object({
	backend: z.literal('ollama').default(defaultLLMSettings.backend),
	base_url: z.string().min(1).default(defaultLLMSettings.base_url),
	model: z.string().min(1).default(defaultLLMSettings.model),
	vision_model: z.string().min(1).default(defaultLLMSettings.vision_model),
	small_model: z.string().default(defaultLLMSettings.small_model),
	large_model: z.string().default(defaultLLMSettings.large_model),
	flash_model: z.string().default(defaultLLMSettings.flash_model),
	gemini_api: z
		.object({
			enabled: z.boolean().default(false),
			model: z.string().default(''),
			api_key: z.string().default(''),
		})
		.default(defaultLLMSettings.gemini_api),
	thinking: z
		.enum(['off', 'auto', 'light', 'normal', 'extended'])
		.default(defaultLLMSettings.thinking),
	params: llmParamsSchema.default(defaultLLMParams),
});

export const privacySettingsSchema = z.object({
	tier3_enabled: z.boolean().default(defaultPrivacySettings.tier3_enabled),
	require_remote_preview: z
		.boolean()
		.default(defaultPrivacySettings.require_remote_preview),
	local_only_categories: z
		.array(z.string().trim().min(1))
		.default(defaultPrivacySettings.local_only_categories)
		.transform(normalizeRoutingCategories),
});

export const webSearchSettingsSchema = z.object({
	enabled: z.boolean().default(defaultWebSearchSettings.enabled),
	searxng_url: z.string().default(defaultWebSearchSettings.searxng_url),
	max_results: z
		.number()
		.int()
		.min(1)
		.max(10)
		.default(defaultWebSearchSettings.max_results),
});

export const memorySettingsSchema = z.object({
	enabled: z.boolean().default(defaultMemorySettings.enabled),
	remember: z.string().default(defaultMemorySettings.remember),
	never_suggest: z.string().default(defaultMemorySettings.never_suggest),
});

export const doctrineLabelModeSchema = z.enum([
	'doctrine_only',
	'doctrine_with_helper',
	'plain_first',
]);

export const defaultAppearanceSettings = {
	doctrine_label_mode: 'doctrine_with_helper',
} as const;

export const appearanceSettingsSchema = z.object({
	doctrine_label_mode: doctrineLabelModeSchema.default(
		defaultAppearanceSettings.doctrine_label_mode,
	),
});

export const settingsSchema = z.object({
	app: appSettingsSchema.default(defaultAppSettings),
	llm: llmSettingsSchema.default(defaultLLMSettings),
	web_search: webSearchSettingsSchema.default(defaultWebSearchSettings),
	memory: memorySettingsSchema.default(defaultMemorySettings),
	privacy: privacySettingsSchema.default(defaultPrivacySettings),
	appearance: appearanceSettingsSchema.default(defaultAppearanceSettings),
});

export const streamRequestSchema = z.object({
	content: z.string().trim().min(1),
	paramsOverride: llmParamsSchema.partial().optional(),
	attachments: z.array(attachmentSchema).optional(),
	projectFileIds: z.array(z.string().min(1)).optional(),
	webSearch: z.boolean().optional().default(false),
	thinkingMode: z
		.enum(['off', 'auto', 'light', 'normal', 'extended'])
		.optional(),
});
