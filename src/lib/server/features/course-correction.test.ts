import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { desc } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initializeDb } from '$lib/server/db/client';
import { routingLogs } from '$lib/server/db/schema';
import type { LLMAdapter, LLMStreamEvent } from '$lib/server/llm/adapter';
import { IntakeService } from '$lib/server/features/intake/intake';
import { PlanCardService, PlanService, TaskService } from '$lib/server/features/plans/plan';
import { ProjectExpansionService } from '$lib/server/features/projects/expansion';
import { ProjectService } from '$lib/server/features/projects/project';
import { WorkspaceSyncService } from '$lib/server/features/workspace-sync/workspace';

let tempDir = '';
let previousConfig: string | undefined;
let previousWorkspace: string | undefined;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'bryon-course-correction-'));
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

describe('course-correction foundations', () => {
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

	it('expands project work using inherited plan context and records a routing log', async () => {
		const plan = new PlanService(getDb()).create({ name: 'Launch Plan', status: 'drafting' });
		new PlanCardService(getDb()).create({
			planId: plan.id,
			series: '900',
			title: 'Ship launch checklist',
			body: 'Prepare, ship, and review.',
			contextWeight: 'always',
			locked: true,
		});
		const project = new ProjectService(getDb()).create({
			planId: plan.id,
			name: 'Launch Site',
			status: 'planned',
		});

		const result = await new ProjectExpansionService(getDb(), { adapter: null }).expandProject({
			projectId: project.id,
			localOnly: true,
		});

		expect(result?.routing.remote).toBe(false);
		expect(result?.tasks.map((task) => task.title)).toContain('Ship launch checklist');
		const log = getDb().select().from(routingLogs).orderBy(desc(routingLogs.createdAt)).get();
		expect(log?.taskType).toBe('project_expansion');
		expect(log?.remote).toBe(0);
	});

	it('uses model JSON for project expansion when an adapter returns valid tasks', async () => {
		const plan = new PlanService(getDb()).create({ name: 'Model Plan', status: 'drafting' });
		const project = new ProjectService(getDb()).create({
			planId: plan.id,
			name: 'Model Project',
			status: 'planned',
		});
		const adapter = new FakeAdapter(JSON.stringify({
			tasks: [
				{
					title: 'Draft model-backed scope',
					description: 'Use generated context to define the project scope.',
					status: 'planned',
				},
			],
		}));

		const result = await new ProjectExpansionService(getDb(), { adapter }).expandProject({
			projectId: project.id,
			localOnly: true,
		});

		expect(result?.generatedBy).toBe('model');
		expect(result?.generationError).toBeNull();
		expect(result?.tasks[0].title).toBe('Draft model-backed scope');
	});

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

class FakeAdapter implements LLMAdapter {
	constructor(private readonly text: string) {}

	async ping(): Promise<boolean> {
		return true;
	}

	async stream(): Promise<ReadableStream<LLMStreamEvent>> {
		const text = this.text;
		return new ReadableStream<LLMStreamEvent>({
			start(controller) {
				controller.enqueue({ type: 'token', delta: text });
				controller.enqueue({ type: 'done', tokensIn: 10, tokensOut: 10 });
				controller.close();
			},
		});
	}
}

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
