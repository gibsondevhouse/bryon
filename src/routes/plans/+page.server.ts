import type { PageServerLoad } from './$types';
import { PlanService } from '$lib/server/features/plans/plan';

export const load: PageServerLoad = async () => {
	const service = new PlanService();
	const plans = service.list({ includeArchived: false, limit: 200 });
	return { plans };
};
