import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, parsePositiveIntegerParam } from '$lib/server/http';
import { ProjectService } from '$lib/server/features/projects/project';

export const GET: RequestHandler = async ({ params, url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (!q) return json({ results: [] });
	const service = new ProjectService();
	const project = service.get(params.id);
	if (!project) return apiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
	return json({
		results: service.searchFiles(
			params.id,
			q,
			parsePositiveIntegerParam(url.searchParams.get('limit'), 10, 50),
		),
	});
};
