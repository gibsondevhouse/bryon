import { createHighlighter, type Highlighter } from 'shiki';

/**
 * Singleton Shiki highlighter for the assistant code blocks.
 *
 * Loads one light theme and a small set of commonly-used languages.
 * Highlighter instantiation is async; callers should `await getHighlighter()`.
 * Unknown languages fall back to plain text.
 */
const SUPPORTED_LANGS = [
	'bash',
	'css',
	'diff',
	'go',
	'html',
	'java',
	'javascript',
	'json',
	'jsx',
	'markdown',
	'python',
	'ruby',
	'rust',
	'shell',
	'sql',
	'svelte',
	'toml',
	'tsx',
	'typescript',
	'yaml',
] as const;

const THEME = 'github-light';

let highlighterPromise: Promise<Highlighter> | null = null;

export function getHighlighter(): Promise<Highlighter> {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighter({
			themes: [THEME],
			langs: SUPPORTED_LANGS as unknown as string[],
		});
	}
	return highlighterPromise;
}

const CACHE_MAX = 200;
const cache = new Map<string, string>();

function cacheKey(lang: string, code: string): string {
	return `${lang}::${code}`;
}

/**
 * Highlight a single block of code into Shiki HTML. Returns `null` if the
 * language is not supported (caller should leave the block plain).
 */
export async function highlightToHtml(
	lang: string,
	code: string,
): Promise<string | null> {
	const normalized = lang.toLowerCase().trim();
	if (!normalized || !(SUPPORTED_LANGS as readonly string[]).includes(normalized)) {
		return null;
	}
	const key = cacheKey(normalized, code);
	const hit = cache.get(key);
	if (hit !== undefined) {
		// refresh recency
		cache.delete(key);
		cache.set(key, hit);
		return hit;
	}
	const hi = await getHighlighter();
	const html = hi.codeToHtml(code, { lang: normalized, theme: THEME });
	cache.set(key, html);
	if (cache.size > CACHE_MAX) {
		const firstKey = cache.keys().next().value;
		if (firstKey !== undefined) cache.delete(firstKey);
	}
	return html;
}

export function isSupportedLang(lang: string): boolean {
	return (SUPPORTED_LANGS as readonly string[]).includes(lang.toLowerCase().trim());
}
