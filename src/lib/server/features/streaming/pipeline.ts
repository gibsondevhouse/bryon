import { loadConfig } from '$lib/server/config';
import { LLMAdapterError } from '$lib/server/llm/adapter';
import type { OllamaAdapter } from '$lib/server/llm/ollama';
import { countTokens } from '$lib/server/llm/tokens';
import { getLogger } from '$lib/server/logger';
import { apiError } from '$lib/server/http';
import type { ChatService } from '$lib/server/features/chat/chat';
import type { PersonaService } from '$lib/server/features/personas/persona';
import { TitleService } from '$lib/server/features/chat/title';
import type { PromptBuildResult } from './prompt';
import {
	STREAM_ERROR_CODE,
	STREAM_EVENT,
	articlesEventSchema,
	doneEventSchema,
	metaEventSchema,
	streamErrorEventSchema,
	thinkingTokenEventSchema,
	tokenEventSchema,
	type StreamEventName,
} from '$lib/shared/stream-events';
import type { LLMParams, MemorySettings, Message } from '$lib/shared/types';

const encoder = new TextEncoder();

export type StreamContext = {
	persona: {
		id: string;
		systemPrompt: string;
	};
	model: string;
	llmParams: Partial<LLMParams>;
};

export function resolveModelForChat(
	chatModel: string | null,
	configLlmModel: string,
): string {
	return chatModel ?? configLlmModel;
}

export function loadStreamContext(
	chatService: ChatService,
	personaService: PersonaService,
	chatId: string,
	hasImageAttachment = false,
): StreamContext | { response: Response } {
	const chat = chatService.get(chatId);
	if (!chat) {
		return { response: apiError(404, 'CHAT_NOT_FOUND', 'Chat not found.') };
	}

	const persona = personaService.get(chat.personaId) ?? personaService.getFirst();
	if (!persona) {
		return {
			response: apiError(
				500,
				'PERSONA_NOT_FOUND',
				'The default Bryon persona is missing.',
			),
		};
	}

	const { config } = loadConfig();
	const model = hasImageAttachment
		? config.llm.vision_model
		: resolveModelForChat(chat.model, config.llm.model);

	const llmParams: Partial<LLMParams> = {
		...config.llm.params,
		...chat.params,
	};

	return {
		persona: {
			id: persona.id,
			systemPrompt: persona.systemPrompt,
		},
		model,
		llmParams,
	};
}

export type EmitFn = (event: StreamEventName, data: unknown) => void;

const eventSchemaByName = {
	[STREAM_EVENT.Token]: tokenEventSchema,
	[STREAM_EVENT.ThinkingToken]: thinkingTokenEventSchema,
	[STREAM_EVENT.Meta]: metaEventSchema,
	[STREAM_EVENT.Done]: doneEventSchema,
	[STREAM_EVENT.Error]: streamErrorEventSchema,
	[STREAM_EVENT.Articles]: articlesEventSchema,
} as const;

export function makeEmitter(
	controller: ReadableStreamDefaultController<Uint8Array>,
): EmitFn {
	return (event, data) => {
		if (import.meta.env.DEV) {
			const schema = eventSchemaByName[event];
			const result = schema.safeParse(data);
			if (!result.success) {
				getLogger().error(
					{ event, data, issues: result.error.format() },
					'stream.invalid_payload',
				);
			}
		}
		controller.enqueue(
			encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
		);
	};
}

export type RunLLMStreamInput = {
	adapter: OllamaAdapter;
	model: string;
	prompt: PromptBuildResult;
	params: Partial<LLMParams>;
	signal: AbortSignal;
	emit: EmitFn;
	startedAt: number;
	assistantId: string;
	/** Whether to enable chain-of-thought reasoning. Defaults to true. */
	thinking?: boolean;
};

export type RunLLMStreamResult = {
	assistantContent: string;
	tokensIn: number | null;
	tokensOut: number | null;
	msToFirst: number | null;
};

export async function runLLMStream(
	input: RunLLMStreamInput,
): Promise<RunLLMStreamResult> {
	const {
		adapter,
		model,
		prompt,
		params,
		signal,
		emit,
		startedAt,
		assistantId,
		thinking,
	} = input;
	let assistantContent = '';
	let tokensIn: number | null = null;
	let tokensOut: number | null = null;
	let msToFirst: number | null = null;

	const llmStream = await adapter.stream({
		model,
		messages: prompt.messages,
		params,
		signal,
		thinking,
	});
	const reader = llmStream.getReader();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			if (value.type === 'thinking') {
				emit(STREAM_EVENT.ThinkingToken, { delta: value.delta });
				continue;
			}

			if (value.type === 'token') {
				if (msToFirst === null) {
					msToFirst = Math.round(performance.now() - startedAt);
					emit(STREAM_EVENT.Meta, {
						assistantId,
						msToFirst,
						tokensIn: prompt.tokensIn,
						contextLimit: prompt.contextLimit,
						tokenBudget: prompt.tokenBudget,
						softCapReached: prompt.strategy !== 'full',
					});
				}
				assistantContent += value.delta;
				emit(STREAM_EVENT.Token, { delta: value.delta });
				continue;
			}

			tokensIn = value.tokensIn ?? null;
			tokensOut = value.tokensOut ?? countTokens(assistantContent);
		}
	} finally {
		reader.releaseLock();
	}

	return { assistantContent, tokensIn, tokensOut, msToFirst };
}

