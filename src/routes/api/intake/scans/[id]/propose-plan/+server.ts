import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db/client';
import { plans } from '$lib/server/db/schema';
import { IntakeService } from '$lib/server/features/intake/intake';
import { PlanCardService, PlanService } from '$lib/server/features/plans/plan';
import { apiError, parseJsonBody } from '$lib/server/http';
import { getLogger } from '$lib/server/logger';
import { proposePlanSchema } from '$lib/shared/schemas';

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, proposePlanSchema);
	if (!parsed.ok) return parsed.response;

	const intake = new IntakeService();
	const scan = intake.getScan(params.id);
	if (!scan) return apiError(404, 'SCAN_NOT_FOUND', 'Scan not found.');
	if (scan.status !== 'completed') {
		return apiError(
			422,
			'SCAN_NOT_COMPLETE',
			'Scan must be completed before creating a plan.',
		);
	}

	const db = getDb();
	const existingPlan = db
		.select({ id: plans.id })
		.from(plans)
		.where(eq(plans.name, parsed.data.name))
		.get();
	if (existingPlan) {
		return apiError(
			409,
			'PLAN_NAME_CONFLICT',
			'A plan with this name already exists.',
		);
	}

	try {
		const plan = db.transaction((tx) => {
			const planService = new PlanService(tx);
			const cardService = new PlanCardService(tx);
			const createdPlan = planService.create({ name: parsed.data.name });
			tx.update(plans)
				.set({
					missionNeedGap: parsed.data.missionNeed.capabilityGap,
					missionNeedContext: parsed.data.missionNeed.operationalContext,
					missionNeedSource: 'folder_intake',
					updatedAt: Date.now(),
				})
				.where(eq(plans.id, createdPlan.id))
				.run();

			for (const card of parsed.data.initialCards) {
				cardService.create({
					planId: createdPlan.id,
					series: card.series,
					title: card.title,
					body: card.body ?? null,
				});
			}

			const persistedPlan = planService.get(createdPlan.id);
			if (!persistedPlan) {
				throw new Error(`Plan "${createdPlan.id}" was not created.`);
			}
			return persistedPlan;
		});

		return json({ plan }, { status: 201 });
	} catch (error) {
		getLogger().error(
			{ error, scanId: params.id, planName: parsed.data.name },
			'intake.propose_plan.failed',
		);
		return apiError(500, 'PROPOSE_PLAN_FAILED', 'Plan could not be created.');
	}
};
