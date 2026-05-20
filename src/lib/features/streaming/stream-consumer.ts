import { createSseParser } from './sse-parser';
import { createTokenBatcher } from './token-batcher';
import {
	STREAM_EVENT,
	type ArticlesEvent,
	type StreamErrorEvent,
	type StreamEvent,
	type ThinkingTokenEvent,
} from '$lib/shared/stream-events';

/**
 * Callback surface for {@link consumeSseStream}.
 *
 * The consumer owns the network/parsing/batching machinery; these callbacks
 * mutate caller-owned reactive state in response to events. Callers should
 * use `getCurrentChatId()` to detect chat-switch races and ignore state
 * mutations when the current chat no longer matches.
 */
export type StreamHandlers = {
	/** The chat id that should still be receiving updates. */
	getCurrentChatId(): string | null;
	/** Fires for every token event; intended for counter bookkeeping. */
	onToken(data: { delta: string }): void;
	/** Fires for every thinking_token event. */
	onThinkingToken(data: ThinkingTokenEvent): void;
	/** Fires for the single `meta` event. */
	onMeta(data: {
		assistantId: string;
		msToFirst: number;
		tokensIn: number;
		contextLimit?: number;
		tokenBudget?: number;
		softCapReached?: boolean;
	}): void;
	/** Fires when the batcher releases buffered token text. */
	onAppend(combined: string): void;
	/** Fires for `done`. The batcher has been flushed before this. */
	onDone(data: { id: string; tokensOut: number; msTotal: number }): void;
	/** Fires for `error`. The batcher has been disposed before this. */
	onError(data: StreamErrorEvent): void;
	/** Fires when web search articles are available for the completed message. */
	onArticles(data: ArticlesEvent): void;
};

export async function consumeSseStream(
	body: ReadableStream<Uint8Array>,
	chatId: string,
	handlers: StreamHandlers,
): Promise<void> {
	const decoder = new TextDecoder();
	const reader = body.getReader();
	let lastByteAt = Date.now();
	const READ_TIMEOUT_MS = 15000;

	const timeoutCheck = setInterval(() => {
		if (Date.now() - lastByteAt > READ_TIMEOUT_MS) {
			reader.cancel('READ_TIMEOUT').catch(() => {});
		}
	}, 2000);

	const parser = createSseParser({
		onMalformed: (event, raw) => {
			console.warn('Dropped malformed SSE event', event, raw);
		},
	});
	const batcher = createTokenBatcher({
		onFlush: (combined) => {
			if (handlers.getCurrentChatId() !== chatId) return;
			handlers.onAppend(combined);
		},
	});

	const dispatch = (event: StreamEvent) => {
		const isCurrentChat = handlers.getCurrentChatId() === chatId;

		switch (event.event) {
			case STREAM_EVENT.ThinkingToken: {
				if (!isCurrentChat) break;
				handlers.onThinkingToken(event.data);
				break;
			}
			case STREAM_EVENT.Token: {
				handlers.onToken(event.data);
				batcher.push(event.data.delta);
				break;
			}
			case STREAM_EVENT.Meta: {
				if (!isCurrentChat) break;
				handlers.onMeta({
					assistantId: event.data.assistantId,
					msToFirst: event.data.msToFirst,
					tokensIn: event.data.tokensIn,
					contextLimit: event.data.contextLimit,
					tokenBudget: event.data.tokenBudget,
					softCapReached: event.data.softCapReached,
				});
				break;
			}
			case STREAM_EVENT.Done: {
				batcher.flush();
				if (!isCurrentChat) break;
				handlers.onDone(event.data);
				break;
			}
			case STREAM_EVENT.Error: {
				batcher.dispose();
				if (!isCurrentChat) break;
				handlers.onError(event.data);
				break;
			}
			case STREAM_EVENT.Articles: {
				if (!isCurrentChat) break;
				handlers.onArticles(event.data);
				break;
			}
		}
	};

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			lastByteAt = Date.now();
			const chunk = decoder.decode(value, { stream: true });
			for (const event of parser.feed(chunk)) dispatch(event);
		}
		for (const event of parser.flush()) dispatch(event);
	} finally {
		clearInterval(timeoutCheck);
		batcher.flush();
		batcher.dispose();
		reader.releaseLock();
	}
}
