#!/usr/bin/env tsx
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { loadConfig } from '../src/lib/server/config';
import { getSqlite, initializeDb } from '../src/lib/server/db/client';
import { WorkspaceSyncService } from '../src/lib/server/features/workspace-sync/workspace';

const command = process.argv[2];
const arg = process.argv.slice(3).join(' ').trim();

const { config } = loadConfig();
const db = initializeDb(join(config.app.data_dir, 'bryon.db'));
migrate(db, {
	migrationsFolder: join(process.cwd(), 'src/lib/server/db/migrations'),
});
getSqlite().pragma('foreign_keys = ON');

const service = new WorkspaceSyncService();

switch (command) {
	case 'sync': {
		const checkpoint = service.sync(arg || 'CLI sync');
		console.log(`Synced workspace: ${checkpoint.path}`);
		break;
	}
	case 'checkpoint': {
		if (!arg) {
			console.error('Usage: bryon checkpoint "<description>"');
			process.exitCode = 1;
			break;
		}
		const checkpoint = service.checkpoint(arg);
		console.log(`Created checkpoint: ${checkpoint.path}`);
		break;
	}
	case 'audit': {
		const findings = service.audit();
		if (findings.length === 0) {
			console.log('No workspace audit findings.');
			break;
		}
		for (const finding of findings) {
			console.log(`[${finding.severity}] ${finding.code}: ${finding.message}`);
		}
		break;
	}
	default:
		console.log('Usage: bryon <sync|checkpoint|audit> [description]');
		process.exitCode = command ? 1 : 0;
}
