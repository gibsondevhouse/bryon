import type { PageServerLoad } from './$types';
import { PlanService } from '$lib/server/features/plans/plan';

export const load: PageServerLoad = async () => {
	const plans = new PlanService().list({ includeArchived: true, limit: 200 });
	return { plans };
};
