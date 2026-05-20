import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody } from '$lib/server/http';
import { ProjectService } from '$lib/server/features/projects/project';

const updateProjectSchema = z.object({
	name: z.string().trim().min(1).optional(),
	description: z.string().trim().nullable().optional(),
	promptOverride: z.string().nullable().optional(),
	memoryEnabled: z.boolean().optional(),
	remember: z.string().optional(),
	neverSuggest: z.string().optional(),
	archived: z.boolean().optional(),
});

export const GET: RequestHandler = async ({ params }) => {
	const project = new ProjectService().get(params.id);
	if (!project) return apiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
	return json({ project });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, updateProjectSchema);
	if (!parsed.ok) return parsed.response;

	try {
		const project = new ProjectService().update(params.id, parsed.data);
		if (!project) return apiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
		return json({ project });
	} catch (error) {
		return apiError(
			500,
			'PROJECT_UPDATE_FAILED',
			'Project could not be updated.',
			error instanceof Error ? error.message : String(error),
		);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const project = new ProjectService().archive(params.id);
	if (!project) return apiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
	return json({ project });
};
