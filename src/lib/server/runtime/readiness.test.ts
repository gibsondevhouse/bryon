import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
	auditMigrationDrift,
	ensureSchemaCompatibility,
} from './readiness';

function sha256(input: string): string {
	return createHash('sha256').update(input).digest('hex');
}

describe('ensureSchemaCompatibility', () => {
	it('applies additive rich-chat schema requirements and remains idempotent', () => {
		const db = new Database(':memory:');
		db.exec(`
			CREATE TABLE messages (
				id TEXT PRIMARY KEY,
				chat_id TEXT NOT NULL,
				role TEXT NOT NULL,
				content TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				summarized INTEGER NOT NULL DEFAULT 0
			);
			CREATE TABLE chats (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);
			CREATE TABLE personas (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				system_prompt TEXT NOT NULL,
				tools_json TEXT NOT NULL DEFAULT '[]',
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);
		`);

		const first = ensureSchemaCompatibility(db);
		expect(first.warnings).toEqual([]);
		expect(first.checks).toEqual({
			messagesAttachmentsJson: true,
			personaColumns: true,
			chatsProjectId: true,
		});
		expect(first.applied.length).toBeGreaterThan(0);

		const second = ensureSchemaCompatibility(db);
		expect(second.warnings).toEqual([]);
		expect(second.applied).toEqual([]);
		expect(second.checks).toEqual({
			messagesAttachmentsJson: true,
			personaColumns: true,
			chatsProjectId: true,
		});

		db.close();
	});
});

describe('auditMigrationDrift', () => {
	it('reports drift when expected/applied hashes differ', () => {
		const db = new Database(':memory:');
		db.exec('CREATE TABLE __drizzle_migrations (hash TEXT NOT NULL, created_at INTEGER NOT NULL);');

		const tmp = mkdtempSync(join(os.tmpdir(), 'bryon-readiness-'));
		const migrationsDir = join(tmp, 'migrations');
		const metaDir = join(migrationsDir, 'meta');
		mkdirSync(metaDir, { recursive: true });

		const sql1 = 'CREATE TABLE a(id INTEGER PRIMARY KEY);';
		const sql2 = 'CREATE TABLE b(id INTEGER PRIMARY KEY);';
		writeFileSync(join(migrationsDir, '0001_init.sql'), sql1, 'utf8');
		writeFileSync(join(migrationsDir, '0002_next.sql'), sql2, 'utf8');
		writeFileSync(
			join(metaDir, '_journal.json'),
			JSON.stringify({
				entries: [
					{ idx: 0, tag: '0001_init' },
					{ idx: 1, tag: '0002_next' },
				],
			}),
			'utf8',
		);

		db.prepare('INSERT INTO __drizzle_migrations(hash, created_at) VALUES (?, ?)')
			.run(sha256(sql1), Date.now());
		db.prepare('INSERT INTO __drizzle_migrations(hash, created_at) VALUES (?, ?)')
			.run('not-a-real-hash', Date.now());

		const report = auditMigrationDrift(db, migrationsDir);
		expect(report.status).toBe('drift');
		expect(report.entries[0]?.status).toBe('match');
		expect(report.entries[1]?.status).toBe('mismatch');
		expect(report.summary.length).toBeGreaterThan(0);

		rmSync(tmp, { recursive: true, force: true });
		db.close();
	});

	it('reports ok when expected and applied migration hashes match', () => {
		const db = new Database(':memory:');
		db.exec('CREATE TABLE __drizzle_migrations (hash TEXT NOT NULL, created_at INTEGER NOT NULL);');

		const tmp = mkdtempSync(join(os.tmpdir(), 'bryon-readiness-'));
		const migrationsDir = join(tmp, 'migrations');
		const metaDir = join(migrationsDir, 'meta');
		mkdirSync(metaDir, { recursive: true });

		const sql = 'CREATE TABLE stable(id INTEGER PRIMARY KEY);';
		writeFileSync(join(migrationsDir, '0001_stable.sql'), sql, 'utf8');
		writeFileSync(
			join(metaDir, '_journal.json'),
			JSON.stringify({ entries: [{ idx: 0, tag: '0001_stable' }] }),
			'utf8',
		);

		db.prepare('INSERT INTO __drizzle_migrations(hash, created_at) VALUES (?, ?)')
			.run(sha256(sql), Date.now());

		const report = auditMigrationDrift(db, migrationsDir);
		expect(report.status).toBe('ok');
		expect(report.summary).toEqual(['No migration drift detected.']);

		rmSync(tmp, { recursive: true, force: true });
		db.close();
	});
});
