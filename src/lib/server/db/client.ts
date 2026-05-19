import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import {
	drizzle,
	type BetterSQLite3Database,
} from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export const defaultDataDir = join(homedir(), '.local/share/bryon');
export const defaultDbPath = join(defaultDataDir, 'bryon.db');

let sqlite: Database.Database | null = null;
let db: BetterSQLite3Database<typeof schema> | null = null;
let activeDbPath = defaultDbPath;

export function openDatabase(path = defaultDbPath): Database.Database {
	mkdirSync(dirname(path), { recursive: true });

	const connection = new Database(path);
	connection.pragma('journal_mode = WAL');
	connection.pragma('synchronous = NORMAL');
	connection.pragma('foreign_keys = ON');

	return connection;
}

export function getSqlite(): Database.Database {
	sqlite ??= openDatabase(activeDbPath);
	return sqlite;
}

export function getDb(): BetterSQLite3Database<typeof schema> {
	db ??= drizzle(getSqlite(), { schema });
	return db;
}

export function initializeDb(
	path = defaultDbPath,
): BetterSQLite3Database<typeof schema> {
	if (sqlite && path !== activeDbPath) {
		closeDb();
	}

	activeDbPath = path;
	return getDb();
}

export function getDbPath(): string {
	return activeDbPath;
}

export function closeDb(): void {
	if (!sqlite) return;

	sqlite.close();
	sqlite = null;
	db = null;
}
