import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, parseBooleanParam, parseJsonBody } from '$lib/server/http';
import { getLogger } from '$lib/server/logger';
import { PlanCardService, PlanService } from '$lib/server/features/plans/plan';
import {
	createPlanCardSchema,
	planCardSeriesSchema,
} from '$lib/shared/schemas';

export const GET: RequestHandler = async ({ params, url }) => {
	const plan = new PlanService().get(params.id);
	if (!plan) return apiError(404, 'PLAN_NOT_FOUND', 'Plan not found.');

	const series = planCardSeriesSchema.safeParse(url.searchParams.get('series'));
	const cards = new PlanCardService().list({
		planId: params.id,
		series: series.success ? series.data : undefined,
		includeArchived:
			parseBooleanParam(url.searchParams.get('includeArchived')) ?? false,
	});
	return json({ cards });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const plan = new PlanService().get(params.id);
	if (!plan) return apiError(404, 'PLAN_NOT_FOUND', 'Plan not found.');

	const parsed = await parseJsonBody(request, createPlanCardSchema);
	if (!parsed.ok) return parsed.response;

	try {
		const card = new PlanCardService().create({
			planId: params.id,
			...parsed.data,
		});
		return json({ card }, { status: 201 });
	} catch (error) {
		getLogger().error({ error, planId: params.id }, 'plans.card.create_failed');
		return apiError(
			500,
			'PLAN_CARD_CREATE_FAILED',
			'Plan card could not be created.',
		);
	}
};
