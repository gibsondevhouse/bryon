import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import {
	apiError,
	parseBooleanParam,
	parseJsonBody,
	parsePositiveIntegerParam,
} from '$lib/server/http';
import { ChatService } from '$lib/server/features/chat/chat';
import { loadConfig } from '$lib/server/config';
import { llmParamsSchema } from '$lib/shared/schemas';
import type { Chat } from '$lib/shared/types';

const createChatSchema = z.object({
	id: z.string().min(1).optional(),
	title: z.string().trim().min(1).optional(),
	model: z.string().trim().min(1).optional(),
	params: llmParamsSchema.partial().nullable().optional(),
});

export const GET: RequestHandler = async ({ url }) => {
	const service = new ChatService();
	const { config } = loadConfig();
	const archived = parseBooleanParam(url.searchParams.get('archived'));
	const includeArchived =
		parseBooleanParam(url.searchParams.get('includeArchived')) ?? false;

	const chats = service.list({
		archived,
		includeArchived,
		limit: parsePositiveIntegerParam(url.searchParams.get('limit'), 50, 200),
		offset: Math.max(
			0,
			Number.parseInt(url.searchParams.get('offset') ?? '0', 10) || 0,
		),
	});

	return json({ chats: chats.map((chat) => withResolvedModel(chat, config.llm.model)) });
};

export const POST: RequestHandler = async ({ request }) => {
	const parsed = await parseJsonBody(request, createChatSchema);
	if (!parsed.ok) return parsed.response;

	try {
		const service = new ChatService();
		const { config } = loadConfig();
		const chat = service.create(parsed.data);
		return json({ chat: withResolvedModel(chat, config.llm.model) }, { status: 201 });
	} catch (error) {
		return apiError(
			500,
			'CHAT_CREATE_FAILED',
			'Chat could not be created.',
			error instanceof Error ? error.message : String(error),
		);
	}
};

function withResolvedModel(chat: Chat, defaultModel: string): Chat {
	return {
		...chat,
		resolvedModel: chat.model ?? defaultModel,
		modelSource: chat.model ? 'chat_pin' : 'global_default',
	};
}
