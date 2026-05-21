import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ProjectService, MemoryEntryService } from '$lib/server/features/projects/project';
import { ChatService } from '$lib/server/features/chat/chat';
import { PlanService } from '$lib/server/features/plans/plan';

export const load: PageServerLoad = async ({ params }) => {
	const svc = new ProjectService();
	const project = svc.get(params.id);
	if (!project) error(404, 'Project not found');

	const chats = new ChatService().list({ projectId: params.id, limit: 200 });
	const files = svc.listFiles(params.id);
	const memory = new MemoryEntryService().list({ scope: 'project', projectId: params.id });
	const allPlans = new PlanService().list({ limit: 100 });
	const plans = allPlans.filter((p) => p.projectId === params.id);

	return { project, chats, files, memory, plans };
};
