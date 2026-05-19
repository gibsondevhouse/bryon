import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ChatService } from '$lib/server/features/chat/chat';

export const load: PageServerLoad = async () => {
	const chatService = new ChatService();
	const chats = chatService.list({ limit: 1 });

	if (chats.length > 0) {
		redirect(302, `/chats/${chats[0].id}`);
	}

	// No chats yet — render the homepage hero (uses layout data)
	return {};
};
