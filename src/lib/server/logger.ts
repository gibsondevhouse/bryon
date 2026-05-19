import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import pino, { type Logger } from 'pino';
import { defaultDataDir } from './db/client';

let logger: Logger | null = null;

export function configureLogger(dataDir = defaultDataDir): Logger {
	mkdirSync(dataDir, { recursive: true });

	logger = pino(
		{
			base: undefined,
			level: process.env.BRYON_LOG_LEVEL ?? 'info',
			timestamp: pino.stdTimeFunctions.isoTime,
		},
		pino.destination({
			dest: join(dataDir, 'bryon.log'),
			sync: false,
		}),
	);

	return logger;
}

export function getLogger(): Logger {
	logger ??= configureLogger();
	return logger;
}
