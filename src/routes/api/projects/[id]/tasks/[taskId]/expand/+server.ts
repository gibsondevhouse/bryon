import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { ProjectExpansionService } from '$lib/server/features/projects/expansion';
import { apiError, parseJsonBody } from '$lib/server/http';

const expandTaskSchema = z.object({
	localOnly: z.boolean().optional(),
	preferRemote: z.boolean().optional(),
	highestQuality: z.boolean().optional(),
	remoteApproved: z.boolean().optional(),
});

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, expandTaskSchema);
	if (!parsed.ok) return parsed.response;

	const result = await new ProjectExpansionService().expandTask({
		projectId: params.id,
		taskId: params.taskId,
		...parsed.data,
	});
	if (!result) return apiError(404, 'TASK_NOT_FOUND', 'Project task not found.');
	return json({ result });
};
