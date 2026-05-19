import type { Chat } from '$lib/shared/types';

export type ModelSource = 'chat_pin' | 'global_default' | 'llm_fallback';

export function resolveModelWithSource(
	chatModel: string | null | undefined,
	configLlmModel: string | null | undefined,
): { model: string; source: ModelSource } {
	if (chatModel !== null && chatModel !== undefined) {
		return { model: chatModel, source: 'chat_pin' };
	}
	if (configLlmModel !== null && configLlmModel !== undefined) {
		return { model: configLlmModel, source: 'global_default' };
	}
	return { model: 'unknown', source: 'llm_fallback' };
}

export function resolveModelForChat(
	chatModel: string | null | undefined,
	configLlmModel: string | null | undefined,
): string {
	return resolveModelWithSource(chatModel, configLlmModel).model;
}

export function withResolvedModel(
	chat: Chat,
	configLlmModel: string,
): Chat {
	const resolved = resolveModelWithSource(chat.model, configLlmModel);
	return {
		...chat,
		resolvedModel: resolved.model,
		modelSource: resolved.source,
	};
}

export function withResolvedModels(
	chats: Chat[],
	configLlmModel: string,
): Chat[] {
	return chats.map((chat) => withResolvedModel(chat, configLlmModel));
}
