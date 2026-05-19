import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { getDb, getSqlite } from '../db/client';
import { kbChunks, kbCollections, kbDocuments } from '../db/schema';
import type * as schema from '../db/schema';
import { getLogger } from '../logger';
import { EmbeddingAdapter } from './embedding';
import { chunkText, type Chunk } from './chunker';
import { extractMd } from './extractors/md';
import { extractTxt } from './extractors/txt';
import { extractPdf } from './extractors/pdf';
import { extractHtml } from './extractors/html';

type Db = BetterSQLite3Database<typeof schema>;

export type IngestOptions = {
	baseUrl: string;
	embeddingModel: string;
	kbRoot: string;
	collection?: string;
	signal?: AbortSignal;
};

export type IngestResult = {
	collection: string;
	added: number;
	skipped: number;
	errors: number;
};

const SUPPORTED_EXTS = new Set(['.md', '.txt', '.markdown', '.pdf', '.html', '.htm']);

export class IngestService {
	private readonly db: Db;
	private readonly logger = getLogger();

	constructor(db: Db = getDb()) {
		this.db = db;
	}

	async ingest(opts: IngestOptions): Promise<IngestResult[]> {
		const results: IngestResult[] = [];

		if (!existsSync(opts.kbRoot)) {
			mkdirSync(opts.kbRoot, { recursive: true });
		}

		const adapter = new EmbeddingAdapter({
			baseUrl: opts.baseUrl,
			model: opts.embeddingModel,
		});

		const collectionDirs = opts.collection
			? [opts.collection]
			: readdirSync(opts.kbRoot).filter((entry) => {
					return statSync(join(opts.kbRoot, entry)).isDirectory();
				});

		for (const collName of collectionDirs) {
			if (opts.signal?.aborted) break;
			try {
				const result = await this.ingestCollection(
					collName,
					join(opts.kbRoot, collName),
					adapter,
					opts.signal,
				);
				results.push(result);
			} catch (err) {
				this.logger.error({ collection: collName, err }, 'kb.ingest.collection_failed');
			}
		}

		return results;
	}

	private async ingestCollection(
		name: string,
		dir: string,
		adapter: EmbeddingAdapter,
		signal?: AbortSignal,
	): Promise<IngestResult> {
		const collection = this.ensureCollection(name, dir);
		const files = this.listFiles(dir);
		let added = 0;
		let skipped = 0;
		let errors = 0;

		for (const filePath of files) {
			if (signal?.aborted) break;
			try {
				const didIngest = await this.ingestFile(collection.id, filePath, adapter, signal);
				if (didIngest) added++;
				else skipped++;
			} catch (err) {
				errors++;
				this.logger.warn({ filePath, err }, 'kb.ingest.file_failed');
				this.markDocumentError(collection.id, filePath, (err as Error).message);
			}
		}

		this.logger.info({ collection: name, added, skipped, errors }, 'kb.ingest.done');
		return { collection: name, added, skipped, errors };
	}

	private ensureCollection(
		name: string,
		_dir: string,
	): { id: string; name: string } {
		const existing = this.db
			.select({ id: kbCollections.id, name: kbCollections.name })
			.from(kbCollections)
			.where(eq(kbCollections.name, name))
			.get();

		if (existing) return existing;

		const id = randomUUID();
		this.db.insert(kbCollections).values({ id, name, createdAt: Date.now() }).run();
		return { id, name };
	}

	private listFiles(dir: string): string[] {
		if (!existsSync(dir)) return [];

		return readdirSync(dir, { recursive: true })
			.map((f) => join(dir, f as string))
			.filter((f) => {
				try {
					return statSync(f).isFile() && SUPPORTED_EXTS.has(extname(f).toLowerCase());
				} catch {
					return false;
				}
			});
	}

