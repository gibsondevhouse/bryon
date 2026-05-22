import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody } from '$lib/server/http';
import { WorkspaceSyncService } from '$lib/server/features/workspace-sync/workspace';

const syncSchema = z.object({
	description: z.string().trim().min(1).optional(),
});

export const POST: RequestHandler = async ({ request }) => {
	const parsed = await parseJsonBody(request, syncSchema);
	if (!parsed.ok) return parsed.response;
	try {
		const checkpoint = new WorkspaceSyncService().sync(parsed.data.description);
		return json({ checkpoint });
	} catch (error) {
		return apiError(
			500,
			'SYNC_FAILED',
			'Workspace sync could not be completed.',
			error instanceof Error ? error.message : String(error),
		);
	}
};
