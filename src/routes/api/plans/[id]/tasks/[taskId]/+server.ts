import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody } from '$lib/server/http';
import { TaskService } from '$lib/server/features/plans/task';

const updateTaskSchema = z.object({
	body: z.string().trim().min(1).optional(),
	done: z.boolean().optional(),
});

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, updateTaskSchema);
	if (!parsed.ok) return parsed.response;
	const task = new TaskService().update(params.taskId, parsed.data);
	if (!task) return apiError(404, 'TASK_NOT_FOUND', 'Task not found.');
	return json({ task });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const deleted = new TaskService().delete(params.taskId);
	if (!deleted) return apiError(404, 'TASK_NOT_FOUND', 'Task not found.');
	return new Response(null, { status: 204 });
};
