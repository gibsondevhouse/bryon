import { z } from 'zod';
import { toolRegistry } from '../registry';

type DdgResponse = {
	Abstract?: string;
	AbstractURL?: string;
	AbstractSource?: string;
	Answer?: string;
	AnswerType?: string;
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

const webSearchArgsSchema = z.object({
	query: z.string().min(1).describe('The search query'),
	maxResults: z
		.number()
		.int()
		.min(1)
		.max(10)
		.optional()
		.describe('Maximum number of related results to return (default: 5)'),
});

const webSearchResultSchema = z.object({
	answer: z.string().nullable(),
	abstract: z
		.object({
			text: z.string(),
			url: z.string(),
			source: z.string(),
		})
		.nullable(),
	definition: z
		.object({
			text: z.string(),
			url: z.string(),
			source: z.string(),
		})
		.nullable(),
	results: z.array(
		z.object({
			text: z.string(),
			url: z.string(),
		}),
	),
	query: z.string(),
});

toolRegistry.register({
	name: 'web_search',
	description:
		'Search the web using DuckDuckGo. Returns instant answers, abstracts, and related results. Best for factual questions, current events, and topics not covered by the local knowledge base.',
	parameters: webSearchArgsSchema,
	returns: webSearchResultSchema,
	async execute(args, ctx) {
		const url = new URL('https://api.duckduckgo.com/');
		url.searchParams.set('q', args.query);
		url.searchParams.set('format', 'json');
		url.searchParams.set('no_html', '1');
		url.searchParams.set('skip_disambig', '1');

		const res = await fetch(url, {
			signal: ctx.signal,
			headers: { 'User-Agent': 'Bryon/1.5 (local AI assistant; research mode)' },
		});

		if (!res.ok) {
			throw new Error(`DuckDuckGo API returned ${res.status}: ${res.statusText}`);
		}

		const data = (await res.json()) as DdgResponse;
		const maxResults = args.maxResults ?? 5;

		const answer = data.Answer?.trim() || null;

		const abstract =
			data.Abstract?.trim()
				? {
						text: data.Abstract.trim(),
						url: data.AbstractURL ?? '',
						source: data.AbstractSource ?? '',
					}
				: null;

		const definition =
			data.Definition?.trim()
				? {
						text: data.Definition.trim(),
						url: data.DefinitionURL ?? '',
						source: data.DefinitionSource ?? '',
					}
				: null;

		const results: Array<{ text: string; url: string }> = [];

		for (const r of data.Results ?? []) {
			if (results.length >= maxResults) break;
			if (r.Text && r.FirstURL) {
				results.push({ text: r.Text, url: r.FirstURL });
			}
		}

		for (const topic of data.RelatedTopics ?? []) {
			if (results.length >= maxResults) break;
			if (topic.Text && topic.FirstURL) {
				results.push({ text: topic.Text, url: topic.FirstURL });
			} else if (topic.Topics) {
				for (const sub of topic.Topics) {
					if (results.length >= maxResults) break;
					if (sub.Text && sub.FirstURL) {
						results.push({ text: sub.Text, url: sub.FirstURL });
					}
				}
			}
		}

		return { answer, abstract, definition, results, query: args.query };
	},
});
