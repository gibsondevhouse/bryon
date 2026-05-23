import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initializeDb } from '$lib/server/db/client';
import { intakeScans } from '$lib/server/db/schema';
import { IntakeService } from '$lib/server/features/intake/intake';
import { PlanCardService, PlanService } from '$lib/server/features/plans/plan';
import { POST } from './+server';

let tempDir = '';
let folderDir = '';

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'bryon-propose-plan-'));
	folderDir = join(tempDir, 'scan-folder');
	mkdirSync(folderDir, { recursive: true });

	const db = initializeDb(join(tempDir, 'bryon.db'));
	migrate(db, {
		migrationsFolder: join(process.cwd(), 'src/lib/server/db/migrations'),
	});
});

afterEach(() => {
	closeDb();
	rmSync(tempDir, { recursive: true, force: true });
});

describe('POST /api/intake/scans/[id]/propose-plan', () => {
	it('creates a plan with mission need fields and initial cards', async () => {
		writeFileSync(join(folderDir, 'notes.txt'), 'planning notes');
		const scan = new IntakeService(getDb()).scanFolder(folderDir);

		const response = await POST(
			buildEvent(scan.id, {
				name: 'Operation Redwood',
				missionNeed: {
					capabilityGap: 'Need shared task visibility',
					operationalContext: 'Distributed team with ad-hoc workflows',
				},
				initialCards: [
					{
						series: '100',
						title: 'Purpose',
						body: 'Unify planning and execution visibility',
					},
					{
						series: '300',
						title: 'End state',
						body: 'All projects map to one doctrine plan',
					},
				],
			}),
		);

		expect(response.status).toBe(201);
		const payload = (await response.json()) as {
			plan: { id: string; name: string };
		};
		expect(payload.plan.name).toBe('Operation Redwood');

		const plan = new PlanService(getDb()).get(payload.plan.id);
		expect(plan?.doctrine.missionNeed.gap).toBe('Need shared task visibility');
		expect(plan?.doctrine.missionNeed.context).toBe(
			'Distributed team with ad-hoc workflows',
		);
		expect(plan?.doctrine.missionNeed.source).toBe('folder_intake');

		const cards = new PlanCardService(getDb()).list({
			planId: payload.plan.id,
		});
		expect(cards).toHaveLength(2);
		expect(cards.map((card) => card.series)).toEqual(['100', '300']);
	});

	it('returns 404 when the scan does not exist', async () => {
		const response = await POST(
			buildEvent('missing-scan', {
				name: 'Operation Missing',
				missionNeed: {
					capabilityGap: 'Gap',
					operationalContext: 'Context',
				},
				initialCards: [],
			}),
		);

		expect(response.status).toBe(404);
		const payload = (await response.json()) as {
			error: { code: string; message: string };
		};
		expect(payload.error.code).toBe('SCAN_NOT_FOUND');
	});

	it('returns 409 when the plan name already exists', async () => {
		writeFileSync(join(folderDir, 'scope.md'), 'scope');
		const scan = new IntakeService(getDb()).scanFolder(folderDir);
		new PlanService(getDb()).create({ name: 'Operation Existing' });

		const response = await POST(
			buildEvent(scan.id, {
				name: 'Operation Existing',
				missionNeed: {
					capabilityGap: 'Gap',
					operationalContext: 'Context',
				},
				initialCards: [],
			}),
		);

		expect(response.status).toBe(409);
		const payload = (await response.json()) as {
			error: { code: string; message: string };
		};
		expect(payload.error.code).toBe('PLAN_NAME_CONFLICT');

		const matches = new PlanService(getDb())
			.list({ includeArchived: true, limit: 200 })
			.filter((plan) => plan.name === 'Operation Existing');
		expect(matches).toHaveLength(1);
	});

	it('creates a plan when only a partial initial card list is provided', async () => {
		writeFileSync(join(folderDir, 'overview.txt'), 'overview');
		const scan = new IntakeService(getDb()).scanFolder(folderDir);

		const response = await POST(
			buildEvent(scan.id, {
				name: 'Operation Partial',
				missionNeed: {
					capabilityGap: 'Need consistent intake',
					operationalContext: 'Small operations team',
				},
				initialCards: [
					{
						series: '100',
						title: 'Purpose',
					},
				],
			}),
		);

		expect(response.status).toBe(201);
		const payload = (await response.json()) as { plan: { id: string } };
		const cards = new PlanCardService(getDb()).list({
			planId: payload.plan.id,
		});
		expect(cards).toHaveLength(1);
		expect(cards[0]?.series).toBe('100');
	});

	it('returns 422 when the scan is not completed', async () => {
		const now = Date.now();
		const scanId = randomUUID();
		getDb()
			.insert(intakeScans)
			.values({
				id: scanId,
				folderPath: folderDir,
				status: 'running',
				phase: 'enumerating',
				filesFound: 0,
				filesClassified: 0,
				createdAt: now,
				updatedAt: now,
			})
			.run();

		const response = await POST(
			buildEvent(scanId, {
				name: 'Operation Pending',
				missionNeed: {
					capabilityGap: 'Gap',
					operationalContext: 'Context',
				},
				initialCards: [],
			}),
		);

		expect(response.status).toBe(422);
		const payload = (await response.json()) as {
			error: { code: string; message: string };
		};
		expect(payload.error.code).toBe('SCAN_NOT_COMPLETE');
	});
});

function buildEvent(scanId: string, body: unknown): Parameters<typeof POST>[0] {
	return {
		params: { id: scanId },
		request: new Request(
			`http://localhost/api/intake/scans/${scanId}/propose-plan`,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body),
			},
		),
	} as Parameters<typeof POST>[0];
}
