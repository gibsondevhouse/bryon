import { z } from 'zod';

/**
 * Single source of truth for the SSE event contract between
 * `POST /api/chats/:id/stream` (server) and `Session.consumeSSE` (client).
 *
 * Adding or changing a field requires updating both producers and consumers.
 */

export const STREAM_EVENT = {
	Token: 'token',
	ThinkingToken: 'thinking_token',
	Meta: 'meta',
	Done: 'done',
	Error: 'error',
	Articles: 'articles',
} as const;

export type StreamEventName = (typeof STREAM_EVENT)[keyof typeof STREAM_EVENT];

export const STREAM_ERROR_CODE = {
	ModelNotFound: 'MODEL_NOT_FOUND',
	ModelNotVision: 'MODEL_NOT_VISION',
	StreamInterrupted: 'STREAM_INTERRUPTED',
	Aborted: 'ABORTED',
	OllamaError: 'OLLAMA_ERROR',
	WebSearchDisabled: 'WEB_SEARCH_DISABLED',
	WebSearchFailed: 'WEB_SEARCH_FAILED',
	BadRequest: 'BAD_REQUEST',
	BadEvent: 'BAD_EVENT',
} as const;

export type StreamErrorCode =
	(typeof STREAM_ERROR_CODE)[keyof typeof STREAM_ERROR_CODE];

export const tokenEventSchema = z.object({
	delta: z.string(),
});

export const thinkingTokenEventSchema = z.object({
	delta: z.string(),
});

export const metaEventSchema = z.object({
	msToFirst: z.number().int().nonnegative(),
	tokensIn: z.number().int().nonnegative(),
});

export const doneEventSchema = z.object({
	id: z.string().min(1),
	tokensOut: z.number().int().nonnegative(),
	msTotal: z.number().int().nonnegative(),
});

export const streamErrorEventSchema = z.object({
	code: z.string().min(1),
	model: z.string().min(1).optional(),
	message: z.string().min(1),
});

export const newsArticleSchema = z.object({
	title: z.string(),
	url: z.string(),
	snippet: z.string(),
});

export const articlesEventSchema = z.object({
	messageId: z.string().min(1),
	articles: z.array(newsArticleSchema).max(10),
});

export type TokenEvent = z.infer<typeof tokenEventSchema>;
export type ThinkingTokenEvent = z.infer<typeof thinkingTokenEventSchema>;
export type MetaEvent = z.infer<typeof metaEventSchema>;
export type DoneEvent = z.infer<typeof doneEventSchema>;
export type StreamErrorEvent = z.infer<typeof streamErrorEventSchema>;
export type NewsArticle = z.infer<typeof newsArticleSchema>;
export type ArticlesEvent = z.infer<typeof articlesEventSchema>;

export type StreamEvent =
	| { event: typeof STREAM_EVENT.Token; data: TokenEvent }
	| { event: typeof STREAM_EVENT.ThinkingToken; data: ThinkingTokenEvent }
	| { event: typeof STREAM_EVENT.Meta; data: MetaEvent }
	| { event: typeof STREAM_EVENT.Done; data: DoneEvent }
	| { event: typeof STREAM_EVENT.Error; data: StreamErrorEvent }
	| { event: typeof STREAM_EVENT.Articles; data: ArticlesEvent };

/** Map of event name → schema, for typed lookups on both sides. */
export const streamEventSchemas = {
	[STREAM_EVENT.Token]: tokenEventSchema,
	[STREAM_EVENT.ThinkingToken]: thinkingTokenEventSchema,
	[STREAM_EVENT.Meta]: metaEventSchema,
	[STREAM_EVENT.Done]: doneEventSchema,
	[STREAM_EVENT.Error]: streamErrorEventSchema,
	[STREAM_EVENT.Articles]: articlesEventSchema,
} as const;

/**
 * Parse a single SSE event payload by name. Returns `null` if the event
 * name is unknown — caller decides how to react.
 */
export function parseStreamEvent(
	event: string,
	data: unknown,
): StreamEvent | null {
	switch (event) {
		case STREAM_EVENT.Token: {
			const parsed = tokenEventSchema.safeParse(data);
			return parsed.success
				? { event: STREAM_EVENT.Token, data: parsed.data }
				: null;
		}
		case STREAM_EVENT.Meta: {
			const parsed = metaEventSchema.safeParse(data);
			return parsed.success
				? { event: STREAM_EVENT.Meta, data: parsed.data }
				: null;
		}
		case STREAM_EVENT.Done: {
			const parsed = doneEventSchema.safeParse(data);
			return parsed.success
				? { event: STREAM_EVENT.Done, data: parsed.data }
				: null;
		}
		case STREAM_EVENT.ThinkingToken: {
			const parsed = thinkingTokenEventSchema.safeParse(data);
			return parsed.success
				? { event: STREAM_EVENT.ThinkingToken, data: parsed.data }
				: null;
		}
		case STREAM_EVENT.Error: {
			const parsed = streamErrorEventSchema.safeParse(data);
			return parsed.success
				? { event: STREAM_EVENT.Error, data: parsed.data }
				: null;
		}
		case STREAM_EVENT.Articles: {
			const parsed = articlesEventSchema.safeParse(data);
			return parsed.success
				? { event: STREAM_EVENT.Articles, data: parsed.data }
				: null;
		}
		default:
			return null;
	}
}
