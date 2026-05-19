import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ChatService } from '$lib/server/features/chat/chat';

export const load: PageServerLoad = async ({ params }) => {
	const chatService = new ChatService();
	const chat = chatService.get(params.id);

	if (!chat) {
		error(404, 'Chat not found');
	}

	const messages = chatService.listMessages(params.id, { limit: 200 });

	return {
		chat,
		messages,
	};
};
