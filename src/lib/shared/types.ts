import type { z } from 'zod';
import type {
	aarLessonSchema,
	aarSchema,
	aarStatusSchema,
	commandersIntentSchema,
	conopsDecisionPointSchema,
	conopsPhaseSchema,
	doctrineLifecycleSchema,
	appearanceSettingsSchema,
	appSettingsSchema,
	attachmentSchema,
	chatSchema,
	intakeScanFileKindSchema,
	intakeScanFileSchema,
	intakeScanPhaseSchema,
	intakeScanSchema,
	intakeScanStatusSchema,
	llmParamsSchema,
	llmSettingsSchema,
	memorySettingsSchema,
	messageRoleSchema,
	modelSourceSchema,
	messageSchema,
	memoryEntrySchema,
	personaSchema,
	planDoctrineSchema,
	planCardSchema,
	planCardSeriesSchema,
	planSchema,
	planStatusSchema,
	opordParagraphsSchema,
	opordSchema,
	opordStatusSchema,
	fragoImpactSchema,
	fragoSchema,
	fragoStatusSchema,
	missionNeedPrioritySchema,
	missionNeedSchema,
	missionNeedSourceSchema,
	privacySettingsSchema,
	projectFileSchema,
	projectSchema,
	projectStatusSchema,
	promptPresetSchema,
	settingsSchema,
	streamRequestSchema,
	taskSourceKindSchema,
	taskTraceabilitySchema,
	taskSchema,
	taskStatusSchema,
	lessonTargetKindSchema,
	oplanSchema,
	webSearchSettingsSchema,
} from './schemas';
import type { DoctrineTerm as SharedDoctrineTerm } from './doctrine';
import type { BuiltInLocalOnlyCategory } from './routing';

export type Attachment = z.infer<typeof attachmentSchema>;
export type IntakeScanStatus = z.infer<typeof intakeScanStatusSchema>;
export type IntakeScanPhase = z.infer<typeof intakeScanPhaseSchema>;
export type IntakeScanFileKind = z.infer<typeof intakeScanFileKindSchema>;
export type IntakeScanFile = z.infer<typeof intakeScanFileSchema>;
export type IntakeScan = z.infer<typeof intakeScanSchema>;
export type MessageRole = z.infer<typeof messageRoleSchema>;
export type ModelSource = z.infer<typeof modelSourceSchema>;
export type LLMParams = z.infer<typeof llmParamsSchema>;
export type Persona = z.infer<typeof personaSchema>;
export type Chat = z.infer<typeof chatSchema>;
export type Message = z.infer<typeof messageSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskTraceability = z.infer<typeof taskTraceabilitySchema>;
export type Plan = z.infer<typeof planSchema>;
export type PlanStatus = z.infer<typeof planStatusSchema>;
export type DoctrineLifecycle = z.infer<typeof doctrineLifecycleSchema>;
export type MissionNeedPriority = z.infer<typeof missionNeedPrioritySchema>;
export type MissionNeedSource = z.infer<typeof missionNeedSourceSchema>;
export type MissionNeed = z.infer<typeof missionNeedSchema>;
export type CommandersIntent = z.infer<typeof commandersIntentSchema>;
export type Oplan = z.infer<typeof oplanSchema>;
export type PlanDoctrine = z.infer<typeof planDoctrineSchema>;
export type ConopsDecisionPoint = z.infer<typeof conopsDecisionPointSchema>;
export type ConopsPhase = z.infer<typeof conopsPhaseSchema>;
export type OpordStatus = z.infer<typeof opordStatusSchema>;
export type OpordParagraphs = z.infer<typeof opordParagraphsSchema>;
export type Opord = z.infer<typeof opordSchema>;
export type FragoStatus = z.infer<typeof fragoStatusSchema>;
export type FragoImpact = z.infer<typeof fragoImpactSchema>;
export type Frago = z.infer<typeof fragoSchema>;
export type AarStatus = z.infer<typeof aarStatusSchema>;
export type AarLesson = z.infer<typeof aarLessonSchema>;
export type Aar = z.infer<typeof aarSchema>;
export type TaskSourceKind = z.infer<typeof taskSourceKindSchema>;
export type LessonTargetKind = z.infer<typeof lessonTargetKindSchema>;
export type PlanCard = z.infer<typeof planCardSchema>;
export type PlanCardSeries = z.infer<typeof planCardSeriesSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectFile = z.infer<typeof projectFileSchema>;
export type PromptPreset = z.infer<typeof promptPresetSchema>;
export type MemoryEntry = z.infer<typeof memoryEntrySchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type LLMSettings = z.infer<typeof llmSettingsSchema>;
export type WebSearchSettings = z.infer<typeof webSearchSettingsSchema>;
export type MemorySettings = z.infer<typeof memorySettingsSchema>;
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;
export type AppearanceSettings = z.infer<typeof appearanceSettingsSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type StreamRequest = z.infer<typeof streamRequestSchema>;
export type DoctrineTerm = SharedDoctrineTerm;
export type LocalOnlyCategory = BuiltInLocalOnlyCategory | string;

export type StreamErrorCode =
	| 'MODEL_NOT_FOUND'
	| 'MODEL_NOT_VISION'
	| 'STREAM_INTERRUPTED'
	| 'OLLAMA_ERROR'
	| 'WEB_SEARCH_DISABLED'
	| 'WEB_SEARCH_FAILED'
	| 'ABORTED'
	| 'BAD_REQUEST'
	| 'BAD_EVENT';

export type StreamPhase =
	| { kind: 'idle' }
	| { kind: 'connecting'; userMessageId: string }
	| {
			kind: 'streaming';
			userMessageId: string;
			assistantId: string;
			startedAt: number;
	  }
	| { kind: 'thinking'; userMessageId: string; assistantId: string }
	| {
			kind: 'error';
			code: StreamErrorCode;
			message?: string;
			assistantId?: string;
	  }
	| { kind: 'aborted'; assistantId?: string }
	| { kind: 'done'; assistantId: string };
