import { getSqlite } from '../db/client';
import { EmbeddingAdapter } from './embedding';

export type RetrievalChunk = {
	chunkId: string;
	documentPath: string;
	documentTitle: string | null;
	text: string;
	page: number | null;
	score: number;
	sources: ('bm25' | 'vec')[];
};

export type RetrievalDegraded = {
	code: 'VECTOR_UNAVAILABLE';
	message: string;
	fallback: 'bm25';
	detail: string;
};

export type RetrievalQueryResult = {
	chunks: RetrievalChunk[];
	degraded: RetrievalDegraded | null;
};

export type RetrievalOptions = {
	baseUrl: string;
	embeddingModel: string;
	collection?: string;
	query: string;
	k?: number;
	signal?: AbortSignal;
};

const RRF_K = 60;

export class RetrievalService {
	async query(opts: RetrievalOptions): Promise<RetrievalQueryResult> {
		const k = opts.k ?? 8;
		const sqlite = getSqlite();
		const adapter = new EmbeddingAdapter({
			baseUrl: opts.baseUrl,
			model: opts.embeddingModel,
		});

		const docFilter = this.buildDocFilter(sqlite, opts.collection);
		const bm25Rows = this.bm25Search(sqlite, opts.query, k * 2, docFilter);
		let vecRows: RankedRow[] = [];
		let degraded: RetrievalDegraded | null = null;
		try {
			vecRows = await this.vectorSearch(
				sqlite,
				adapter,
				opts.query,
				k * 2,
				docFilter,
				opts.signal,
			);
		} catch (error) {
			degraded = {
				code: 'VECTOR_UNAVAILABLE',
				message:
					'Vector retrieval is currently unavailable; returning BM25-only results.',
				fallback: 'bm25',
				detail: (error as Error).message,
			};
		}

		const merged = rrfMerge(bm25Rows, vecRows, k, RRF_K);
		return { chunks: merged, degraded };
	}

	private buildDocFilter(
		sqlite: ReturnType<typeof getSqlite>,
		collection: string | undefined,
	): string[] | null {
		if (!collection) return null;

		const rows = sqlite
			.prepare(
				`SELECT d.id FROM kb_documents d
				 JOIN kb_collections c ON c.id = d.collection_id
				 WHERE c.name = ?`,
			)
			.all(collection) as { id: string }[];

		return rows.map((r) => r.id);
	}

	private bm25Search(
		sqlite: ReturnType<typeof getSqlite>,
		query: string,
		limit: number,
		docFilter: string[] | null,
	): RankedRow[] {
		const filterClause = docFilter
			? `AND c.document_id IN (${docFilter.map(() => '?').join(',')})`
			: '';

		const sql = `
			SELECT
				fts.chunk_id AS chunk_id,
				c.text AS text,
				d.path AS document_path,
				d.title AS document_title,
				c.page AS page,
				-bm25(kb_chunks_fts) AS score
			FROM kb_chunks_fts fts
			JOIN kb_chunks c ON c.id = fts.chunk_id
			JOIN kb_documents d ON d.id = c.document_id
			WHERE kb_chunks_fts MATCH ?
			${filterClause}
			ORDER BY score DESC
			LIMIT ?
		`;

		const params: (string | number)[] = [escapeFts(query), ...(docFilter ?? []), limit];
		try {
			return (sqlite.prepare(sql).all(...params) as RankedRow[]).map((r, i) => ({
				...r,
				rank: i,
			}));
		} catch {
			return [];
		}
	}

	private async vectorSearch(
		sqlite: ReturnType<typeof getSqlite>,
		adapter: EmbeddingAdapter,
		query: string,
		limit: number,
		docFilter: string[] | null,
		signal?: AbortSignal,
	): Promise<RankedRow[]> {
		const queryVec = await adapter.embed(query, signal);
		const vecBytes = new Uint8Array(queryVec.buffer);

		const filterClause = docFilter
			? `AND v.document_id IN (${docFilter.map(() => '?').join(',')})`
			: '';

		const sql = `
			SELECT
				v.chunk_id AS chunk_id,
				v.text AS text,
				d.path AS document_path,
				d.title AS document_title,
				v.page AS page,
				v.distance AS score
			FROM kb_vec v
			JOIN kb_documents d ON d.id = v.document_id
			WHERE v.embedding MATCH ?
			  AND k = ?
			  ${filterClause}
			ORDER BY v.distance
		`;

		const params: (Uint8Array | string | number)[] = [
			vecBytes,
			limit,
			...(docFilter ?? []),
		];

		const rows = sqlite.prepare(sql).all(...params) as Array<RankedRow & { score: number }>;
		// vec0 returns distance (lower = closer). Convert to similarity-like score.
		return rows.map((r, i) => ({ ...r, score: 1 / (1 + r.score), rank: i }));
	}
}

export type RankedRow = {
	chunk_id: string;
	text: string;
	document_path: string;
	document_title: string | null;
	page: number | null;
	score: number;
	rank?: number;
};

export function rrfMerge(
	bm25: RankedRow[],
	vec: RankedRow[],
	topK: number,
	rrfK: number,
): RetrievalChunk[] {
	const scores = new Map<string, { score: number; row: RankedRow; sources: Set<'bm25' | 'vec'> }>();

	for (let i = 0; i < bm25.length; i++) {
		const row = bm25[i];
		if (!row) continue;
		const rrf = 1 / (rrfK + i + 1);
		const existing = scores.get(row.chunk_id);
		if (existing) {
			existing.score += rrf;
			existing.sources.add('bm25');
		} else {
			scores.set(row.chunk_id, { score: rrf, row, sources: new Set(['bm25']) });
		}
	}

	for (let i = 0; i < vec.length; i++) {
		const row = vec[i];
		if (!row) continue;
		const rrf = 1 / (rrfK + i + 1);
		const existing = scores.get(row.chunk_id);
		if (existing) {
			existing.score += rrf;
			existing.sources.add('vec');
		} else {
			scores.set(row.chunk_id, { score: rrf, row, sources: new Set(['vec']) });
		}
	}

	return [...scores.values()]
		.sort((a, b) => b.score - a.score)
		.slice(0, topK)
		.map(({ score, row, sources }) => ({
			chunkId: row.chunk_id,
			documentPath: row.document_path,
			documentTitle: row.document_title,
			text: row.text,
			page: row.page,
			score,
			sources: [...sources],
		}));
}

export function escapeFts(query: string): string {
	// Wrap each word in double quotes to prevent FTS5 syntax errors.
	return query
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => `"${w.replace(/"/g, '""')}"`)
		.join(' ');
}
