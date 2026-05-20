import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseBooleanParam, parseJsonBody } from '$lib/server/http';
import { MemoryEntryService } from '$lib/server/features/projects/project';

const memoryEntryCreateSchema = z.object({
	scope: z.enum(['global', 'project']),
	projectId: z.string().min(1).nullable().optional(),
	kind: z.enum(['remember', 'never_suggest']),
	body: z.string().trim().min(1),
	enabled: z.boolean().optional(),
});

export const GET: RequestHandler = async ({ url }) => {
	const scopeParam = url.searchParams.get('scope');
	const scope = scopeParam === 'global' || scopeParam === 'project' ? scopeParam : undefined;
	const rawProjectId = url.searchParams.get('projectId');
	const projectId =
		rawProjectId === null ? undefined : rawProjectId === 'global' ? null : rawProjectId;
	const entries = new MemoryEntryService().list({
		scope,
		projectId,
		includeArchived:
			parseBooleanParam(url.searchParams.get('includeArchived')) ?? false,
	});
	return json({ entries });
};

export const POST: RequestHandler = async ({ request }) => {
	const parsed = await parseJsonBody(request, memoryEntryCreateSchema);
	if (!parsed.ok) return parsed.response;
	try {
		const entry = new MemoryEntryService().create(parsed.data);
		return json({ entry }, { status: 201 });
	} catch (error) {
		return apiError(
			500,
			'MEMORY_CREATE_FAILED',
			'Memory entry could not be created.',
			error instanceof Error ? error.message : String(error),
		);
	}
};
