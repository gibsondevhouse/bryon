import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { ProjectExpansionService } from '$lib/server/features/projects/expansion';
import { apiError, parseJsonBody } from '$lib/server/http';

const expandSchema = z.object({
	localOnly: z.boolean().optional(),
	preferRemote: z.boolean().optional(),
	highestQuality: z.boolean().optional(),
	remoteApproved: z.boolean().optional(),
});

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, expandSchema);
	if (!parsed.ok) return parsed.response;

	const result = await new ProjectExpansionService().expandProject({
		projectId: params.id,
		...parsed.data,
	});
	if (!result) {
		return apiError(
			400,
			'PROJECT_EXPANSION_UNAVAILABLE',
			'Project expansion requires an existing project linked to a plan.',
		);
	}
	return json({ result });
};
