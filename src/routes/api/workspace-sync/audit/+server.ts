import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/http';
import { WorkspaceSyncService } from '$lib/server/features/workspace-sync/workspace';

export const GET: RequestHandler = async () => {
	const service = new WorkspaceSyncService();
	return json({
		findings: service.listFindings(),
		changedFiles: service.listChangedFiles(),
	});
};

export const POST: RequestHandler = async () => {
	try {
		const service = new WorkspaceSyncService();
		return json({
			findings: service.audit(),
			changedFiles: service.listChangedFiles(),
		});
	} catch (error) {
		return apiError(
			500,
			'AUDIT_FAILED',
			'Workspace audit could not be completed.',
			error instanceof Error ? error.message : String(error),
		);
	}
};
