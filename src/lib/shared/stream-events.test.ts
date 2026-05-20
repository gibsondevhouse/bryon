import { describe, expect, it } from 'vitest';
import {
	STREAM_EVENT,
	doneEventSchema,
	metaEventSchema,
	parseStreamEvent,
	streamErrorEventSchema,
	tokenEventSchema,
} from './stream-events';

describe('stream event schemas', () => {
	it('validates token/meta/done/error payloads', () => {
		expect(tokenEventSchema.parse({ delta: 'Hi' })).toEqual({ delta: 'Hi' });
		expect(
			metaEventSchema.parse({
				assistantId: 'a1',
				requestId: 'r1',
				msToFirst: 10,
				tokensIn: 20,
			}),
		).toEqual({
			assistantId: 'a1',
			requestId: 'r1',
			msToFirst: 10,
			tokensIn: 20,
		});
		expect(doneEventSchema.parse({ id: 'm1', tokensOut: 5, msTotal: 50 })).toEqual({
			id: 'm1',
			tokensOut: 5,
			msTotal: 50,
		});
		expect(streamErrorEventSchema.parse({ code: 'MODEL_NOT_FOUND', message: 'missing' })).toEqual({
			code: 'MODEL_NOT_FOUND',
			message: 'missing',
		});
	});

	it('parses known events and rejects bad payloads', () => {
		expect(parseStreamEvent(STREAM_EVENT.Token, { delta: 'Hi' })).toEqual({
			event: STREAM_EVENT.Token,
			data: { delta: 'Hi' },
		});
		expect(
			parseStreamEvent(STREAM_EVENT.Meta, {
				assistantId: 'a',
				requestId: 'r',
				msToFirst: 1,
				tokensIn: 2,
			})?.event,
		).toBe(STREAM_EVENT.Meta);
		expect(parseStreamEvent(STREAM_EVENT.Done, { id: 'x', tokensOut: 1, msTotal: 2 })?.event).toBe(STREAM_EVENT.Done);
		expect(parseStreamEvent(STREAM_EVENT.Error, { code: 'X', message: 'bad' })?.event).toBe(STREAM_EVENT.Error);
		expect(parseStreamEvent(STREAM_EVENT.Token, { delta: 42 })).toBeNull();
		expect(parseStreamEvent('tool_call', { callId: 'x' })).toBeNull();
	});
});
