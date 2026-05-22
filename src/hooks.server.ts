import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Handle } from '@sveltejs/kit';
import { loadConfig, type LoadedConfig } from '$lib/server/config';
import { defaultPersona } from '$lib/server/default-persona';
import { closeDb, getDb, getDbPath, getSqlite, initializeDb } from '$lib/server/db/client';
import { personas } from '$lib/server/db/schema';
import { configureLogger, getLogger } from '$lib/server/logger';
import {
	auditMigrationDrift,
	ensureSchemaCompatibility,
	setRuntimeReadiness,
} from '$lib/server/runtime/readiness';
import { getOllamaSupervisor } from '$lib/server/llm/supervisor';

export type BootState = {
	config: LoadedConfig['config'];
	configPath: string;
	configParseError: string | null;
	dbPath: string;
	ollamaReachable: boolean;
};

let shutdownRegistered = false;

const bootState = await bootServer();

export function getBootState(): BootState {
	return bootState;
}

export const handle: Handle = async ({ event, resolve }) => {
	const start = performance.now();

	event.locals.config = bootState.config;
	event.locals.ollamaReachable = bootState.ollamaReachable;
	event.locals.configParseError = bootState.configParseError;

	try {
		const response = await resolve(event);
		getLogger().info(
			{
				method: event.request.method,
				path: event.url.pathname,
				status: response.status,
				durationMs: Math.round(performance.now() - start),
			},
			'request',
		);
		return response;
	} catch (error) {
		getLogger().error(
			{
				error,
				method: event.request.method,
				path: event.url.pathname,
				durationMs: Math.round(performance.now() - start),
			},
			'request failed',
		);
		throw error;
	}
};

async function bootServer(): Promise<BootState> {
	const loaded = loadConfig();
	const logger = configureLogger(loaded.config.app.data_dir);
	const dbPath = join(loaded.config.app.data_dir, 'bryon.db');
	const migrationsFolder = join(process.cwd(), 'src/lib/server/db/migrations');

	if (loaded.parseError) {
		logger.warn(
			{
				configPath: loaded.configPath,
				error: loaded.parseError.message,
			},
			'config file could not be parsed; using defaults',
		);
	}

	const db = initializeDb(dbPath);
	logger.info({ dbPath: getDbPath() }, 'db.opened');
	migrate(db, { migrationsFolder });
	const schemaReport = ensureSchemaCompatibility(getSqlite());
	const migrationReport = auditMigrationDrift(getSqlite(), migrationsFolder);
	setRuntimeReadiness({
		schema: schemaReport,
		migration: migrationReport,
		generatedAt: Date.now(),
	});
	if (schemaReport.applied.length > 0 || schemaReport.warnings.length > 0) {
		logger.warn(
			{
				applied: schemaReport.applied,
				warnings: schemaReport.warnings,
			},
			'db.schema_compatibility',
		);
	}
	if (migrationReport.status === 'drift') {
		logger.warn({ summary: migrationReport.summary }, 'db.migration_drift_detected');
	}
	seedPersonas();
	registerShutdownHandlers();

	const ollamaSupervisor = getOllamaSupervisor(loaded.config.llm.base_url);
	ollamaSupervisor.start();

	logger.info(
		{
			configPath: loaded.configPath,
			dbPath: getDbPath(),
		},
		'server boot complete',
	);

	return {
		config: loaded.config,
		configPath: loaded.configPath,
		configParseError: loaded.parseError?.message ?? null,
		dbPath: getDbPath(),
		ollamaReachable: ollamaSupervisor.getState() === 'ready',
	};
}

function seedPersonas(): void {
	const db = getDb();
	const now = Date.now();

	const allPersonas = [
		{
			id: defaultPersona.id,
			name: defaultPersona.name,
			systemPrompt: defaultPersona.systemPrompt,
			defaultModel: null,
			toolsJson: '[]',
			paramsJson: null,
		},
	];

	for (const p of allPersonas) {
		const existing = db.select({ id: personas.id }).from(personas).where(eq(personas.id, p.id)).get();
		if (!existing) {
			db.insert(personas)
				.values({
					id: p.id,
					name: p.name,
					systemPrompt: p.systemPrompt,
					defaultModel: p.defaultModel,
					toolsJson: p.toolsJson,
					paramsJson: p.paramsJson,
					createdAt: now,
					updatedAt: now,
				})
				.run();
		}
	}
}

function registerShutdownHandlers(): void {
	if (shutdownRegistered) return;
	shutdownRegistered = true;

	let shuttingDown = false;
	const shutdown = (signal: NodeJS.Signals) => {
		if (shuttingDown) return;
		shuttingDown = true;
		try {
			getLogger().info({ signal }, 'db.closing');
			closeDb();
			getLogger().info({ signal }, 'db.closed');
		} catch (error) {
			getLogger().error({ error }, 'db.close_failed');
		} finally {
			// Force exit so the listening socket is released and the port frees
			// immediately, even if adapter-node has lingering keep-alive sockets.
			process.exit(0);
		}
	};

	// SIGHUP fires when the controlling terminal closes; without this handler
	// a backgrounded `node build` (especially after `disown`) lingers and keeps
	// the port bound.
	process.on('SIGHUP', shutdown);
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
}
