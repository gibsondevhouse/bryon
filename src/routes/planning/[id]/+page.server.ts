import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PlanService } from '$lib/server/features/plans/plan';
import { TaskService } from '$lib/server/features/plans/task';

export const load: PageServerLoad = async ({ params }) => {
	const plan = new PlanService().get(params.id);
	if (!plan) error(404, 'Plan not found');
	const tasks = new TaskService().list(params.id);
	return { plan, tasks };
};
