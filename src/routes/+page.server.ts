import type { PageServerLoad } from './$types';
import { TaskService } from '$lib/server/features/plans/plan';

export const load: PageServerLoad = async () => {
	const tasks = new TaskService().list({ includeArchived: false, limit: 500 });
	return { tasks };
};
