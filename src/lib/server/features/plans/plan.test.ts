import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initializeDb } from '$lib/server/db/client';
import {
	canTransitionDoctrineLifecycle,
	PlanCardService,
	PlanLifecycleTransitionError,
	PlanService,
} from './plan';

let tempDir = '';

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'bryon-plans-'));
	const db = initializeDb(join(tempDir, 'bryon.db'));
	migrate(db, {
		migrationsFolder: join(process.cwd(), 'src/lib/server/db/migrations'),
	});
});

afterEach(() => {
	closeDb();
	rmSync(tempDir, { recursive: true, force: true });
});

describe('doctrine lifecycle transitions', () => {
	it('allows only the canonical forward transitions', () => {
		expect(canTransitionDoctrineLifecycle('proposed', 'drafting')).toBe(true);
		expect(canTransitionDoctrineLifecycle('drafting', 'active')).toBe(true);
		expect(canTransitionDoctrineLifecycle('active', 'archived')).toBe(true);
		expect(canTransitionDoctrineLifecycle('active', 'active')).toBe(true);

		expect(canTransitionDoctrineLifecycle('proposed', 'active')).toBe(false);
		expect(canTransitionDoctrineLifecycle('drafting', 'archived')).toBe(false);
		expect(canTransitionDoctrineLifecycle('archived', 'active')).toBe(false);
	});

	it('rejects invalid service transitions with a typed error', () => {
		const service = new PlanService(getDb());
		const plan = service.create({ name: 'Lifecycle Test' });

		expect(() =>
			service.update(plan.id, { doctrineLifecycle: 'active' }),
		).toThrow(PlanLifecycleTransitionError);
	});
});

describe('PlanService lifecycle persistence', () => {
	it('persists create and update lifecycle values through plan responses', () => {
		const service = new PlanService(getDb());
		const plan = service.create({
			name: 'Round Trip',
			status: 'drafting',
		});

		expect(plan.doctrineLifecycle).toBe('drafting');
		expect(plan.doctrine.lifecycle).toBe('drafting');
		expect(plan.status).toBe('drafting');

		const active = service.update(plan.id, { doctrineLifecycle: 'active' });
		expect(active?.doctrineLifecycle).toBe('active');
		expect(active?.doctrine.lifecycle).toBe('active');
		expect(active?.status).toBe('active');

		const fetched = service.get(plan.id);
		expect(fetched?.doctrineLifecycle).toBe('active');
	});

	it('archives only through the lifecycle transition contract', () => {
		const service = new PlanService(getDb());
		const plan = service.create({
			name: 'Archive Test',
			doctrineLifecycle: 'active',
		});

		const archived = service.archive(plan.id);
		expect(archived?.doctrineLifecycle).toBe('archived');
		expect(archived?.archivedAt).toEqual(expect.any(Number));
	});
});

describe('PlanCardService', () => {
	it('creates a card with all fields', () => {
		const plan = new PlanService(getDb()).create({ name: 'Card Plan' });
		const service = new PlanCardService(getDb());

		const card = service.create({
			planId: plan.id,
			series: '300',
			title: '  End state  ',
			body: '  Define what success looks like  ',
			sortOrder: 7,
			locked: true,
			contextWeight: 'always',
		});

		expect(card.planId).toBe(plan.id);
		expect(card.series).toBe('300');
		expect(card.title).toBe('End state');
		expect(card.body).toBe('Define what success looks like');
		expect(card.sortOrder).toBe(7);
		expect(card.locked).toBe(true);
		expect(card.contextWeight).toBe('always');
		expect(card.archivedAt).toBeNull();
	});

	it('lists cards by series and archived filter', () => {
		const plan = new PlanService(getDb()).create({ name: 'Filter Plan' });
		const service = new PlanCardService(getDb());
		const first100 = service.create({
			planId: plan.id,
			series: '100',
			title: 'Purpose',
		});
		service.create({
			planId: plan.id,
			series: '300',
			title: 'End state',
		});
		service.archive(first100.id);

		const active100 = service.list({ planId: plan.id, series: '100' });
		expect(active100).toHaveLength(0);

		const all100 = service.list({
			planId: plan.id,
			series: '100',
			includeArchived: true,
		});
		expect(all100).toHaveLength(1);
		expect(all100[0]?.id).toBe(first100.id);
	});

	it('updates supported fields and preserves sort order across cards', () => {
		const plan = new PlanService(getDb()).create({ name: 'Update Plan' });
		const service = new PlanCardService(getDb());
		const cardA = service.create({
			planId: plan.id,
			series: '200',
			title: 'Card A',
			sortOrder: 1,
			contextWeight: 'conditional',
		});
		const cardB = service.create({
			planId: plan.id,
			series: '200',
			title: 'Card B',
			sortOrder: 2,
			contextWeight: 'never',
		});

		const updated = service.update(cardA.id, {
			series: '400',
			title: '  Scheme of maneuver  ',
			body: '  Main effort description  ',
			sortOrder: 5,
			locked: true,
			contextWeight: 'always',
		});

		expect(updated).not.toBeNull();
		expect(updated?.series).toBe('400');
		expect(updated?.title).toBe('Scheme of maneuver');
		expect(updated?.body).toBe('Main effort description');
		expect(updated?.sortOrder).toBe(5);
		expect(updated?.locked).toBe(true);
		expect(updated?.contextWeight).toBe('always');

		const stillSecond = service.get(cardB.id);
		expect(stillSecond?.sortOrder).toBe(2);
	});

	it('archives cards and supports all context weight values', () => {
		const plan = new PlanService(getDb()).create({ name: 'Context Plan' });
		const service = new PlanCardService(getDb());

		const alwaysCard = service.create({
			planId: plan.id,
			title: 'Always',
			contextWeight: 'always',
		});
		const conditionalCard = service.create({
			planId: plan.id,
			title: 'Conditional',
			contextWeight: 'conditional',
		});
		const neverCard = service.create({
			planId: plan.id,
			title: 'Never',
			contextWeight: 'never',
		});

		const archived = service.archive(conditionalCard.id);
		expect(archived?.archivedAt).toEqual(expect.any(Number));

		const active = service.list({ planId: plan.id });
		expect(active.map((card) => card.id)).toEqual([
			alwaysCard.id,
			neverCard.id,
		]);
		expect(active.map((card) => card.contextWeight)).toEqual([
			'always',
			'never',
		]);
	});
});
