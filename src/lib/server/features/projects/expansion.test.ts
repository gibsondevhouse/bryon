import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { desc } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initializeDb } from '$lib/server/db/client';
import { routingLogs } from '$lib/server/db/schema';
import type { LLMAdapter, LLMStreamEvent } from '$lib/server/llm/adapter';
import { PlanCardService, PlanService } from '$lib/server/features/plans/plan';
import { ProjectExpansionService } from '$lib/server/features/projects/expansion';
import { ProjectService } from '$lib/server/features/projects/project';

let tempDir = '';
let previousConfig: string | undefined;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'bryon-expansion-'));
	previousConfig = process.env.BRYON_CONFIG;
	process.env.BRYON_CONFIG = join(tempDir, 'missing-config.toml');
	const db = initializeDb(join(tempDir, 'bryon.db'));
	migrate(db, { migrationsFolder: join(process.cwd(), 'src/lib/server/db/migrations') });
});

afterEach(() => {
	closeDb();
	if (previousConfig === undefined) delete process.env.BRYON_CONFIG;
	else process.env.BRYON_CONFIG = previousConfig;
	rmSync(tempDir, { recursive: true, force: true });
});

describe('ProjectExpansionService', () => {
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
