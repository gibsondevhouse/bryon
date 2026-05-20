import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import {
	apiError,
	parseBooleanParam,
	parseJsonBody,
	parsePositiveIntegerParam,
} from '$lib/server/http';
import { ProjectService } from '$lib/server/features/projects/project';

const createProjectSchema = z.object({
	name: z.string().trim().min(1),
	description: z.string().trim().nullable().optional(),
	promptOverride: z.string().nullable().optional(),
});

export const GET: RequestHandler = async ({ url }) => {
	const service = new ProjectService();
	const projects = service.list({
		includeArchived:
			parseBooleanParam(url.searchParams.get('includeArchived')) ?? false,
		limit: parsePositiveIntegerParam(url.searchParams.get('limit'), 50, 200),
		offset: Math.max(
			0,
			Number.parseInt(url.searchParams.get('offset') ?? '0', 10) || 0,
		),
	});
	return json({ projects });
};

export const POST: RequestHandler = async ({ request }) => {
	const parsed = await parseJsonBody(request, createProjectSchema);
	if (!parsed.ok) return parsed.response;

	try {
		const project = new ProjectService().create(parsed.data);
		return json({ project }, { status: 201 });
	} catch (error) {
		return apiError(
			500,
			'PROJECT_CREATE_FAILED',
			'Project could not be created.',
			error instanceof Error ? error.message : String(error),
		);
	}
};
