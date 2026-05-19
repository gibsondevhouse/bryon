import type { LayoutServerLoad } from './$types';
import { loadConfig } from '$lib/server/config';
import { ChatService } from '$lib/server/features/chat/chat';
import type { Chat } from '$lib/shared/types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { config, configPath, parseError } = loadConfig();
	const chatService = new ChatService();
	const chats = chatService.list({ limit: 50 });

	return {
		chats: chats.map((chat) => withResolvedModel(chat, config.llm.model)),
		settings: config,
		configPath,
		configParseError: parseError?.message ?? locals.configParseError,
		ollamaReachable: locals.ollamaReachable,
	};
};

function withResolvedModel(chat: Chat, defaultModel: string): Chat {
	return {
		...chat,
		resolvedModel: chat.model ?? defaultModel,
		modelSource: chat.model ? 'chat_pin' : 'global_default',
	};
}
