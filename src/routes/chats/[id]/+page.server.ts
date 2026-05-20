import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ChatService } from '$lib/server/features/chat/chat';
import { ProjectService } from '$lib/server/features/projects/project';

export const load: PageServerLoad = async ({ params }) => {
	const chatService = new ChatService();
	const chat = chatService.get(params.id);

	if (!chat) {
		error(404, 'Chat not found');
	}

	const messages = chatService.listMessages(params.id, { limit: 200 });
	const projectService = new ProjectService();
	const project = chat.projectId ? projectService.get(chat.projectId) : null;
	const projectFiles = project ? projectService.listFiles(project.id) : [];

	return {
		chat,
		messages,
		project,
		projectFiles,
	};
};
