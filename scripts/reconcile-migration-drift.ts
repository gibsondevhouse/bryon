import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { loadConfig } from '../src/lib/server/config';
import {
	auditMigrationDrift,
	ensureSchemaCompatibility,
	type MigrationDriftEntry,
} from '../src/lib/server/runtime/readiness';

type MigrationRow = {
	rowid: number;
	hash: string;
	created_at: number | null;
};

type PlannedFix =
	| {
			kind: 'update';
			index: number;
			tag: string;
			rowid: number;
			fromHash: string;
			toHash: string;
	  }
	| {
			kind: 'insert';
			index: number;
			tag: string;
			toHash: string;
	  };

const dryRun = process.argv.includes('--dry-run');
const migrationsDir = join(process.cwd(), 'src/lib/server/db/migrations');
const { config } = loadConfig();
const dbPath = join(config.app.data_dir, 'bryon.db');

if (!existsSync(dbPath)) {
	fail(`Database not found at ${dbPath}`);
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

try {
	const schema = ensureSchemaCompatibility(db);
	const failedChecks = Object.entries(schema.checks)
		.filter(([, ok]) => !ok)
		.map(([name]) => name);

	if (schema.warnings.length > 0 || failedChecks.length > 0) {
		fail(
			[
				'Schema compatibility checks failed. Reconciliation was not attempted.',
				...schema.warnings.map((line) => `- warning: ${line}`),
				...failedChecks.map((name) => `- failed check: ${name}`),
			].join('\n'),
		);
	}

	if (schema.applied.length > 0) {
		process.stdout.write(
			`Applied additive compatibility fixes before reconciliation:\n${schema.applied.map((line) => `- ${line}`).join('\n')}\n`,
		);
	}

	const before = auditMigrationDrift(db, migrationsDir);
	if (before.status === 'ok') {
		process.stdout.write('No migration drift detected. No reconciliation required.\n');
		process.exit(0);
	}

	process.stdout.write(
		`Detected migration drift (${before.summary.length} entries):\n${before.summary.map((line) => `- ${line}`).join('\n')}\n`,
	);

	const rows = db
		.prepare('SELECT rowid, hash, created_at FROM __drizzle_migrations ORDER BY rowid')
		.all() as MigrationRow[];
	const fixes = planFixes(before.entries, rows);

	process.stdout.write(
		`Planned ${fixes.length} metadata change(s):\n${fixes
			.map((fix) =>
				fix.kind === 'update'
					? `- update rowid=${fix.rowid} (${fix.tag}) hash ${fix.fromHash} -> ${fix.toHash}`
					: `- insert (${fix.tag}) hash=${fix.toHash}`,
			)
			.join('\n')}\n`,
	);

	if (dryRun) {
		process.stdout.write('Dry run enabled; no database changes were written.\n');
		process.exit(0);
	}

	const backupPath = `${dbPath}.backup-${formatTimestamp(new Date())}`;
	db.pragma('wal_checkpoint(TRUNCATE)');
	copyFileSync(dbPath, backupPath);
	process.stdout.write(`Database backup created at ${backupPath}\n`);

	const now = Date.now();
	const tx = db.transaction((planned: PlannedFix[]) => {
		for (const fix of planned) {
			if (fix.kind === 'update') {
				db.prepare('UPDATE __drizzle_migrations SET hash = ? WHERE rowid = ?')
					.run(fix.toHash, fix.rowid);
				continue;
			}
			db.prepare('INSERT INTO __drizzle_migrations(hash, created_at) VALUES (?, ?)')
				.run(fix.toHash, now);
		}
	});
	tx(fixes);

	const after = auditMigrationDrift(db, migrationsDir);
	if (after.status !== 'ok') {
		fail(
			[
				'Reconciliation completed but drift remains.',
				...after.summary.map((line) => `- ${line}`),
				`Restore from backup if needed: ${backupPath}`,
			].join('\n'),
		);
	}

	process.stdout.write('Migration metadata reconciliation completed successfully.\n');
} finally {
	db.close();
}

function planFixes(entries: MigrationDriftEntry[], rows: MigrationRow[]): PlannedFix[] {
	const unsupported = entries.filter(
		(entry) =>
			entry.status === 'missing_file' ||
			entry.status === 'extra_in_db' ||
			entry.expectedHash === null ||
			(entry.status === 'mismatch' && !rows[entry.index]),
	);
	if (unsupported.length > 0) {
		fail(
			[
				'Unsupported migration drift pattern detected. Reconciliation was not attempted.',
				...unsupported.map(
					(entry) =>
						`- #${entry.index} ${entry.tag}: ${entry.status} (expected=${entry.expectedHash ?? 'none'}, applied=${entry.appliedHash ?? 'none'})`,
				),
			].join('\n'),
		);
	}

	const fixes: PlannedFix[] = [];

	for (const entry of entries) {
		if (entry.status === 'match') continue;
		if (entry.status === 'mismatch') {
			const row = rows[entry.index];
			if (!row || !entry.expectedHash || !entry.appliedHash) {
				fail(`Unable to map mismatch entry ${entry.tag} to an applied row.`);
			}
			fixes.push({
				kind: 'update',
				index: entry.index,
				tag: entry.tag,
				rowid: row.rowid,
				fromHash: entry.appliedHash,
				toHash: entry.expectedHash,
			});
			continue;
		}

		if (entry.status === 'missing_in_db') {
			if (entry.index < rows.length) {
				fail(
					`Unexpected missing_in_db ordering at #${entry.index} ${entry.tag}; expected missing entries only after applied rows.`,
				);
			}
			const expectedHash = entry.expectedHash;
			if (!expectedHash) {
				fail(`Missing expected hash for migration ${entry.tag}.`);
			}
			fixes.push({
				kind: 'insert',
				index: entry.index,
				tag: entry.tag,
				toHash: expectedHash,
			});
			continue;
		}

		fail(`Unhandled migration drift status: ${entry.status}`);
	}

	return fixes;
}

function formatTimestamp(date: Date): string {
	const pad = (value: number) => value.toString().padStart(2, '0');
	return [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
		'-',
		pad(date.getHours()),
		pad(date.getMinutes()),
		pad(date.getSeconds()),
	].join('');
}

function fail(message: string): never {
	process.stderr.write(`${message}\n`);
	process.exit(1);
}
