import { describe, expect, it } from 'vitest';
import type { Chat } from '$lib/shared/types';
import {
	resolveModelForChat,
	resolveModelWithSource,
	withResolvedModel,
	withResolvedModels,
} from './model-resolution';

const makeChat = (overrides: Partial<Chat> = {}): Chat => ({
	id: 'c1',
	title: 'Chat',
	model: null,
	resolvedModel: null,
	modelSource: null,
	personaId: 'persona_default',
	createdAt: 1,
	updatedAt: 1,
	archived: false,
	projectId: null,
	params: null,
	...overrides,
});

describe('chat model resolution', () => {
	it('prefers a chat pin over the global model', () => {
		expect(resolveModelForChat('llama3.2:3b', 'gemma3:4b')).toBe('llama3.2:3b');
		expect(resolveModelWithSource('llama3.2:3b', 'gemma3:4b')).toEqual({
			model: 'llama3.2:3b',
			source: 'chat_pin',
		});
	});

	it('falls back to the configured chat model', () => {
		expect(resolveModelWithSource(null, 'gemma3:4b')).toEqual({
			model: 'gemma3:4b',
			source: 'global_default',
		});
	});

	it('enriches one or many chat payloads', () => {
		const one = withResolvedModel(makeChat(), 'gemma3:4b');
		expect(one.resolvedModel).toBe('gemma3:4b');
		expect(one.modelSource).toBe('global_default');

		const many = withResolvedModels(
			[makeChat({ id: 'a' }), makeChat({ id: 'b', model: 'mistral:7b' })],
			'gemma3:4b',
		);
		expect(many.map((chat) => chat.resolvedModel)).toEqual(['gemma3:4b', 'mistral:7b']);
	});
});
