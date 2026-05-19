import type { z } from 'zod';
import type {
	appSettingsSchema,
	attachmentSchema,
	chatSchema,
	llmParamsSchema,
	llmSettingsSchema,
	memorySettingsSchema,
	messageRoleSchema,
	modelSourceSchema,
	messageSchema,
	personaSchema,
	settingsSchema,
	streamRequestSchema,
	webSearchSettingsSchema,
} from './schemas';

export type Attachment = z.infer<typeof attachmentSchema>;
export type MessageRole = z.infer<typeof messageRoleSchema>;
export type ModelSource = z.infer<typeof modelSourceSchema>;
export type LLMParams = z.infer<typeof llmParamsSchema>;
export type Persona = z.infer<typeof personaSchema>;
export type Chat = z.infer<typeof chatSchema>;
export type Message = z.infer<typeof messageSchema>;
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
	| 'ABORTED';

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
