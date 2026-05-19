import { existsSync, mkdirSync, watch } from 'node:fs';
import { extname } from 'node:path';
import { IngestService } from './ingest';
import { getLogger } from '../logger';

const DEBOUNCE_MS = 2000;
const SUPPORTED_EXTS = new Set(['.md', '.txt', '.markdown', '.pdf', '.html', '.htm']);

export type WatcherOptions = {
	kbRoot: string;
	baseUrl: string;
	embeddingModel: string;
};

export function startKbWatcher(opts: WatcherOptions): (() => void) | null {
	if (!existsSync(opts.kbRoot)) {
		mkdirSync(opts.kbRoot, { recursive: true });
	}

	const logger = getLogger();
	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	let fsWatcher: ReturnType<typeof watch> | null = null;

	try {
		fsWatcher = watch(opts.kbRoot, { recursive: true }, (_event, filename) => {
			if (!filename) return;

			// filename is relative to kbRoot: "collectionName/file.md"
			const slash = filename.indexOf('/');
			if (slash <= 0) return; // collection-level event, no file

			const collName = filename.slice(0, slash);
			const filePart = filename.slice(slash + 1);
			if (!filePart) return;

			if (!SUPPORTED_EXTS.has(extname(filePart).toLowerCase())) return;

			// Debounce per collection so rapid saves don't trigger multiple ingests.
			const existing = timers.get(collName);
			if (existing) clearTimeout(existing);

			timers.set(
				collName,
				setTimeout(async () => {
					timers.delete(collName);
					logger.info({ collection: collName }, 'kb.watcher.triggered');
					try {
						const service = new IngestService();
						const results = await service.ingest({
							baseUrl: opts.baseUrl,
							embeddingModel: opts.embeddingModel,
							kbRoot: opts.kbRoot,
							collection: collName,
						});
						logger.info({ collection: collName, results }, 'kb.watcher.ingest_complete');
					} catch (err) {
						logger.warn({ collection: collName, err }, 'kb.watcher.ingest_failed');
					}
				}, DEBOUNCE_MS),
			);
		});
	} catch (err) {
		logger.warn({ err, kbRoot: opts.kbRoot }, 'kb.watcher.start_failed');
		return null;
	}

	logger.info({ kbRoot: opts.kbRoot }, 'kb.watcher.started');

	return () => {
		for (const t of timers.values()) clearTimeout(t);
		timers.clear();
		fsWatcher?.close();
	};
}
