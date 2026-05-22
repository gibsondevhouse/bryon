import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseBooleanParam, parseJsonBody } from '$lib/server/http';
import { IntakeScanService } from '$lib/server/features/intake/intake';

const createScanSchema = z.object({
	folderPath: z.string().trim().min(1, 'Folder path is required'),
});

export const GET: RequestHandler = async ({ url }) => {
	const svc = new IntakeScanService();
	const includeCompleted = parseBooleanParam(url.searchParams.get('includeCompleted')) ?? true;
	const scans = svc.list({ includeCompleted });
	return json({ scans });
};

export const POST: RequestHandler = async ({ request }) => {
	const parsed = await parseJsonBody(request, createScanSchema);
	if (!parsed.ok) return parsed.response;

	try {
		const scan = new IntakeScanService().create(parsed.data.folderPath);
		return json({ scan }, { status: 202 });
	} catch (err) {
		return apiError(
			500,
			'SCAN_CREATE_FAILED',
			'Could not start intake scan.',
			err instanceof Error ? err.message : String(err),
		);
	}
};
