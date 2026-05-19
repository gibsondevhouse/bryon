import { describe, expect, it } from 'vitest';
import { escapeFts, rrfMerge, type RankedRow } from './retrieval';

function row(chunk_id: string, overrides: Partial<RankedRow> = {}): RankedRow {
	return {
		chunk_id,
		text: `text-${chunk_id}`,
		document_path: `/kb/doc.md`,
		document_title: null,
		page: null,
		score: 1,
		...overrides,
	};
}

describe('rrfMerge', () => {
	const K = 60;

	it('returns empty array when both lists are empty', () => {
		expect(rrfMerge([], [], 8, K)).toEqual([]);
	});

	it('returns up to topK results', () => {
		const bm25 = Array.from({ length: 20 }, (_, i) => row(`c${i}`));
		const results = rrfMerge(bm25, [], 5, K);
		expect(results).toHaveLength(5);
	});

	it('scores BM25-rank-0 at 1/(K+1)', () => {
		const [result] = rrfMerge([row('x')], [], 8, K);
		expect(result?.score).toBeCloseTo(1 / (K + 1));
	});

	it('scores vec-rank-0 at 1/(K+1)', () => {
		const [result] = rrfMerge([], [row('x')], 8, K);
		expect(result?.score).toBeCloseTo(1 / (K + 1));
	});

	it('adds BM25 and vec scores for the same chunk', () => {
		const merged = rrfMerge([row('shared')], [row('shared')], 8, K);
		expect(merged).toHaveLength(1);
		// rank 0 in both lists → 1/(K+1) + 1/(K+1)
		expect(merged[0]?.score).toBeCloseTo(2 / (K + 1));
	});

	it('sorts results by score descending', () => {
		// chunk 'top' appears first in both → highest score
		const bm25 = [row('top'), row('mid'), row('low')];
		const vec = [row('top'), row('other')];
		const results = rrfMerge(bm25, vec, 8, K);
		expect(results[0]?.chunkId).toBe('top');
		for (let i = 1; i < results.length; i++) {
			expect((results[i - 1]?.score ?? 0) >= (results[i]?.score ?? 0)).toBe(true);
		}
	});

	it('records sources correctly', () => {
		const bm25Only = row('b');
		const vecOnly = row('v');
		const both = row('both');

		const results = rrfMerge([bm25Only, both], [both, vecOnly], 8, K);
		const byId = Object.fromEntries(results.map((r) => [r.chunkId, r]));

		expect(byId.b?.sources).toContain('bm25');
		expect(byId.b?.sources).not.toContain('vec');

		expect(byId.v?.sources).toContain('vec');
		expect(byId.v?.sources).not.toContain('bm25');

		expect(byId.both?.sources).toContain('bm25');
		expect(byId.both?.sources).toContain('vec');
	});

	it('later ranks get lower scores (monotone)', () => {
		const bm25 = Array.from({ length: 10 }, (_, i) => row(`c${i}`));
		const results = rrfMerge(bm25, [], 10, K);
		for (let i = 1; i < results.length; i++) {
			expect((results[i - 1]?.score ?? 0)).toBeGreaterThan(results[i]?.score ?? 0);
		}
	});

	it('maps chunk fields through correctly', () => {
		const r = row('id1', { document_path: '/some/path.md', document_title: 'My Doc', page: 3, text: 'hello' });
		const [result] = rrfMerge([r], [], 1, K);
		expect(result?.chunkId).toBe('id1');
		expect(result?.documentPath).toBe('/some/path.md');
		expect(result?.documentTitle).toBe('My Doc');
		expect(result?.page).toBe(3);
		expect(result?.text).toBe('hello');
	});
});

describe('escapeFts', () => {
	it('wraps each word in double quotes', () => {
		expect(escapeFts('hello world')).toBe('"hello" "world"');
	});

	it('handles a single word', () => {
		expect(escapeFts('OSHA')).toBe('"OSHA"');
	});

	it('collapses multiple spaces between words', () => {
		expect(escapeFts('a   b')).toBe('"a" "b"');
	});

	it('trims leading and trailing whitespace', () => {
		expect(escapeFts('  hello  ')).toBe('"hello"');
	});

	it('escapes internal double-quote characters', () => {
		// A word with a quote → the quote is doubled inside the FTS5 quoted token
		const result = escapeFts('say "hi"');
		expect(result).toBe('"say" """hi"""');
	});

	it('handles a CFR-style query without crashing', () => {
		const result = escapeFts('29 CFR 1910.134');
		expect(result).toBe('"29" "CFR" "1910.134"');
	});
});