export type FinalizeAssistantInput = {
	chatService: ChatService;
	chatId: string;
	assistantId: string;
	prompt: PromptBuildResult;
	assistantContent: string;
	tokensIn: number | null;
	tokensOut: number | null;
	msToFirst: number | null;
	msTotal: number;
};

export function finalizeAssistant(input: FinalizeAssistantInput): Message {
	return input.chatService.addMessage({
		id: input.assistantId,
		chatId: input.chatId,
		role: 'assistant',
		content: input.assistantContent,
		tokensIn: input.tokensIn ?? input.prompt.tokensIn,
		tokensOut: input.tokensOut ?? countTokens(input.assistantContent),
		msToFirst: input.msToFirst,
		msTotal: input.msTotal,
	});
}

export type FinalizeInterruptedInput = Omit<FinalizeAssistantInput, 'msTotal'>;

export function finalizeInterrupted(input: FinalizeInterruptedInput): void {
	input.chatService.addMessage({
		id: input.assistantId,
		chatId: input.chatId,
		role: 'assistant',
		content: input.assistantContent,
		tokensIn: input.tokensIn ?? input.prompt.tokensIn,
		tokensOut: input.tokensOut ?? countTokens(input.assistantContent),
		msToFirst: input.msToFirst,
		msTotal: null,
	});
}

export type QueueTitleGenerationInput = {
	adapter: OllamaAdapter;
	chatService: ChatService;
	chatId: string;
	messages: Array<{ role: string; content: string }>;
	model: string;
	params: Partial<LLMParams>;
};

export function queueTitleGeneration(input: QueueTitleGenerationInput): void {
	try {
		const titleService = new TitleService({
			adapter: input.adapter,
			chatService: input.chatService,
			model: input.model,
			params: input.params,
		});
		titleService.queueGenerate({
			chatId: input.chatId,
			messages: input.messages,
			model: input.model,
			params: input.params,
		});
	} catch (error) {
		getLogger().warn({ error, chatId: input.chatId }, 'title.queue_failed');
	}
}

export function persistPromptSummary(
	chatService: ChatService,
	chatId: string,
	history: Message[],
	prompt: PromptBuildResult,
): void {
	if (!prompt.summary || prompt.summarizedMessageIds.length === 0) return;

	const summarizedIds = new Set(prompt.summarizedMessageIds);
	const firstSummarized = history.find((message) =>
		summarizedIds.has(message.id),
	);

	chatService.addMessage({
		chatId,
		role: 'system',
		content: `Earlier conversation summary:\n${prompt.summary}`,
		createdAt: Math.max(0, (firstSummarized?.createdAt ?? Date.now()) - 1),
	});
	chatService.markMessagesSummarized(prompt.summarizedMessageIds);
}

export function buildSystemPrompt(input: {
	basePrompt: string;
	memory: MemorySettings;
	webContext?: string | null;
	thinkingInstruction?: string | null;
}): string {
	const now = new Date();
	const dateTimeStr = now.toLocaleString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZoneName: 'short',
	});
	const sections = [`Current date and time: ${dateTimeStr}\n\n${input.basePrompt.trim()}`];

	if (input.memory.enabled) {
		const memorySections: string[] = [];
		if (input.memory.remember.trim()) {
			memorySections.push(`Remember:\n${input.memory.remember.trim()}`);
		}
		if (input.memory.never_suggest.trim()) {
			memorySections.push(
				`Never suggest unless the user explicitly asks:\n${input.memory.never_suggest.trim()}`,
			);
		}
		if (memorySections.length > 0) {
			sections.push(`User-managed memory:\n${memorySections.join('\n\n')}`);
		}
	}

	if (input.webContext?.trim()) {
		sections.push(`Web search context for this turn:\n${input.webContext.trim()}`);
	}

	if (input.thinkingInstruction?.trim()) {
		sections.push(`Reasoning guidance for this turn:\n${input.thinkingInstruction.trim()}`);
	}

	return sections.join('\n\n');
}

export function toStreamError(
	error: unknown,
	model: string,
	aborted: boolean,
): { code: string; model?: string; message: string } {
	if (aborted) {
		return {
			code: STREAM_ERROR_CODE.Aborted,
			message: 'Stream was cancelled.',
		};
	}

	if (error instanceof LLMAdapterError) {
		return {
			code: error.code,
			model,
			message: error.message,
		};
	}

	return {
		code: STREAM_ERROR_CODE.StreamInterrupted,
		message: 'Connection to Ollama lost mid-generation.',
	};
}
