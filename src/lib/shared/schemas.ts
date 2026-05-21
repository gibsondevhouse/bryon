import { z } from 'zod';

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
} as const;

export const defaultLLMSettings = {
	backend: 'ollama',
	base_url: 'http://127.0.0.1:11434',
	model: 'gemma4:e4b',
	vision_model: 'gemma4:e4b',
	thinking: 'normal' as 'off' | 'auto' | 'light' | 'normal' | 'extended',
	params: defaultLLMParams,
} as const;

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
]);

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
	path:      z.string().min(1),
	size:      z.number().int().nonnegative(),
	kind:      intakeScanFileKindSchema,
	ext:       z.string(),
});

export const intakeScanSchema = z.object({
	id:               z.string().min(1),
	folderPath:       z.string().min(1),
	status:           intakeScanStatusSchema,
	phase:            intakeScanPhaseSchema,
	filesFound:       z.number().int().nonnegative(),
	filesClassified:  z.number().int().nonnegative(),
	errorMessage:     z.string().nullable().default(null),
	result:           z.array(intakeScanFileSchema).nullable().default(null),
	createdAt:        z.number().int().nonnegative(),
	updatedAt:        z.number().int().nonnegative(),
	cancelledAt:      z.number().int().nonnegative().nullable().default(null),
	completedAt:      z.number().int().nonnegative().nullable().default(null),
});

export const taskSchema = z.object({
	id: z.string().min(1),
	planId: z.string().min(1),
	body: z.string().min(1),
	done: z.boolean().default(false),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

export const planSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	summary: z.string().nullable().default(null),
	planType: z.string().nullable().default(null),
	startDate: z.string().nullable().default(null),
	status: planStatusSchema,
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
	status: planStatusSchema.default('ideation'),
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
});

export const llmSettingsSchema = z.object({
	backend: z.literal('ollama').default(defaultLLMSettings.backend),
	base_url: z.string().min(1).default(defaultLLMSettings.base_url),
	model: z.string().min(1).default(defaultLLMSettings.model),
	vision_model: z.string().min(1).default(defaultLLMSettings.vision_model),
	thinking: z.enum(['off', 'auto', 'light', 'normal', 'extended']).default(defaultLLMSettings.thinking),
	params: llmParamsSchema.default(defaultLLMParams),
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

export const settingsSchema = z.object({
	app: appSettingsSchema.default(defaultAppSettings),
	llm: llmSettingsSchema.default(defaultLLMSettings),
	web_search: webSearchSettingsSchema.default(defaultWebSearchSettings),
	memory: memorySettingsSchema.default(defaultMemorySettings),
});

export const streamRequestSchema = z.object({
	content: z.string().trim().min(1),
	paramsOverride: llmParamsSchema.partial().optional(),
	attachments: z.array(attachmentSchema).optional(),
	projectFileIds: z.array(z.string().min(1)).optional(),
	webSearch: z.boolean().optional().default(false),
	thinkingMode: z.enum(['off', 'auto', 'light', 'normal', 'extended']).optional(),
});
