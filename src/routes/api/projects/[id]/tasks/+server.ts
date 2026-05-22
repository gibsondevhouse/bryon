import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseBooleanParam, parseJsonBody } from '$lib/server/http';
import { TaskService } from '$lib/server/features/plans/plan';
import { ProjectService } from '$lib/server/features/projects/project';

const createTaskSchema = z.object({
	title: z.string().trim().min(1),
	description: z.string().trim().nullable().optional(),
	status: z.enum(['proposed', 'planned', 'in_progress', 'blocked', 'completed', 'archived']).optional(),
	assignee: z.string().trim().nullable().optional(),
	dueDate: z.string().nullable().optional(),
	sortOrder: z.number().int().nonnegative().optional(),
});

export const GET: RequestHandler = async ({ params, url }) => {
	const project = new ProjectService().get(params.id);
	if (!project) return apiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
	if (!project.planId) {
		return json({ tasks: [] });
	}
	const tasks = new TaskService().list({
		planId: project.planId,
		projectId: params.id,
		includeArchived:
			parseBooleanParam(url.searchParams.get('includeArchived')) ?? false,
	});
	return json({ tasks });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const project = new ProjectService().get(params.id);
	if (!project) return apiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
	if (!project.planId) {
		return apiError(
			400,
			'PROJECT_HAS_NO_PLAN',
			'Tasks require the project to belong to a plan.',
		);
	}

	const parsed = await parseJsonBody(request, createTaskSchema);
	if (!parsed.ok) return parsed.response;

	const task = new TaskService().create({
		planId: project.planId,
		projectId: params.id,
		...parsed.data,
	});
	return json({ task }, { status: 201 });
};
