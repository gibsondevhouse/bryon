import type { PageServerLoad } from './$types';
import { PlanService, TaskService } from '$lib/server/features/plans/plan';

export const load: PageServerLoad = async () => {
	const plans = new PlanService().list({ includeArchived: false, limit: 200 });
	const tasks = new TaskService().list({ includeArchived: false, limit: 500 });
	return { plans, tasks };
};
