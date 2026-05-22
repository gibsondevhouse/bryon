import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody } from '$lib/server/http';
import {
	PlanLifecycleTransitionError,
	PlanService,
} from '$lib/server/features/plans/plan';
import { doctrineLifecycleSchema, planStatusSchema } from '$lib/shared/schemas';

const updatePlanSchema = z.object({
	name: z.string().trim().min(1).optional(),
	summary: z.string().trim().nullable().optional(),
	planType: z.string().trim().nullable().optional(),
	startDate: z.string().nullable().optional(),
	status: planStatusSchema.optional(),
	doctrineLifecycle: doctrineLifecycleSchema.optional(),
	archived: z.boolean().optional(),
	projectId: z.string().nullable().optional(),
});

export const GET: RequestHandler = async ({ params }) => {
	const plan = new PlanService().get(params.id);
	if (!plan) return apiError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
	return json({ plan });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, updatePlanSchema);
	if (!parsed.ok) return parsed.response;

	try {
		const plan = new PlanService().update(params.id, parsed.data);
		if (!plan) return apiError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
		return json({ plan });
	} catch (error) {
		if (error instanceof PlanLifecycleTransitionError) {
			return apiError(422, error.code, error.message, error.details);
		}
		return apiError(
			500,
			'PLAN_UPDATE_FAILED',
			'Plan could not be updated.',
			error instanceof Error ? error.message : String(error),
		);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const plan = new PlanService().archive(params.id);
		if (!plan) return apiError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
		return json({ plan });
	} catch (error) {
		if (error instanceof PlanLifecycleTransitionError) {
			return apiError(422, error.code, error.message, error.details);
		}
		return apiError(
			500,
			'PLAN_ARCHIVE_FAILED',
			'Plan could not be archived.',
			error instanceof Error ? error.message : String(error),
		);
	}
};
