import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat, Message, Settings } from '$lib/shared/types';
import { helpText } from '$lib/shared/commands';

const gotoMock = vi.fn();
vi.mock('$app/navigation', () => ({
	goto: (path: string) => gotoMock(path),
}));

import { handleSlashCommand, type SlashCommandContext } from './commands';

function makeChat(overrides: Partial<Chat> = {}): Chat {
	return {
		id: 'chat-1',
		title: 'Test chat',
		model: 'gemma3:4b',
		personaId: 'p-1',
		params: {},
		archived: 0,
		updatedAt: 1,
		createdAt: 1,
		...overrides,
	} as Chat;
}

function makeMessage(overrides: Partial<Message> = {}): Message {
	return {
		id: 'm-1',
		chatId: 'chat-1',
		role: 'user',
		content: 'hello',
		tokensIn: 0,
		tokensOut: 0,
		msToFirst: null,
		msTotal: null,
		summarized: 0,
		createdAt: 1,
		...overrides,
	} as Message;
}

function makeCtx(overrides: Partial<SlashCommandContext> = {}): SlashCommandContext {
	const settings: Settings = {
		llm: { model: 'default-model' },
	} as unknown as Settings;
	return {
		chats: [makeChat()],
		currentChatId: 'chat-1',
		messages: [],
		settings,
		setChats: vi.fn(),
		createChat: vi.fn(async () => 'new-chat-id'),
		refreshChatList: vi.fn(async () => {}),
		...overrides,
	};
}

beforeEach(() => {
	gotoMock.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('handleSlashCommand', () => {
	it('returns not-handled for plain text', async () => {
		const res = await handleSlashCommand(makeCtx(), 'hello world');
		expect(res).toEqual({ handled: false });
	});

	it('reports unknown commands', async () => {
		const res = await handleSlashCommand(makeCtx(), '/nope');
		expect(res.handled).toBe(true);
		expect(res.error).toMatch(/Unknown command/);
	});

	it('returns help text for /help', async () => {
		const res = await handleSlashCommand(makeCtx(), '/help');
		expect(res).toEqual({ handled: true, info: helpText });
	});

	it('/model without args returns current model from chat', async () => {
		const ctx = makeCtx({ chats: [makeChat({ model: 'foo:latest' })] });
		const res = await handleSlashCommand(ctx, '/model');
		expect(res.info).toContain('foo:latest');
	});

	it('/model with arg PATCHes the chat and refreshes list', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('{}', { status: 200 }));
		const ctx = makeCtx();
		const res = await handleSlashCommand(ctx, '/model qwen3:8b');
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/chats/chat-1',
			expect.objectContaining({ method: 'PATCH' }),
		);
		expect(ctx.refreshChatList).toHaveBeenCalled();
		expect(res.info).toContain('qwen3:8b');
	});

	it('/model reports HTTP error message', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ error: { message: 'nope' } }), {
				status: 400,
			}),
		);
		const res = await handleSlashCommand(makeCtx(), '/model bad');
		expect(res.error).toBe('nope');
	});

	it('/new triggers createChat then navigates', async () => {
		const ctx = makeCtx();
		const res = await handleSlashCommand(ctx, '/new');
		expect(res).toEqual({ handled: true });
		// allow the fire-and-forget chain to settle
		await Promise.resolve();
		await Promise.resolve();
		expect(ctx.createChat).toHaveBeenCalled();
		expect(gotoMock).toHaveBeenCalledWith('/chats/new-chat-id');
	});

	it('/export builds a markdown blob and clicks an anchor', async () => {
		const createObjectURL = vi.fn(() => 'blob:fake');
		const revokeObjectURL = vi.fn();
		const click = vi.fn();
		const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement;
		vi.stubGlobal('URL', {
			...globalThis.URL,
			createObjectURL,
			revokeObjectURL,
		});
		vi.stubGlobal('document', {
			createElement: vi.fn(() => anchor),
		});
		vi.stubGlobal('Blob', class FakeBlob {});

		const ctx = makeCtx({
			messages: [makeMessage({ role: 'user', content: 'hi' })],
		});
		const res = await handleSlashCommand(ctx, '/export');
		expect(res).toEqual({ handled: true });
		expect(createObjectURL).toHaveBeenCalled();
		expect(click).toHaveBeenCalled();
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
		expect(anchor.download).toMatch(/^bryon-/);
		vi.unstubAllGlobals();
	});
});
