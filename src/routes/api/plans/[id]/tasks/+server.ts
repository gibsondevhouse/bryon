import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody } from '$lib/server/http';
import { PlanService } from '$lib/server/features/plans/plan';
import { TaskService } from '$lib/server/features/plans/task';

export const GET: RequestHandler = async ({ params }) => {
	if (!new PlanService().get(params.id)) {
		return apiError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
	}
	return json({ tasks: new TaskService().list(params.id) });
};

const createTaskSchema = z.object({
	body: z.string().trim().min(1),
});

export const POST: RequestHandler = async ({ params, request }) => {
	if (!new PlanService().get(params.id)) {
		return apiError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
	}
	const parsed = await parseJsonBody(request, createTaskSchema);
	if (!parsed.ok) return parsed.response;
	const task = new TaskService().create(params.id, parsed.data.body);
	return json({ task }, { status: 201 });
};
