import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import {
	apiError,
	parseBooleanParam,
	parseJsonBody,
	parsePositiveIntegerParam,
} from '$lib/server/http';
import { PlanService } from '$lib/server/features/plans/plan';

const createPlanSchema = z.object({
	name: z.string().trim().min(1),
	summary: z.string().trim().nullable().optional(),
	planType: z.string().trim().nullable().optional(),
	startDate: z.string().nullable().optional(),
});

export const GET: RequestHandler = async ({ url }) => {
	const service = new PlanService();
	const plans = service.list({
		includeArchived:
			parseBooleanParam(url.searchParams.get('includeArchived')) ?? false,
		limit: parsePositiveIntegerParam(url.searchParams.get('limit'), 100, 200),
		offset: Math.max(
			0,
			Number.parseInt(url.searchParams.get('offset') ?? '0', 10) || 0,
		),
	});
	return json({ plans });
};

export const POST: RequestHandler = async ({ request }) => {
	const parsed = await parseJsonBody(request, createPlanSchema);
	if (!parsed.ok) return parsed.response;

	try {
		const plan = new PlanService().create(parsed.data);
		return json({ plan }, { status: 201 });
	} catch (error) {
		return apiError(
			500,
			'PLAN_CREATE_FAILED',
			'Plan could not be created.',
			error instanceof Error ? error.message : String(error),
		);
	}
};
