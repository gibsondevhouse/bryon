import type { WebSearchSettings } from '$lib/shared/types';

export type WebSearchResult = {
	title: string;
	url: string;
	snippet: string;
};

export type WebSearchResponse = {
	query: string;
	provider: 'searxng' | 'duckduckgo';
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

type DuckDuckGoResponse = {
	Abstract?: string;
	AbstractURL?: string;
	AbstractSource?: string;
	Answer?: string;
	Definition?: string;
	DefinitionURL?: string;
	DefinitionSource?: string;
	RelatedTopics?: Array<{
		Text?: string;
		FirstURL?: string;
		Topics?: Array<{ Text?: string; FirstURL?: string }>;
	}>;
	Results?: Array<{ Text?: string; FirstURL?: string }>;
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
					const fallback = await searchDuckDuckGo({
						query,
						maxResults: this.settings.max_results,
						signal,
					});
					return {
						...fallback,
						warning: `SearXNG failed; used DuckDuckGo Instant Answers as fallback. ${(error as Error).message}`,
					};
				} catch {
					throw error;
				}
			}
		}

		return searchDuckDuckGo({
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
				`${index + 1}. ${result.title}${result.snippet ? ` (${result.snippet})` : ''}\nURL: ${result.url}`,
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

async function searchDuckDuckGo(input: {
	query: string;
	maxResults: number;
	signal?: AbortSignal;
}): Promise<WebSearchResponse> {
	const url = new URL('https://api.duckduckgo.com/');
	url.searchParams.set('q', input.query);
	url.searchParams.set('format', 'json');
	url.searchParams.set('no_html', '1');
	url.searchParams.set('skip_disambig', '1');

	const response = await fetch(url, {
		headers: { 'user-agent': 'Bryon/1.0 rich chat client' },
		signal: input.signal,
	});

	if (!response.ok) {
		throw new WebSearchError(
			`DuckDuckGo Instant Answers returned HTTP ${response.status}.`,
			'WEB_SEARCH_FAILED',
		);
	}

	const data = (await response.json()) as DuckDuckGoResponse;
	const results: WebSearchResult[] = [];

	if (data.Abstract?.trim() && data.AbstractURL?.trim()) {
		results.push({
			title: data.AbstractSource?.trim() || 'DuckDuckGo abstract',
			url: data.AbstractURL.trim(),
			snippet: data.Abstract.trim(),
		});
	}
	if (
		results.length < input.maxResults &&
		data.Definition?.trim() &&
		data.DefinitionURL?.trim()
	) {
		results.push({
			title: data.DefinitionSource?.trim() || 'DuckDuckGo definition',
			url: data.DefinitionURL.trim(),
			snippet: data.Definition.trim(),
		});
	}
	for (const result of data.Results ?? []) {
		if (results.length >= input.maxResults) break;
		if (result.Text?.trim() && result.FirstURL?.trim()) {
			results.push({
				title: firstSentence(result.Text),
				url: result.FirstURL.trim(),
				snippet: result.Text.trim(),
			});
		}
	}
	for (const topic of data.RelatedTopics ?? []) {
		if (results.length >= input.maxResults) break;
		appendDuckDuckGoTopic(results, topic, input.maxResults);
	}

	return {
		query: input.query,
		provider: 'duckduckgo',
		results: results.slice(0, input.maxResults),
		answer: data.Answer?.trim() || null,
		warning:
			results.length === 0
				? 'DuckDuckGo Instant Answers returned no usable related results. Try different keywords or configure SearXNG for broader web search.'
				: null,
	};
}

function appendDuckDuckGoTopic(
	results: WebSearchResult[],
	topic: NonNullable<DuckDuckGoResponse['RelatedTopics']>[number],
	maxResults: number,
): void {
	if (results.length >= maxResults) return;
	if (topic.Text?.trim() && topic.FirstURL?.trim()) {
		results.push({
			title: firstSentence(topic.Text),
			url: topic.FirstURL.trim(),
			snippet: topic.Text.trim(),
		});
		return;
	}
	for (const child of topic.Topics ?? []) {
		if (results.length >= maxResults) return;
		if (child.Text?.trim() && child.FirstURL?.trim()) {
			results.push({
				title: firstSentence(child.Text),
				url: child.FirstURL.trim(),
				snippet: child.Text.trim(),
			});
		}
	}
}

function firstSentence(value: string): string {
	const trimmed = value.trim();
	const sentence = trimmed.match(/^(.{1,120}?)(?:[.!?]\s|$)/)?.[1]?.trim();
	return sentence || trimmed.slice(0, 120);
}

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, '');
}
