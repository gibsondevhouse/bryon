import { describe, expect, it } from 'vitest';
import {
	chatSchema,
	llmParamsSchema,
	messageRoleSchema,
	messageSchema,
	personaSchema,
	settingsSchema,
	streamRequestSchema,
} from './schemas';

describe('messageRoleSchema', () => {
	it('accepts all valid roles', () => {
		expect(messageRoleSchema.parse('system')).toBe('system');
		expect(messageRoleSchema.parse('user')).toBe('user');
		expect(messageRoleSchema.parse('assistant')).toBe('assistant');
		expect(messageRoleSchema.parse('tool_call')).toBe('tool_call');
		expect(messageRoleSchema.parse('tool_result')).toBe('tool_result');
	});

	it('rejects unknown roles', () => {
		expect(() => messageRoleSchema.parse('tool')).toThrow();
	});
});

describe('llmParamsSchema', () => {
	it('fills all defaults when given an empty object', () => {
		const parsed = llmParamsSchema.parse({});
		expect(parsed.temperature).toBe(0.6);
		expect(parsed.top_p).toBe(0.9);
		expect(parsed.top_k).toBe(40);
		expect(parsed.repeat_penalty).toBe(1.1);
		expect(parsed.num_ctx).toBe(8192);
		expect(parsed.num_predict).toBe(1024);
		expect(parsed.keep_alive).toBe('10m');
	});

	it('rejects out-of-range temperature', () => {
		expect(() => llmParamsSchema.parse({ temperature: -0.1 })).toThrow();
		expect(() => llmParamsSchema.parse({ temperature: 2.5 })).toThrow();
	});

	it('rejects non-integer top_k', () => {
		expect(() => llmParamsSchema.parse({ top_k: 12.5 })).toThrow();
	});

	it('rejects non-positive num_ctx', () => {
		expect(() => llmParamsSchema.parse({ num_ctx: 0 })).toThrow();
	});
});

describe('settingsSchema', () => {
	it('produces a fully-defaulted settings object from {}', () => {
		const parsed = settingsSchema.parse({});
		expect(parsed.app.host).toBe('127.0.0.1');
		expect(parsed.app.port).toBe(5174);
		expect(parsed.llm.backend).toBe('ollama');
		expect(parsed.llm.model).toBe('gemma3:4b');
		expect(parsed.llm.params.temperature).toBe(0.6);
	});

	it('rejects llm.backend other than "ollama"', () => {
		expect(() =>
			settingsSchema.parse({ llm: { backend: 'openai' } }),
		).toThrow();
	});
});

describe('chatSchema', () => {
	const base = {
		id: 'c1',
		title: 'Hello',
		model: 'gemma3:4b',
		personaId: 'p1',
		createdAt: 1,
		updatedAt: 2,
	};

	it('parses a minimal valid chat with defaults applied', () => {
		const parsed = chatSchema.parse(base);
		expect(parsed.archived).toBe(false);
		expect(parsed.params).toBeNull();
	});

	it('rejects empty id', () => {
		expect(() => chatSchema.parse({ ...base, id: '' })).toThrow();
	});
});

describe('messageSchema', () => {
	it('parses a minimal user message', () => {
		const parsed = messageSchema.parse({
			id: 'm1',
			chatId: 'c1',
			role: 'user',
			content: 'hi',
			createdAt: 1,
		});
		expect(parsed.tokensIn).toBeNull();
		expect(parsed.summarized).toBe(false);
	});

	it('rejects negative createdAt', () => {
		expect(() =>
			messageSchema.parse({
				id: 'm1',
				chatId: 'c1',
				role: 'user',
				content: 'hi',
				createdAt: -1,
			}),
		).toThrow();
	});
});

describe('personaSchema', () => {
	it('rejects empty systemPrompt', () => {
		expect(() =>
			personaSchema.parse({
				id: 'p1',
				name: 'Default',
				systemPrompt: '',
				createdAt: 1,
				updatedAt: 1,
			}),
		).toThrow();
	});

	it('defaults tool list + defaultModel when omitted', () => {
		const parsed = personaSchema.parse({
			id: 'p1',
			name: 'Default',
			systemPrompt: 'Prompt',
			createdAt: 1,
			updatedAt: 1,
		});
		expect(parsed.defaultModel).toBeNull();
		expect(parsed.tools).toEqual([]);
	});
});

describe('streamRequestSchema', () => {
	it('rejects empty/whitespace content', () => {
		expect(() => streamRequestSchema.parse({ content: '' })).toThrow();
		expect(() => streamRequestSchema.parse({ content: '   ' })).toThrow();
	});

	it('trims content', () => {
		const parsed = streamRequestSchema.parse({ content: '  hi  ' });
		expect(parsed.content).toBe('hi');
	});

	it('accepts an optional paramsOverride partial', () => {
		const parsed = streamRequestSchema.parse({
			content: 'hello',
			paramsOverride: { temperature: 1.2 },
		});
		expect(parsed.paramsOverride?.temperature).toBe(1.2);
	});
});
