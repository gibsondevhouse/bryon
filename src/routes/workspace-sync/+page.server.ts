import type { PageServerLoad } from './$types';
import { WorkspaceSyncService } from '$lib/server/features/workspace-sync/workspace';

export const load: PageServerLoad = async () => {
	const service = new WorkspaceSyncService();
	return {
		workspaceRoot: service.getWorkspaceRoot(),
		bryonRoot: service.getBryonRoot(),
		checkpoints: service.listCheckpoints(20),
		findings: service.listFindings(100),
		changedFiles: service.listChangedFiles(),
		routingLogs: service.listRoutingLogs(50),
	};
};
