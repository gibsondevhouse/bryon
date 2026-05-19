import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadConfig } from '$lib/server/config';
import { apiError } from '$lib/server/http';
import { OllamaAdapter } from '$lib/server/llm/ollama';
import { ChatService } from '$lib/server/features/chat/chat';
import { TitleService } from '$lib/server/features/chat/title';
import { resolveModelForChat } from '$lib/server/features/streaming/pipeline';

export const POST: RequestHandler = async ({ params }) => {
	const chatService = new ChatService();
	const chat = chatService.get(params.id);
	if (!chat) return apiError(404, 'CHAT_NOT_FOUND', 'Chat not found.');

	const allMessages = chatService.listMessages(params.id, { limit: 500 });
	if (!allMessages.some((m) => m.role === 'user')) return json({ chat });

	const { config } = loadConfig();
	const model = resolveModelForChat(chat.model, config.llm.model);
	const llmParams = {
		...config.llm.params,
		...chat.params,
	};

	const adapter = new OllamaAdapter({
		baseUrl: config.llm.base_url,
		defaultParams: config.llm.params,
	});
	const titleService = new TitleService({
		adapter,
		chatService,
		model,
		params: llmParams,
	});
	const title = await titleService.generateAndPersist({
		chatId: params.id,
		messages: allMessages,
		model,
		params: llmParams,
	});

	return json({ chat: chatService.get(params.id), title });
};
