import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initializeDb } from '$lib/server/db/client';
import { PlanCardService, PlanService, TaskService } from '$lib/server/features/plans/plan';
import { ProjectService } from '$lib/server/features/projects/project';
import { WorkspaceSyncService } from '$lib/server/features/workspace-sync/workspace';

let tempDir = '';
let previousConfig: string | undefined;
let previousWorkspace: string | undefined;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'bryon-workspace-sync-'));
	previousConfig = process.env.BRYON_CONFIG;
	previousWorkspace = process.env.BRYON_WORKSPACE_DIR;
	process.env.BRYON_CONFIG = join(tempDir, 'missing-config.toml');
	process.env.BRYON_WORKSPACE_DIR = join(tempDir, 'workspace');
	const db = initializeDb(join(tempDir, 'bryon.db'));
	migrate(db, { migrationsFolder: join(process.cwd(), 'src/lib/server/db/migrations') });
});

afterEach(() => {
	closeDb();
	if (previousConfig === undefined) delete process.env.BRYON_CONFIG;
	else process.env.BRYON_CONFIG = previousConfig;
	if (previousWorkspace === undefined) delete process.env.BRYON_WORKSPACE_DIR;
	else process.env.BRYON_WORKSPACE_DIR = previousWorkspace;
	rmSync(tempDir, { recursive: true, force: true });
});

describe('WorkspaceSyncService', () => {
	it('writes expected workspace files atomically and reports current sync status', () => {
		const plan = new PlanService(getDb()).create({ name: 'Workspace Plan', status: 'active' });
		new PlanCardService(getDb()).create({
			planId: plan.id,
			series: '100',
			title: 'Purpose',
			body: 'Keep files synchronized.',
		});
		const project = new ProjectService(getDb()).create({
			planId: plan.id,
			name: 'Sync Project',
			status: 'in_progress',
		});
		new TaskService(getDb()).create({
			planId: plan.id,
			projectId: project.id,
			title: 'Write files',
			status: 'planned',
		});

		const sync = new WorkspaceSyncService(getDb());
		expect(sync.listChangedFiles().some((file) => file.status === 'missing')).toBe(true);
		const checkpoint = sync.sync('Test sync');
		expect(checkpoint.path).toContain('.bryon/checkpoints');
		expect(sync.listChangedFiles().every((file) => file.status === 'current')).toBe(true);
	});
});
