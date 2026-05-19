import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';

export type SchemaCompatibilityReport = {
	applied: string[];
	warnings: string[];
	checks: {
		messagesAttachmentsJson: boolean;
		personaColumns: boolean;
	};
};

export type MigrationDriftStatus =
	| 'match'
	| 'mismatch'
	| 'missing_in_db'
	| 'missing_file'
	| 'extra_in_db';

export type MigrationDriftEntry = {
	index: number;
	tag: string;
	status: MigrationDriftStatus;
	expectedHash: string | null;
	appliedHash: string | null;
};

export type MigrationDriftReport = {
	status: 'ok' | 'drift';
	appliedCount: number;
	expectedCount: number;
	entries: MigrationDriftEntry[];
	summary: string[];
};

export type RuntimeReadinessReport = {
	schema: SchemaCompatibilityReport;
	migration: MigrationDriftReport;
	generatedAt: number;
};

let runtimeReadiness: RuntimeReadinessReport | null = null;

export function setRuntimeReadiness(report: RuntimeReadinessReport): void {
	runtimeReadiness = report;
}

export function getRuntimeReadiness(): RuntimeReadinessReport | null {
	return runtimeReadiness;
}

export function ensureSchemaCompatibility(
	sqlite: Database.Database,
): SchemaCompatibilityReport {
	const applied: string[] = [];
	const warnings: string[] = [];

	const ensureColumn = (table: string, column: string, alterSql: string, label: string) => {
		if (!tableExists(sqlite, table)) return;
		if (columnExists(sqlite, table, column)) return;
		try {
			sqlite.exec(alterSql);
			applied.push(label);
		} catch (error) {
			warnings.push(`${label}: ${(error as Error).message}`);
		}
	};

	ensureColumn(
		'messages',
		'attachments_json',
		'ALTER TABLE `messages` ADD `attachments_json` text;',
		'messages.attachments_json',
	);
	ensureColumn(
		'personas',
		'default_model',
		'ALTER TABLE `personas` ADD `default_model` text;',
		'personas.default_model',
	);
	ensureColumn(
		'personas',
		'tools',
		"ALTER TABLE `personas` ADD `tools` text NOT NULL DEFAULT '[]';",
		'personas.tools',
	);
	ensureColumn(
		'personas',
		'params_json',
		'ALTER TABLE `personas` ADD `params_json` text;',
		'personas.params_json',
	);

	const checks = {
		messagesAttachmentsJson: columnExists(sqlite, 'messages', 'attachments_json'),
		personaColumns:
			columnExists(sqlite, 'personas', 'default_model') &&
			columnExists(sqlite, 'personas', 'tools') &&
			columnExists(sqlite, 'personas', 'params_json'),
	};

	return { applied, warnings, checks };
}

export function auditMigrationDrift(
	sqlite: Database.Database,
	migrationsDir: string,
): MigrationDriftReport {
	const journalPath = join(migrationsDir, 'meta', '_journal.json');
	const expected = readMigrationJournal(journalPath);
	const applied = readAppliedMigrationHashes(sqlite);

	const entries: MigrationDriftEntry[] = [];

	for (let i = 0; i < expected.length; i++) {
		const item = expected[i];
		if (!item) continue;
		const filePath = join(migrationsDir, `${item.tag}.sql`);
		const expectedHash = existsSync(filePath) ? sha256(readFileSync(filePath)) : null;
		const appliedHash = applied[i] ?? null;

		let status: MigrationDriftStatus = 'match';
		if (!expectedHash) status = 'missing_file';
		else if (!appliedHash) status = 'missing_in_db';
		else if (expectedHash !== appliedHash) status = 'mismatch';

		entries.push({
			index: i,
			tag: item.tag,
			status,
			expectedHash,
			appliedHash,
		});
	}

	for (let i = expected.length; i < applied.length; i++) {
		const appliedHash = applied[i] ?? null;
		entries.push({
			index: i,
			tag: `extra#${i}`,
			status: 'extra_in_db',
			expectedHash: null,
			appliedHash,
		});
	}

	const driftEntries = entries.filter((entry) => entry.status !== 'match');
	const summary =
		driftEntries.length === 0
			? ['No migration drift detected.']
			: driftEntries.map(
					(entry) =>
						`#${entry.index} ${entry.tag}: ${entry.status} (expected=${entry.expectedHash ?? 'none'}, applied=${entry.appliedHash ?? 'none'})`,
				);

	return {
		status: driftEntries.length === 0 ? 'ok' : 'drift',
		appliedCount: applied.length,
		expectedCount: expected.length,
		entries,
		summary,
	};
}

function tableExists(sqlite: Database.Database, table: string): boolean {
	const row = sqlite
		.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1",
		)
		.get(table);
	return Boolean(row);
}

function columnExists(
	sqlite: Database.Database,
	table: string,
	column: string,
): boolean {
	if (!tableExists(sqlite, table)) return false;
	const rows = sqlite
		.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
		.all() as Array<{ name: string }>;
	return rows.some((row) => row.name === column);
}

function quoteIdentifier(value: string): string {
	return `"${value.replace(/"/g, '""')}"`;
}

function sha256(input: string | Buffer): string {
	return createHash('sha256').update(input).digest('hex');
}

function readAppliedMigrationHashes(sqlite: Database.Database): string[] {
	try {
		if (!tableExists(sqlite, '__drizzle_migrations')) return [];
		const rows = sqlite
			.prepare('SELECT hash FROM __drizzle_migrations ORDER BY rowid')
			.all() as Array<{ hash: string }>;
		return rows.map((row) => row.hash);
	} catch {
		return [];
	}
}

function readMigrationJournal(
	path: string,
): Array<{ idx: number; tag: string }> {
	if (!existsSync(path)) return [];
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
			entries?: Array<{ idx?: number; tag?: string }>;
		};
		const entries = parsed.entries ?? [];
		return entries
			.filter((entry): entry is { idx: number; tag: string } =>
				Number.isInteger(entry.idx) && typeof entry.tag === 'string' && entry.tag.length > 0,
			)
			.sort((a, b) => a.idx - b.idx);
	} catch {
		return [];
	}
}
