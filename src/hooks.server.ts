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

	const ollamaReachable = await pingOllama(loaded.config.llm.base_url);
	if (!ollamaReachable) {
		logger.warn(
			{ baseUrl: loaded.config.llm.base_url },
			'Ollama not reachable; start Ollama and reload',
		);
	}

	logger.info(
		{
			configPath: loaded.configPath,
			dbPath: getDbPath(),
			ollamaReachable,
		},
		'server boot complete',
	);

	return {
		config: loaded.config,
		configPath: loaded.configPath,
		configParseError: loaded.parseError?.message ?? null,
		dbPath: getDbPath(),
		ollamaReachable,
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

async function pingOllama(baseUrl: string): Promise<boolean> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 1_500);

	try {
		const response = await fetch(new URL('/api/tags', baseUrl), {
			signal: controller.signal,
		});
		return response.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timeout);
	}
}

function registerShutdownHandlers(): void {
	if (shutdownRegistered) return;
	shutdownRegistered = true;

	const shutdown = (signal: NodeJS.Signals) => {
		try {
			getLogger().info({ signal }, 'db.closing');
			closeDb();
			getLogger().info({ signal }, 'db.closed');
		} catch (error) {
			getLogger().error({ error }, 'db.close_failed');
		} finally {
			process.exit(0);
		}
	};

	process.once('SIGINT', shutdown);
	process.once('SIGTERM', shutdown);
}
