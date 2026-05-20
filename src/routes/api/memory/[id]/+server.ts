import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody } from '$lib/server/http';
import { MemoryEntryService } from '$lib/server/features/projects/project';

const memoryEntryPatchSchema = z.object({
	kind: z.enum(['remember', 'never_suggest']).optional(),
	body: z.string().trim().min(1).optional(),
	enabled: z.boolean().optional(),
	archived: z.boolean().optional(),
});

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, memoryEntryPatchSchema);
	if (!parsed.ok) return parsed.response;
	const input = {
		...parsed.data,
		archivedAt:
			parsed.data.archived === undefined
				? undefined
				: parsed.data.archived
					? Date.now()
					: null,
	};
	const entry = new MemoryEntryService().update(params.id, input);
	if (!entry) return apiError(404, 'MEMORY_NOT_FOUND', 'Memory entry not found.');
	return json({ entry });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const entry = new MemoryEntryService().archive(params.id);
	if (!entry) return apiError(404, 'MEMORY_NOT_FOUND', 'Memory entry not found.');
	return json({ entry });
};
