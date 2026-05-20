import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateMock = vi.fn();
const gotoMock = vi.fn();
vi.mock('$app/navigation', () => ({
	invalidate: (key: string) => invalidateMock(key),
	goto: (path: string) => gotoMock(path),
}));

import { Session, MESSAGES_INVALIDATION_KEY } from './session.svelte';
import { STREAM_ERROR_CODE } from '$lib/shared/stream-events';

function sseFrame(event: string, data: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function makeBody(frames: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	let i = 0;
	return new ReadableStream<Uint8Array>({
		pull(controller) {
			if (i >= frames.length) {
				controller.close();
				return;
			}
			controller.enqueue(encoder.encode(frames[i]));
			i++;
		},
	});
}

function mockOkStream(frames: string[]): void {
	vi.spyOn(globalThis, 'fetch').mockResolvedValue(
		new Response(makeBody(frames), {
			status: 200,
			headers: { 'content-type': 'text/event-stream' },
		}),
	);
}

beforeEach(() => {
	invalidateMock.mockReset();
	gotoMock.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('Session.send — happy path', () => {
	it('consumes tokens, meta, done; appends assistant message and clears streaming', async () => {
		const session = new Session();
		session.hydrate({ currentChatId: 'c1' });

		mockOkStream([
			sseFrame('token', { delta: 'Hel' }),
			sseFrame('token', { delta: 'lo' }),
			sseFrame('meta', { assistantId: 'asst-1', msToFirst: 12, tokensIn: 5 }),
			sseFrame('done', { id: 'asst-1', tokensOut: 2, msTotal: 100 }),
		]);

		// refreshChatList is fire-and-forget on done; make it harmless
		vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
			vi.fn(async () =>
				new Response(makeBody([
					sseFrame('token', { delta: 'Hel' }),
					sseFrame('token', { delta: 'lo' }),
					sseFrame('meta', { assistantId: 'asst-1', msToFirst: 12, tokensIn: 5 }),
					sseFrame('done', { id: 'asst-1', tokensOut: 2, msTotal: 100 }),
				]), {
					status: 200,
					headers: { 'content-type': 'text/event-stream' },
				}),
			),
		);
		// Subsequent fetch (refreshChatList) returns []
		vi.mocked(globalThis.fetch).mockResolvedValue(
			new Response('[]', { status: 200 }),
		);

		await session.send('c1', 'hi');
		// allow batcher flush microtasks to settle
		await new Promise((r) => setTimeout(r, 30));

		expect(session.streaming).toBe(false);
		const last = session.messages.at(-1);
		expect(last?.role).toBe('assistant');
		expect(last?.id).toBe('asst-1');
		expect(last?.content).toBe('Hello');
		expect(session.metrics?.ttft).toBe(12);
		expect(session.metrics?.tokensOut).toBe(2);
	});
});

describe('Session.send — error frame', () => {
	it('surfaces an error event as an assistant error row and no real assistant message', async () => {
		const session = new Session();
		session.hydrate({ currentChatId: 'c2' });

		mockOkStream([
			sseFrame('error', {
				code: STREAM_ERROR_CODE.ModelNotFound,
				model: 'ghost:1b',
				message: 'Model not found.',
			}),
		]);

		await session.send('c2', 'hi');
		await new Promise((r) => setTimeout(r, 10));

		expect(session.streaming).toBe(false);
		const last = session.messages.at(-1);
		expect(last?.role).toBe('assistant');
		expect(last?.id).toMatch(/^error-/);
		expect(last?.content).toContain('Model not found.');
		expect(last?.content).toContain('ollama pull ghost:1b');
	});
});

describe('Session.send — non-OK HTTP response', () => {
	it('treats !response.ok as a stream interruption error row', async () => {
		const session = new Session();
		session.hydrate({ currentChatId: 'c3' });

		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					error: { code: 'CHAT_NOT_FOUND', message: 'Chat is missing.' },
				}),
				{ status: 404 },
			),
		);

		await session.send('c3', 'hi');

		expect(session.streaming).toBe(false);
		const last = session.messages.at(-1);
		expect(last?.role).toBe('assistant');
		expect(last?.content).toContain('Chat is missing.');
	});
});

describe('Session.cancel', () => {
	it('aborts the in-flight fetch and triggers messages invalidation', async () => {
		const session = new Session();
		session.hydrate({ currentChatId: 'c4' });

		const abortError = Object.assign(new Error('aborted'), {
			name: 'AbortError',
		});
		vi.spyOn(globalThis, 'fetch').mockImplementation(
			(_input, init) =>
				new Promise((_resolve, reject) => {
					const signal = (init as RequestInit | undefined)?.signal;
					signal?.addEventListener('abort', () => reject(abortError));
				}),
		);

		const sendPromise = session.send('c4', 'hi');
		// allow fetch to start
		await new Promise((r) => setTimeout(r, 5));
		session.cancel();
		await sendPromise;

		expect(session.streaming).toBe(false);
		expect(invalidateMock).toHaveBeenCalledWith(MESSAGES_INVALIDATION_KEY);
	});
});

describe('Session.send — refuses concurrent invocation', () => {
	it('returns early when already streaming', async () => {
		const session = new Session();
		session.streaming = true;
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await session.send('c5', 'hi');
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('ignores empty content', async () => {
		const session = new Session();
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await session.send('c6', '   ');
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
