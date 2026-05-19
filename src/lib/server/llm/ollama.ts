import { defaultLLMParams } from '../../shared/schemas';
import { STREAM_ERROR_CODE } from '../../shared/stream-events';
import type { LLMParams } from '../../shared/types';
import {
	LLMAdapterError,
	type LLMAdapter,
	type LLMMessage,
	type LLMStreamEvent,
	type LLMStreamRequest,
} from './adapter';

const NANOS_PER_MS = 1_000_000;

type OllamaMessage = {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	images?: string[]; // base64 image data for vision models
};

type OllamaChatChunk = {
	model?: string;
	message?: {
		role?: string;
		content?: string;
		thinking?: string;
	};
	done?: boolean;
	eval_count?: number;
	total_duration?: number;
	error?: string;
};

type DecodedRound = {
	tokensOut?: number;
	totalDurationMs?: number;
};

export type OllamaAdapterOptions = {
	baseUrl?: string;
	defaultParams?: LLMParams;
};

export class OllamaAdapter implements LLMAdapter {
	readonly baseUrl: string;
	readonly defaultParams: LLMParams;

	constructor(options: OllamaAdapterOptions = {}) {
		this.baseUrl = trimTrailingSlash(
			options.baseUrl ?? 'http://127.0.0.1:11434',
		);
		this.defaultParams = options.defaultParams ?? defaultLLMParams;
	}

