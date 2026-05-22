import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { IntakeService } from '$lib/server/features/intake/intake';
import { apiError, parseJsonBody } from '$lib/server/http';

const organizeSchema = z.object({
	mode: z.enum(['copy', 'move']).default('copy'),
	checkpointDescription: z.string().trim().min(1).optional(),
});

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, organizeSchema);
	if (!parsed.ok) return parsed.response;

	try {
		const result = new IntakeService().organizeScan({
			scanId: params.id,
			mode: parsed.data.mode,
			checkpointDescription: parsed.data.checkpointDescription,
		});
		if (!result) return apiError(404, 'INTAKE_SCAN_NOT_FOUND', 'Intake scan not found.');
		return json({ result });
	} catch (error) {
		return apiError(
			500,
			'INTAKE_ORGANIZE_FAILED',
			'Reviewed intake files could not be organized.',
			error instanceof Error ? error.message : String(error),
		);
	}
};
