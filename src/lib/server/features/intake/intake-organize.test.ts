import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initializeDb } from '$lib/server/db/client';
import { IntakeService } from '$lib/server/features/intake/intake';

let tempDir = '';
let previousConfig: string | undefined;
let previousWorkspace: string | undefined;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'bryon-intake-organize-'));
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

describe('IntakeService (organize)', () => {
	it('classifies reviewed intake files and organizes them into plans, projects, tasks, and a checkpoint', () => {
		const inbox = join(tempDir, 'inbox');
		mkdirSync(inbox, { recursive: true });
		writeFileSync(join(inbox, 'tax-receipt.pdf'), 'receipt', 'utf8');

		const intake = new IntakeService(getDb());
		const scan = intake.scanFolder(inbox);
		const files = intake.listFiles(scan.id);
		expect(scan.status).toBe('completed');
		expect(files[0].sensitive).toBe(true);

		const reviewed = intake.updateFileReview({
			scanId: scan.id,
			fileId: files[0].id,
			reviewState: 'included',
			proposedPlanName: 'Admin Plan',
			proposedProjectName: 'Receipts',
		});
		expect(reviewed?.reviewState).toBe('included');

		const result = intake.organizeScan({ scanId: scan.id, mode: 'copy' });
		expect(result?.fileCount).toBe(1);
		expect(result?.createdPlans[0].name).toBe('Admin Plan');
		expect(result?.createdProjects[0].name).toBe('Receipts');
		expect(result?.createdTasks[0].title).toContain('tax-receipt.pdf');
		expect(result?.checkpointPath).toContain('.bryon');
	});

	it('starts folder intake scans as resumable background jobs with progress', async () => {
		const inbox = join(tempDir, 'async-inbox');
		mkdirSync(inbox, { recursive: true });
		writeFileSync(join(inbox, 'course-assignment.md'), '# Assignment', 'utf8');

		const intake = new IntakeService(getDb());
		const scan = intake.startScan(inbox);
		expect(['queued', 'running', 'completed']).toContain(scan.status);

		const completed = await waitForScanCompletion(intake, scan.id);
		expect(completed.status).toBe('completed');
		expect(completed.progress.phase).toBe('completed');
		expect(completed.progress.scanned).toBeGreaterThan(0);
		expect(intake.listFiles(scan.id)[0].category).toBe('educational');
	});
});

async function waitForScanCompletion(intake: IntakeService, scanId: string) {
	for (let attempt = 0; attempt < 50; attempt += 1) {
		const scan = intake.getScan(scanId);
		if (!scan) throw new Error('Intake scan was not found.');
		if (scan.status === 'completed') return scan;
		if (scan.status === 'failed') throw new Error(scan.errorMessage ?? 'Intake scan failed.');
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	throw new Error('Intake scan did not complete before timeout.');
}
