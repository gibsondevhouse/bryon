import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody, parsePositiveIntegerParam } from '$lib/server/http';
import { WorkspaceSyncService } from '$lib/server/features/workspace-sync/workspace';

const checkpointSchema = z.object({
	description: z.string().trim().min(1),
});

export const GET: RequestHandler = async ({ url }) => {
	const service = new WorkspaceSyncService();
	return json({
		checkpoints: service.listCheckpoints(
			parsePositiveIntegerParam(url.searchParams.get('limit'), 25, 100),
		),
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const parsed = await parseJsonBody(request, checkpointSchema);
	if (!parsed.ok) return parsed.response;
	try {
		const checkpoint = new WorkspaceSyncService().checkpoint(parsed.data.description);
		return json({ checkpoint }, { status: 201 });
	} catch (error) {
		return apiError(
			500,
			'CHECKPOINT_FAILED',
			'Workspace checkpoint could not be created.',
			error instanceof Error ? error.message : String(error),
		);
	}
};
