import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody } from '$lib/server/http';
import { IntakeService } from '$lib/server/features/intake/intake';

const updateFileSchema = z.object({
	reviewState: z.enum(['pending', 'included', 'excluded']).optional(),
	localOnly: z.boolean().optional(),
	category: z.string().trim().min(1).optional(),
	proposedPlanName: z.string().trim().nullable().optional(),
	proposedProjectName: z.string().trim().nullable().optional(),
});

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, updateFileSchema);
	if (!parsed.ok) return parsed.response;

	const file = new IntakeService().updateFileReview({
		scanId: params.id,
		fileId: params.fileId,
		...parsed.data,
	});
	if (!file) return apiError(404, 'INTAKE_FILE_NOT_FOUND', 'Intake file not found.');
	return json({ file });
};
