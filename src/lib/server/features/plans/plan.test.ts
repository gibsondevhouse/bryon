import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initializeDb } from '$lib/server/db/client';
import {
	canTransitionDoctrineLifecycle,
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