	async ping(signal?: AbortSignal): Promise<boolean> {
		try {
			const response = await fetch(new URL('/api/tags', this.baseUrl), {
				signal,
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	async stream(
		request: LLMStreamRequest,
	): Promise<ReadableStream<LLMStreamEvent>> {
		const baseUrl = this.baseUrl;
		const params = { ...this.defaultParams, ...request.params };
		const messages = toOllamaMessages(request.messages);
		const signal = request.signal;
		const requestController = new AbortController();
		let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
		let requestAbortHandler: (() => void) | null = null;

		return new ReadableStream<LLMStreamEvent>({
			async start(controller) {
				requestAbortHandler = () => requestController.abort(signal?.reason);
				signal?.addEventListener('abort', requestAbortHandler, { once: true });

				try {
					const response = await fetch(new URL('/api/chat', baseUrl), {
						method: 'POST',
						headers: {
							'content-type': 'application/json',
						},
						body: JSON.stringify({
							model: request.model,
							messages,
							stream: true,
							think: request.thinking ?? true,
							options: toOllamaOptions(params),
							keep_alive: params.keep_alive,
						}),
						signal: requestController.signal,
					});

					if (!response.ok) {
						throw await toAdapterError(response, request.model);
					}
					if (!response.body) {
						throw new LLMAdapterError(
							'Ollama returned an empty stream.',
							'EMPTY_STREAM',
							response.status,
						);
					}

					const decoded = await decodeOllamaRound({
						body: response.body,
						model: request.model,
						signal: requestController.signal,
						setActiveReader: (reader) => {
							activeReader = reader;
						},
						onToken: (delta) => {
							controller.enqueue({ type: 'token', delta });
						},
						onThinking: (delta) => {
							controller.enqueue({ type: 'thinking', delta });
						},
					});

					controller.enqueue({
						type: 'done',
						tokensOut: decoded.tokensOut,
						totalDurationMs: decoded.totalDurationMs,
					});
					controller.close();
				} catch (error) {
					if (error instanceof LLMAdapterError) {
						controller.error(error);
						return;
					}

					if (requestController.signal.aborted || signal?.aborted) {
						controller.error(
							new LLMAdapterError(
								'Ollama stream was aborted.',
								STREAM_ERROR_CODE.Aborted,
								undefined,
								error,
							),
						);
						return;
					}

					controller.error(
						new LLMAdapterError(
							'Ollama stream was interrupted.',
							STREAM_ERROR_CODE.StreamInterrupted,
							undefined,
							error,
						),
					);
				} finally {
					activeReader = null;
					if (requestAbortHandler) {
						signal?.removeEventListener('abort', requestAbortHandler);
					}
				}
			},
			cancel() {
				requestController.abort();
				void activeReader?.cancel();
			},
		});
	}
}

function toOllamaMessages(messages: LLMMessage[]): OllamaMessage[] {
	return messages.map((message) => ({
		role: toOllamaRole(message.role),
		content: message.content,
		images: message.images?.length ? message.images : undefined,
	}));
}

function toOllamaRole(role: LLMMessage['role']): OllamaMessage['role'] {
	switch (role) {
		case 'system':
		case 'user':
		case 'assistant':
		case 'tool':
			return role;
		default:
			return 'assistant';
	}
}

function toOllamaOptions(params: LLMParams) {
	return {
		temperature: params.temperature,
		top_p: params.top_p,
		top_k: params.top_k,
		repeat_penalty: params.repeat_penalty,
		num_ctx: params.num_ctx,
		num_predict: params.num_predict,
	};
}

async function decodeOllamaRound(input: {
	body: ReadableStream<Uint8Array>;
	model: string;
	signal?: AbortSignal;
	setActiveReader: (reader: ReadableStreamDefaultReader<Uint8Array>) => void;
	onToken: (delta: string) => void;
	onThinking: (delta: string) => void;
}): Promise<DecodedRound> {
	const reader = input.body.getReader();
	input.setActiveReader(reader);
	const decoder = new TextDecoder();
	let buffer = '';
	let tokensOut: number | undefined;
	let totalDurationMs: number | undefined;
	const tagRouter = createThinkTagRouter(input.onToken, input.onThinking);

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				processChunkLine({
					line,
					model: input.model,
					tagRouter,
					onThinking: input.onThinking,
					onDone: (chunk) => {
						tokensOut = chunk.eval_count;
						totalDurationMs = chunk.total_duration
							? Math.round(chunk.total_duration / NANOS_PER_MS)
							: undefined;
					},
				});
			}
		}

		buffer += decoder.decode();
		if (buffer.trim()) {
			processChunkLine({
				line: buffer,
				model: input.model,
				tagRouter,
				onThinking: input.onThinking,
				onDone: (chunk) => {
					tokensOut = chunk.eval_count;
					totalDurationMs = chunk.total_duration
						? Math.round(chunk.total_duration / NANOS_PER_MS)
						: undefined;
				},
			});
		}
	} catch (error) {
		if (error instanceof LLMAdapterError) {
			throw error;
		}

		if (input.signal?.aborted) {
			throw new LLMAdapterError(
				'Ollama stream was aborted.',
				STREAM_ERROR_CODE.Aborted,
				undefined,
				error,
			);
		}

		throw new LLMAdapterError(
			'Ollama stream was interrupted.',
			STREAM_ERROR_CODE.StreamInterrupted,
			undefined,
			error,
		);
	} finally {
		reader.releaseLock();
	}

	return {
		tokensOut,
		totalDurationMs,
	};
}

function processChunkLine(input: {
	line: string;
	model: string;
	tagRouter: (text: string) => void;
	onThinking: (delta: string) => void;
	onDone: (chunk: OllamaChatChunk) => void;
}): void {
	const { line, model, tagRouter, onThinking, onDone } = input;
	if (!line.trim()) return;

	const chunk = JSON.parse(line) as OllamaChatChunk;
	if (chunk.error) {
		throw toChunkError(chunk.error, model);
	}

	// Native Ollama thinking (Ollama 0.9+, think: true)
	const thinkingDelta = chunk.message?.thinking ?? '';
	if (thinkingDelta) onThinking(thinkingDelta);

	// Content — route through <think> tag parser as fallback for older Ollama
	const contentDelta = chunk.message?.content ?? '';
	if (contentDelta) tagRouter(contentDelta);

	if (chunk.done) {
		onDone(chunk);
	}
}

/**
 * Routes content through a <think>...</think> tag state machine.
 * Handles tags split across chunk boundaries by buffering potential tag starts.
 * Falls back gracefully when no tags are present (standard models).
 */
function createThinkTagRouter(
	onToken: (delta: string) => void,
	onThinking: (delta: string) => void,
): (text: string) => void {
	const OPEN = '<think>';
	const CLOSE = '</think>';
	let buf = '';
	let inThink = false;

	return function route(text: string): void {
		buf += text;
		while (buf.length > 0) {
			const needle = inThink ? CLOSE : OPEN;
			const idx = buf.indexOf(needle);
			if (idx >= 0) {
				const before = buf.slice(0, idx);
				if (before) (inThink ? onThinking : onToken)(before);
				buf = buf.slice(idx + needle.length);
				inThink = !inThink;
			} else {
				// No complete tag found — flush all but the last (needle.length - 1)
				// chars so we can't split a tag across calls.
				const safe = Math.max(0, buf.length - (needle.length - 1));
				if (safe > 0) {
					(inThink ? onThinking : onToken)(buf.slice(0, safe));
					buf = buf.slice(safe);
				}
				break;
			}
		}
	};
}

function toChunkError(message: string, model: string): LLMAdapterError {
	if (message.toLowerCase().includes('not found')) {
		return new LLMAdapterError(
			`Model "${model}" is not loaded. Run: ollama pull ${model}`,
			STREAM_ERROR_CODE.ModelNotFound,
		);
	}

	return new LLMAdapterError(message, STREAM_ERROR_CODE.OllamaError);
}

async function toAdapterError(
	response: Response,
	model: string,
): Promise<LLMAdapterError> {
	let message = `Ollama request failed with HTTP ${response.status}.`;

	try {
		const body = (await response.json()) as { error?: string };
		message = body.error ?? message;
	} catch {
		// Keep the HTTP-level message when Ollama does not return JSON.
	}

	const code: string =
		response.status === 404 || message.toLowerCase().includes('not found')
			? STREAM_ERROR_CODE.ModelNotFound
			: STREAM_ERROR_CODE.OllamaError;

	if (code === STREAM_ERROR_CODE.ModelNotFound) {
		message = `Model "${model}" is not loaded. Run: ollama pull ${model}`;
	}

	return new LLMAdapterError(message, code, response.status);
}

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, '');
}
