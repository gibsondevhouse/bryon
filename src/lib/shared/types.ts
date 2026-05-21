import type { z } from 'zod';
import type {
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
	planSchema,
	planStatusSchema,
	projectFileSchema,
	projectSchema,
	promptPresetSchema,
	settingsSchema,
	streamRequestSchema,
	webSearchSettingsSchema,
} from './schemas';

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
export type Plan = z.infer<typeof planSchema>;
export type PlanStatus = z.infer<typeof planStatusSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectFile = z.infer<typeof projectFileSchema>;
export type PromptPreset = z.infer<typeof promptPresetSchema>;
export type MemoryEntry = z.infer<typeof memoryEntrySchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type LLMSettings = z.infer<typeof llmSettingsSchema>;
export type WebSearchSettings = z.infer<typeof webSearchSettingsSchema>;
export type MemorySettings = z.infer<typeof memorySettingsSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type StreamRequest = z.infer<typeof streamRequestSchema>;

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
