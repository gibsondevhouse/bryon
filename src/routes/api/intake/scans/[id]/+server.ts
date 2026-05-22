import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/http';
import { IntakeScanService } from '$lib/server/features/intake/intake';

export const GET: RequestHandler = async ({ params }) => {
	const svc = new IntakeScanService();
	const scan = svc.get(params.id);
	if (!scan) return apiError(404, 'SCAN_NOT_FOUND', 'Scan not found.');
	return json({ scan });
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	const svc = new IntakeScanService();
	const scan = svc.get(params.id);
	if (!scan) return apiError(404, 'SCAN_NOT_FOUND', 'Scan not found.');

	const hardDelete = url.searchParams.get('delete') === 'true';

	if (hardDelete) {
		svc.remove(params.id);
		return new Response(null, { status: 204 });
	}

	// Default: cancel if active, then return the updated scan
	const updated = svc.cancel(params.id) ?? scan;
	return json({ scan: updated });
};
