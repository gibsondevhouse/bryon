import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, parsePositiveIntegerParam } from '$lib/server/http';
import { ChatService } from '$lib/server/features/chat/chat';

export const GET: RequestHandler = async ({ params, url }) => {
	const service = new ChatService();
	const chat = service.get(params.id);
	if (!chat) return apiError(404, 'CHAT_NOT_FOUND', 'Chat not found.');

	const before = url.searchParams.get('before');
	const beforeCreatedAt =
		before === null ? undefined : Number.parseInt(before, 10);

	const messages = service.listMessages(params.id, {
		beforeCreatedAt: Number.isFinite(beforeCreatedAt)
			? beforeCreatedAt
			: undefined,
		limit: parsePositiveIntegerParam(url.searchParams.get('limit'), 100, 500),
	});

	return json({ messages });
};
