import { describe, expect, it } from 'vitest';
import { chunkText } from './chunker';

describe('chunkText', () => {
	it('returns empty array for empty string', () => {
		expect(chunkText('')).toEqual([]);
	});

	it('returns empty array for whitespace-only string', () => {
		expect(chunkText('   \n  ')).toEqual([]);
	});

	it('returns a single chunk for text shorter than the target size', () => {
		const text = 'Hello world. This is a short paragraph.';
		const chunks = chunkText(text);
		expect(chunks).toHaveLength(1);
		expect(chunks[0].text).toBe(text);
		expect(chunks[0].ordinal).toBe(0);
	});

	it('assigns tokenCount as ceil(charLength / 4)', () => {
		const chunks = chunkText('abcdefgh.'); // 9 chars → ceil(9/4) = 3
		expect(chunks[0].tokenCount).toBe(Math.ceil('abcdefgh.'.length / 4));
	});

	it('attaches a page number when provided', () => {
		const chunks = chunkText('Short sentence.', 7);
		expect(chunks[0].page).toBe(7);
	});

	it('has no page property when page is omitted', () => {
		const chunks = chunkText('Short sentence.');
		expect(chunks[0].page).toBeUndefined();
	});

	it('produces multiple chunks with ascending ordinals for long text', () => {
		// Each sentence is ~300 chars; target is 512 tokens = 2048 chars → 7+ sentences per chunk
		const sentence = `${'A'.repeat(290)}. `;
		const longText = sentence.repeat(30);
		const chunks = chunkText(longText);
		expect(chunks.length).toBeGreaterThan(1);
		for (let i = 0; i < chunks.length; i++) {
			expect(chunks[i].ordinal).toBe(i);
		}
	});

	it('each chunk stays within roughly 2× the target size', () => {
		const sentence = `${'Word '.repeat(80)}. `; // ~405 chars ≈ 101 tokens
		const longText = sentence.repeat(40);
		const chunks = chunkText(longText);
		for (const chunk of chunks) {
			// At most one oversize sentence beyond the target
			expect(chunk.tokenCount).toBeLessThan(1200);
		}
	});

	it('handles text with no sentence-ending punctuation as one chunk (if short enough)', () => {
		const text = 'no punctuation here just words flowing on';
		const chunks = chunkText(text);
		expect(chunks).toHaveLength(1);
		expect(chunks[0].text).toBe(text);
	});

	it('last chunk ordinal equals chunks.length - 1', () => {
		const sentence = `${'B'.repeat(300)}. `;
		const longText = sentence.repeat(20);
		const chunks = chunkText(longText);
		expect(chunks.at(-1)?.ordinal).toBe(chunks.length - 1);
	});
});
