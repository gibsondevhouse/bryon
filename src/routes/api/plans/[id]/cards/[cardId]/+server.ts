import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody } from '$lib/server/http';
import { PlanCardService } from '$lib/server/features/plans/plan';
import { updatePlanCardSchema } from '$lib/shared/schemas';

export const GET: RequestHandler = async ({ params }) => {
	const card = new PlanCardService().get(params.cardId);
	if (!card || card.planId !== params.id) {
		return apiError(404, 'PLAN_CARD_NOT_FOUND', 'Plan card not found.');
	}
	return json({ card });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, updatePlanCardSchema);
	if (!parsed.ok) return parsed.response;

	const service = new PlanCardService();
	const existing = service.get(params.cardId);
	if (!existing || existing.planId !== params.id) {
		return apiError(404, 'PLAN_CARD_NOT_FOUND', 'Plan card not found.');
	}

	const card = service.update(params.cardId, parsed.data);
	if (!card)
		return apiError(404, 'PLAN_CARD_NOT_FOUND', 'Plan card not found.');
	return json({ card });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const service = new PlanCardService();
	const existing = service.get(params.cardId);
	if (!existing || existing.planId !== params.id) {
		return apiError(404, 'PLAN_CARD_NOT_FOUND', 'Plan card not found.');
	}
	const references = service.referencesTo(params.cardId);
	if (references.length > 0) {
		return apiError(
			409,
			'PLAN_CARD_HAS_REFERENCES',
			'Plan card has downstream references.',
			{ references },
		);
	}
	const card = service.archive(params.cardId);
	return json({ card });
};
