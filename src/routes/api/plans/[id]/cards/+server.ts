import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseBooleanParam, parseJsonBody } from '$lib/server/http';
import { PlanCardService, PlanService } from '$lib/server/features/plans/plan';

const seriesSchema = z.enum(['100', '200', '300', '400', '500', '600', '700', '800', '900', '1000']);
const contextWeightSchema = z.enum(['always', 'conditional', 'never']);

const createCardSchema = z.object({
	series: seriesSchema,
	title: z.string().trim().min(1),
	body: z.string().optional(),
	sortOrder: z.number().int().nonnegative().optional(),
	locked: z.boolean().optional(),
	contextWeight: contextWeightSchema.optional(),
});

export const GET: RequestHandler = async ({ params, url }) => {
	const plan = new PlanService().get(params.id);
	if (!plan) return apiError(404, 'PLAN_NOT_FOUND', 'Plan not found.');

	const series = seriesSchema.safeParse(url.searchParams.get('series'));
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

	const parsed = await parseJsonBody(request, createCardSchema);
	if (!parsed.ok) return parsed.response;

	try {
		const card = new PlanCardService().create({
			planId: params.id,
			...parsed.data,
		});
		return json({ card }, { status: 201 });
	} catch (error) {
		return apiError(
			500,
			'PLAN_CARD_CREATE_FAILED',
			'Plan card could not be created.',
			error instanceof Error ? error.message : String(error),
		);
	}
};
