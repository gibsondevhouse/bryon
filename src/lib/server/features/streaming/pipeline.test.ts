import { describe, expect, it, vi } from 'vitest';
import { loadStreamContext, resolveModelForChat, buildSystemPrompt } from './pipeline';
import type { ChatService } from '$lib/server/features/chat/chat';
import type { PersonaService } from '$lib/server/features/personas/persona';

vi.mock('$lib/server/config', () => ({
	loadConfig: () => ({
		config: {
			llm: {
				model: 'gemma3:4b',
				vision_model: 'gemma4:e4b',
				params: { temperature: 0.6 },
			},
		},
	}),
}));

describe('streaming pipeline', () => {
	it('resolves chat model pins before the global default', () => {
		expect(resolveModelForChat('llama3.2:3b', 'gemma3:4b')).toBe('llama3.2:3b');
		expect(resolveModelForChat(null, 'gemma3:4b')).toBe('gemma3:4b');
	});

	it('uses the vision model when image attachments are present', () => {
		const chatService = { get: vi.fn(() => ({ id: 'c1', personaId: 'p1', model: null, params: null })) } as unknown as ChatService;
		const personaService = {
			get: vi.fn(() => ({ id: 'p1', systemPrompt: 'You are Bryon.' })),
			getFirst: vi.fn(),
		} as unknown as PersonaService;

		const result = loadStreamContext(chatService, personaService, 'c1', true);
		expect('response' in result).toBe(false);
		if (!('response' in result)) {
			expect(result.model).toBe('gemma4:e4b');
		}
	});

	it('injects manual memory and web context into the system prompt', () => {
		const prompt = buildSystemPrompt({
			basePrompt: 'Base prompt.',
			memory: {
				enabled: true,
				remember: 'User prefers concise answers.',
				never_suggest: 'Do not suggest cloud sync.',
			},
			webContext: 'Result: example.com',
		});

		expect(prompt).toContain('Base prompt.');
		expect(prompt).toContain('User-managed memory');
		expect(prompt).toContain('User prefers concise answers.');
		expect(prompt).toContain('Do not suggest cloud sync.');
		expect(prompt).toContain('Web search context');
	});
});