	private async ingestFile(
		collectionId: string,
		filePath: string,
		adapter: EmbeddingAdapter,
		signal?: AbortSignal,
	): Promise<boolean> {
		const raw = readFileSync(filePath);
		const hash = createHash('sha256').update(raw).digest('hex');

		// Check for existing document with the same hash (idempotent).
		const existing = this.db
			.select({ id: kbDocuments.id, hash: kbDocuments.hash })
			.from(kbDocuments)
			.where(and(eq(kbDocuments.collectionId, collectionId), eq(kbDocuments.path, filePath)))
			.get();

		if (existing?.hash === hash) return false; // unchanged

		const ext = extname(filePath).toLowerCase();
		const filename = basename(filePath);

		const { title, chunks, mime } = await this.extractAndChunk(raw, ext, filename);
		if (chunks.length === 0) return false;

		// Embed all chunks in one batch call.
		const embeddings = await adapter.embedBatch(
			chunks.map((c) => c.text),
			signal,
		);

		// Persist in a single transaction: delete old, insert new.
		const sqlite = getSqlite();
		const docId = existing?.id ?? randomUUID();

		sqlite.transaction(() => {
			if (existing) {
				// Delete old chunks (triggers will clean FTS; vec rows deleted below).
				this.db.delete(kbChunks).where(eq(kbChunks.documentId, existing.id)).run();
				sqlite.prepare('DELETE FROM kb_vec WHERE document_id = ?').run(existing.id);

				this.db
					.update(kbDocuments)
					.set({ hash, title, ingestedAt: Date.now(), errorMessage: null })
					.where(eq(kbDocuments.id, existing.id))
					.run();
			} else {
				this.db
					.insert(kbDocuments)
					.values({
						id: docId,
						collectionId,
						path: filePath,
						hash,
						mime,
						title,
						ingestedAt: Date.now(),
					})
					.run();
			}

			const insertVec = sqlite.prepare(
				'INSERT INTO kb_vec(chunk_id, document_id, embedding, +text, +page) VALUES (?, ?, ?, ?, ?)',
			);

			for (let i = 0; i < chunks.length; i++) {
				const chunk = chunks[i];
				const embedding = embeddings[i];
				if (!chunk || !embedding) continue;
				const chunkId = randomUUID();

				this.db
					.insert(kbChunks)
					.values({
						id: chunkId,
						documentId: docId,
						ordinal: chunk.ordinal,
						page: chunk.page ?? null,
						tokenCount: chunk.tokenCount,
						text: chunk.text,
					})
					.run();

				insertVec.run(
					chunkId,
					docId,
					new Uint8Array(embedding.buffer),
					chunk.text,
					chunk.page ?? null,
				);
			}
		})();

		return true;
	}

	private async extractAndChunk(
		raw: Buffer,
		ext: string,
		filename: string,
	): Promise<{ title: string | null; chunks: Chunk[]; mime: string }> {
		if (ext === '.pdf') {
			const { title, pages } = await extractPdf(raw, filename);
			const chunks: Chunk[] = [];
			for (const page of pages) {
				if (!page.text.trim()) continue;
				const pageChunks = chunkText(page.text, page.page);
				// Re-number ordinals across pages.
				for (const c of pageChunks) {
					chunks.push({ ...c, ordinal: chunks.length });
				}
			}
			return { title, chunks, mime: 'application/pdf' };
		}

		if (ext === '.html' || ext === '.htm') {
			const content = raw.toString('utf-8');
			const { title, text } = extractHtml(content, filename);
			const chunks = chunkText(text);
			return { title, chunks, mime: 'text/html' };
		}

		const content = raw.toString('utf-8');
		if (ext === '.md' || ext === '.markdown') {
			const { title, text } = extractMd(content, filename);
			return { title, chunks: chunkText(text), mime: 'text/markdown' };
		}

		const { title, text } = extractTxt(content, filename);
		return { title, chunks: chunkText(text), mime: 'text/plain' };
	}

	private markDocumentError(collectionId: string, filePath: string, message: string): void {
		this.db
			.update(kbDocuments)
			.set({ errorMessage: message, ingestedAt: null })
			.where(
				and(eq(kbDocuments.collectionId, collectionId), eq(kbDocuments.path, filePath)),
			)
			.run();
	}
}
