import { describe, expect, it } from 'vitest';
import { stabilizeMarkdown } from './streaming-markdown';

describe('stabilizeMarkdown', () => {
	// ── Fenced code blocks ─────────────────────────────────────────────────

	it('seals an open fenced code block', () => {
		const input = '```typescript\nconst x = 1';
		const result = stabilizeMarkdown(input);
		expect(result).toBe('```typescript\nconst x = 1\n```');
	});

	it('leaves a complete fenced code block unchanged', () => {
		const input = '```typescript\nconst x = 1\n```';
		expect(stabilizeMarkdown(input)).toBe(input);
	});

	it('does not double-close when the last char is already a newline', () => {
		const input = '```typescript\nconst x = 1\n';
		const result = stabilizeMarkdown(input);
		expect(result).toBe('```typescript\nconst x = 1\n```');
	});

	it('leaves two complete fenced blocks unchanged', () => {
		const input = '```js\nfoo\n```\n\n```ts\nbar\n```';
		expect(stabilizeMarkdown(input)).toBe(input);
	});

	it('seals the third (open) fence when three are present', () => {
		const input = '```js\nfoo\n```\n\n```ts\nbar';
		const result = stabilizeMarkdown(input);
		expect(result.endsWith('\n```')).toBe(true);
		// Count fences in result — must be even
		const count = (result.match(/^```/gm) ?? []).length;
		expect(count % 2).toBe(0);
	});

	// ── Inline code spans ──────────────────────────────────────────────────

	it('closes an open inline backtick', () => {
		const input = 'Use `foo to do something';
		const result = stabilizeMarkdown(input);
		expect(result).toBe('Use `foo to do something`');
	});

	it('leaves a closed inline code span unchanged', () => {
		const input = 'Use `foo` to do something';
		expect(stabilizeMarkdown(input)).toBe(input);
	});

	it('does not close inline backtick when a fence is open', () => {
		// The fence takes priority; inline backtick inside an open fence is not a span
		const input = '```\n`inner';
		const result = stabilizeMarkdown(input);
		expect(result).toBe('```\n`inner\n```');
	});

	// ── Pass-through cases ─────────────────────────────────────────────────

	it('returns empty string unchanged', () => {
		expect(stabilizeMarkdown('')).toBe('');
	});

	it('returns plain prose unchanged', () => {
		const input = 'Hello world, this is plain text.';
		expect(stabilizeMarkdown(input)).toBe(input);
	});
});
