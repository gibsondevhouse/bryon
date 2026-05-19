import { describe, expect, it } from 'vitest';
import { createSseParser } from './sse-parser';
import { STREAM_EVENT } from '$lib/shared/stream-events';

describe('sse-parser', () => {
	it('parses a complete event from one chunk', () => {
		const parser = createSseParser();
		const events = parser.feed(
			'event: token\ndata: {"delta":"Hi"}\n\n',
		);
		expect(events).toEqual([
			{ event: STREAM_EVENT.Token, data: { delta: 'Hi' } },
		]);
	});

	it('reassembles an event split across chunks at the event/data boundary', () => {
		const parser = createSseParser();
		const a = parser.feed('event: token\n');
		const b = parser.feed('data: {"delta":"Hello"}\n\n');
		expect(a).toEqual([]);
		expect(b).toEqual([
			{ event: STREAM_EVENT.Token, data: { delta: 'Hello' } },
		]);
	});

	it('reassembles an event split mid-line', () => {
		const parser = createSseParser();
		const a = parser.feed('event: tok');
		const b = parser.feed('en\ndata: {"delta":"X"}\n\n');
		expect(a).toEqual([]);
		expect(b).toEqual([
			{ event: STREAM_EVENT.Token, data: { delta: 'X' } },
		]);
	});

	it('reassembles a data payload split across chunks', () => {
		const parser = createSseParser();
		const a = parser.feed('event: meta\ndata: {"msToFirst":');
		const b = parser.feed('100,"tokensIn":50}\n\n');
		expect(a).toEqual([]);
		expect(b).toEqual([
			{
				event: STREAM_EVENT.Meta,
				data: { msToFirst: 100, tokensIn: 50 },
			},
		]);
	});

	it('parses multiple events in one chunk', () => {
		const parser = createSseParser();
		const events = parser.feed(
			'event: token\ndata: {"delta":"a"}\n\nevent: token\ndata: {"delta":"b"}\n\n',
		);
		expect(events).toEqual([
			{ event: STREAM_EVENT.Token, data: { delta: 'a' } },
			{ event: STREAM_EVENT.Token, data: { delta: 'b' } },
		]);
	});

	it('drops malformed JSON payloads and calls onMalformed', () => {
		const malformed: string[] = [];
		const parser = createSseParser({
			onMalformed: (event, raw) => malformed.push(`${event}:${raw}`),
		});
		const events = parser.feed('event: token\ndata: {not json}\n\n');
		expect(events).toEqual([]);
		expect(malformed).toEqual(['token:{not json}']);
	});

	it('drops payloads that fail schema validation', () => {
		const malformed: string[] = [];
		const parser = createSseParser({
			onMalformed: (event) => malformed.push(event),
		});
		const events = parser.feed('event: token\ndata: {"delta":42}\n\n');
		expect(events).toEqual([]);
		expect(malformed).toEqual(['token']);
	});

	it('drops unknown event names', () => {
		const parser = createSseParser();
		const events = parser.feed('event: ping\ndata: {}\n\n');
		expect(events).toEqual([]);
	});

	it('flush returns events from a buffered final line without trailing newline', () => {
		const parser = createSseParser();
		const a = parser.feed('event: token\ndata: {"delta":"end"}');
		expect(a).toEqual([]);
		const b = parser.flush();
		expect(b).toEqual([
			{ event: STREAM_EVENT.Token, data: { delta: 'end' } },
		]);
	});
});
