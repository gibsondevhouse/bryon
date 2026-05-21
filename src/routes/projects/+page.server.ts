import type { PageServerLoad } from './$types';
import { ProjectService } from '$lib/server/features/projects/project';
import { ChatService } from '$lib/server/features/chat/chat';

export const load: PageServerLoad = async () => {
	const svc = new ProjectService();
	const chatSvc = new ChatService();
	const projects = svc.list({ limit: 100 });

	// Attach per-project chat counts
	const chatCounts = new Map<string, number>();
	for (const project of projects) {
		const count = chatSvc.list({ projectId: project.id, limit: 200 }).length;
		chatCounts.set(project.id, count);
	}

	return { projects, chatCounts: Object.fromEntries(chatCounts) };
};
