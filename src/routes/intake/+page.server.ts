import type { PageServerLoad } from './$types';
import { IntakeScanService } from '$lib/server/features/intake/intake';

export const load: PageServerLoad = async () => {
	const svc = new IntakeScanService();
	const scans = svc.list({ includeCompleted: true, limit: 20 });
	return { scans };
};
