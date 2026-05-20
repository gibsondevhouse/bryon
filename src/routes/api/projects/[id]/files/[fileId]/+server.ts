import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/http';
import { ProjectService } from '$lib/server/features/projects/project';

export const DELETE: RequestHandler = async ({ params }) => {
	const file = new ProjectService().archiveFile(params.id, params.fileId);
	if (!file) return apiError(404, 'PROJECT_FILE_NOT_FOUND', 'Project file not found.');
	return json({ file });
};
