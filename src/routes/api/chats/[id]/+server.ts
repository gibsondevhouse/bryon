import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody } from '$lib/server/http';
import { ChatService } from '$lib/server/features/chat/chat';
import { loadConfig } from '$lib/server/config';
import { llmParamsSchema } from '$lib/shared/schemas';
import type { Chat } from '$lib/shared/types';

const updateChatSchema = z.object({
	title: z.string().trim().min(1).optional(),
	model: z.string().trim().min(1).nullable().optional(),
	archived: z.boolean().optional(),
	params: llmParamsSchema.partial().nullable().optional(),
});

export const GET: RequestHandler = async ({ params }) => {
	const service = new ChatService();
	const { config } = loadConfig();
	const chat = service.get(params.id);
	if (!chat) return apiError(404, 'CHAT_NOT_FOUND', 'Chat not found.');

	return json({ chat: withResolvedModel(chat, config.llm.model) });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, updateChatSchema);
	if (!parsed.ok) return parsed.response;

	try {
		const service = new ChatService();
		const { config } = loadConfig();
		const chat = service.update(params.id, parsed.data);
		if (!chat) return apiError(404, 'CHAT_NOT_FOUND', 'Chat not found.');

		return json({ chat: withResolvedModel(chat, config.llm.model) });
	} catch (error) {
		return apiError(
			500,
			'CHAT_UPDATE_FAILED',
			'Chat could not be updated.',
			error instanceof Error ? error.message : String(error),
		);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const service = new ChatService();
	const deleted = service.delete(params.id);
	if (!deleted) return apiError(404, 'CHAT_NOT_FOUND', 'Chat not found.');

	return new Response(null, { status: 204 });
};

function withResolvedModel(chat: Chat, defaultModel: string): Chat {
	return {
		...chat,
		resolvedModel: chat.model ?? defaultModel,
		modelSource: chat.model ? 'chat_pin' : 'global_default',
	};
}
