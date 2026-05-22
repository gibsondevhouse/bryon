import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody } from '$lib/server/http';
import { PlanCardService } from '$lib/server/features/plans/plan';

const updateCardSchema = z.object({
	series: z.enum(['100', '200', '300', '400', '500', '600', '700', '800', '900', '1000']).optional(),
	title: z.string().trim().min(1).optional(),
	body: z.string().optional(),
	sortOrder: z.number().int().nonnegative().optional(),
	locked: z.boolean().optional(),
	contextWeight: z.enum(['always', 'conditional', 'never']).optional(),
	archived: z.boolean().optional(),
});

export const GET: RequestHandler = async ({ params }) => {
	const card = new PlanCardService().get(params.cardId);
	if (!card || card.planId !== params.id) {
		return apiError(404, 'PLAN_CARD_NOT_FOUND', 'Plan card not found.');
	}
	return json({ card });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, updateCardSchema);
	if (!parsed.ok) return parsed.response;

	const service = new PlanCardService();
	const existing = service.get(params.cardId);
	if (!existing || existing.planId !== params.id) {
		return apiError(404, 'PLAN_CARD_NOT_FOUND', 'Plan card not found.');
	}

	const card = service.update(params.cardId, parsed.data);
	if (!card) return apiError(404, 'PLAN_CARD_NOT_FOUND', 'Plan card not found.');
	return json({ card });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const service = new PlanCardService();
	const existing = service.get(params.cardId);
	if (!existing || existing.planId !== params.id) {
		return apiError(404, 'PLAN_CARD_NOT_FOUND', 'Plan card not found.');
	}
	const card = service.archive(params.cardId);
	return json({ card });
};
