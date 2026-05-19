import type { WebSearchSettings } from '$lib/shared/types';

export type WebSearchResult = {
	title: string;
	url: string;
	snippet: string;
};

export type WebSearchResponse = {
	query: string;
	provider: 'searxng' | 'duckduckgo' | 'google_news';
	results: WebSearchResult[];
	answer?: string | null;
	warning?: string | null;
};

type SearxngResponse = {
	results?: Array<{
		title?: string;
		url?: string;
		content?: string;
		engine?: string;
	}>;
	answers?: string[];
	infoboxes?: Array<{ content?: string }>;
};


export class WebSearchError extends Error {
	constructor(
		message: string,
		readonly code: 'WEB_SEARCH_DISABLED' | 'WEB_SEARCH_FAILED',
		readonly cause?: unknown,
	) {
		super(message);
		this.name = 'WebSearchError';
	}
}

export class WebSearchService {
	constructor(private readonly settings: WebSearchSettings) {}

	async search(query: string, signal?: AbortSignal): Promise<WebSearchResponse> {
		if (!this.settings.enabled) {
			throw new WebSearchError(
				'Web lookup is disabled in Settings.',
				'WEB_SEARCH_DISABLED',
			);
		}

		const searxngUrl = this.settings.searxng_url.trim();
		if (searxngUrl) {
			try {
				return await searchSearxng({
					baseUrl: searxngUrl,
					query,
					maxResults: this.settings.max_results,
					signal,
				});
			} catch (error) {
				try {
					const fallback = await searchGoogleNewsRss({
						query,
						maxResults: this.settings.max_results,
						signal,
					});
					return {
						...fallback,
						warning: `SearXNG failed; used Google News as fallback. ${(error as Error).message}`,
					};
				} catch {
					throw error;
				}
			}
		}

		return searchGoogleNewsRss({
			query,
			maxResults: this.settings.max_results,
			signal,
		});
	}
}

export function formatWebSearchForPrompt(response: WebSearchResponse): string {
	const providerLabel: Record<WebSearchResponse['provider'], string> = {
		searxng: 'SearXNG',
		duckduckgo: 'DuckDuckGo',
		google_news: 'Google News',
	};
	const lines = [
		`Web search results for: "${response.query}"`,
		`Provider: ${providerLabel[response.provider]}`,
	];

	if (response.warning) lines.push(`Warning: ${response.warning}`);
	if (response.answer) lines.push(`Direct answer: ${response.answer}`);

	if (response.results.length === 0) {
		lines.push('No usable web results were returned.');
	} else {
		lines.push(
			`Use these ${response.results.length} results as background context. Write a thorough, analytical response — synthesize what they reveal, explain the key themes and their significance, and draw conclusions. Reference sources by outlet name when helpful (e.g. "According to Reuters...") but do NOT paste raw URLs into your response. The article links will be shown to the user separately as cards.`,
		);
		lines.push('Results:');
		for (const [index, result] of response.results.entries()) {
			lines.push(
				`${index + 1}. ${result.title}${result.snippet ? ` (${result.snippet})` : ''}`,
			);
		}
	}

	return lines.join('\n\n');
}

async function searchSearxng(input: {
	baseUrl: string;
	query: string;
	maxResults: number;
	signal?: AbortSignal;
}): Promise<WebSearchResponse> {
	const url = new URL('/search', trimTrailingSlash(input.baseUrl));
	url.searchParams.set('q', input.query);
	url.searchParams.set('format', 'json');

	const response = await fetch(url, {
		headers: { accept: 'application/json' },
		signal: input.signal,
	});

	if (!response.ok) {
		throw new WebSearchError(
			`SearXNG returned HTTP ${response.status}.`,
			'WEB_SEARCH_FAILED',
		);
	}

	const data = (await response.json()) as SearxngResponse;
	const results = (data.results ?? [])
		.flatMap((item): WebSearchResult[] => {
			const title = item.title?.trim();
			const url = item.url?.trim();
			if (!title || !url) return [];
			return [
				{
					title,
					url,
					snippet: item.content?.trim() ?? '',
				},
			];
		})
		.slice(0, input.maxResults);

	return {
		query: input.query,
		provider: 'searxng',
		answer: data.answers?.find((answer) => answer.trim().length > 0) ?? null,
		results,
		warning: null,
	};
}

async function searchGoogleNewsRss(input: {
	query: string;
	maxResults: number;
	signal?: AbortSignal;
}): Promise<WebSearchResponse> {
	const url = `https://news.google.com/rss/search?q=${encodeURIComponent(input.query)}&hl=en-US&gl=US&ceid=US:en`;

	const response = await fetch(url, {
		headers: { 'user-agent': 'Bryon/1.0 rich chat client' },
		signal: input.signal,
	});

	if (!response.ok) {
		throw new WebSearchError(
			`Google News RSS returned HTTP ${response.status}.`,
			'WEB_SEARCH_FAILED',
		);
	}

	const xml = await response.text();
	const results: WebSearchResult[] = [];
	const itemRegex = /<item>([\s\S]*?)<\/item>/g;
	let match: RegExpExecArray | null;

	while ((match = itemRegex.exec(xml)) !== null && results.length < input.maxResults) {
		const item = match[1];
		const link = extractRssField(item, 'link');
		if (!link?.startsWith('http')) continue;

		const rawTitle = extractRssField(item, 'title') ?? '';
		const lastDash = rawTitle.lastIndexOf(' - ');
		const title = lastDash >= 0 ? rawTitle.slice(0, lastDash).trim() : rawTitle.trim();
		const source = lastDash >= 0 ? rawTitle.slice(lastDash + 3).trim() : '';

		if (!title) continue;
		results.push({ title, url: link, snippet: source });
	}

	return {
		query: input.query,
		provider: 'google_news',
		results,
		answer: null,
		warning:
			results.length === 0
				? 'No news results found for this query. Try different keywords.'
				: null,
	};
}

function extractRssField(item: string, field: string): string | null {
	const m = item.match(
		new RegExp(`<${field}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${field}>`),
	);
	if (!m) return null;
	return decodeXmlEntities(m[1].trim());
}

function decodeXmlEntities(s: string): string {
	return s
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'");
}

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, '');
}
