import type { LLMParams, MessageRole } from '../../shared/types';

export type LLMMessage = {
	role: MessageRole | 'tool';
	content: string;
	images?: string[]; // base64-encoded image data (no data-URL prefix)
};

export type LLMStreamRequest = {
	model: string;
	messages: LLMMessage[];
	params?: Partial<LLMParams>;
	signal?: AbortSignal;
	/** Whether to enable the model's chain-of-thought reasoning. Defaults to true. */
	thinking?: boolean;
};

export type LLMTokenEvent = {
	type: 'token';
	delta: string;
};

export type LLMThinkingEvent = {
	type: 'thinking';
	delta: string;
};

export type LLMDoneEvent = {
	type: 'done';
	tokensIn?: number;
	tokensOut?: number;
	totalDurationMs?: number;
};

export type LLMStreamEvent =
	| LLMTokenEvent
	| LLMThinkingEvent
	| LLMDoneEvent;

export type LLMAdapter = {
	stream(request: LLMStreamRequest): Promise<ReadableStream<LLMStreamEvent>>;
	ping(signal?: AbortSignal): Promise<boolean>;
};

export class LLMAdapterError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly status?: number,
		readonly cause?: unknown,
	) {
		super(message);
		this.name = 'LLMAdapterError';
	}
}
