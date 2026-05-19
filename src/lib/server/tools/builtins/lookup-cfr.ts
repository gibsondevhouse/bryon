import { z } from 'zod';
import { toolRegistry } from '../registry';

type EcfrResult = {
	full_text_excerpt?: string;
	section_heading?: string;
	hierarchy_headings?: {
		title?: string;
		part?: string;
		section?: string;
	};
	document_url?: string;
	title?: string;
	part?: string;
	section?: string;
};

type EcfrResponse = {
	results?: EcfrResult[];
};

const lookupCfrArgsSchema = z.object({
	query: z
		.string()
		.min(1)
		.describe(
			'CFR citation (e.g. "29 CFR 1910.134") or keyword search. Include the title, part, and section when known.',
		),
	title: z.number().int().min(1).max(50).optional().describe('CFR title number (e.g. 29 for OSHA, 40 for EPA)'),
	part: z.number().int().min(1).optional().describe('CFR part number (e.g. 1910)'),
	section: z.string().optional().describe('CFR section (e.g. "134" or "134.a")'),
});

const lookupCfrResultSchema = z.object({
	results: z.array(
		z.object({
			heading: z.string(),
			citation: z.string(),
			excerpt: z.string(),
			url: z.string(),
		}),
	),
	query: z.string(),
	count: z.number().int(),
});

toolRegistry.register({
	name: 'lookup_cfr',
	description:
		'Look up a US Code of Federal Regulations (CFR) citation via the eCFR API. Use for OSHA, EPA, DOT, and other US federal regulatory citations. Returns section headings, text excerpts, and direct links.',
	parameters: lookupCfrArgsSchema,
	returns: lookupCfrResultSchema,
	async execute(args, ctx) {
		let searchQuery = args.query;
		if (args.title !== undefined || args.part !== undefined) {
			const cite = [
				args.title !== undefined ? `${args.title} CFR` : '',
				args.part !== undefined ? String(args.part) : '',
				args.section ? `.${args.section}` : '',
			]
				.filter(Boolean)
				.join(' ');
			searchQuery = cite + (args.query && args.query !== cite ? ` ${args.query}` : '');
		}

		const url = new URL('https://www.ecfr.gov/api/search/v1/results');
		url.searchParams.set('query', searchQuery.trim());
		url.searchParams.set('per_page', '5');

		const res = await fetch(url, {
			signal: ctx.signal,
			headers: { accept: 'application/json' },
		});

		if (!res.ok) {
			throw new Error(`eCFR API returned ${res.status}: ${res.statusText}`);
		}

		const data = (await res.json()) as EcfrResponse;

		const results = (data.results ?? []).map((r) => {
			const headings = r.hierarchy_headings ?? {};
			const citation = [
				headings.title ? `Title ${r.title ?? headings.title}` : '',
				headings.part ? `Part ${r.part ?? headings.part}` : '',
				r.section ? `§ ${r.section}` : '',
			]
				.filter(Boolean)
				.join(', ');

			return {
				heading: r.section_heading ?? headings.section ?? '',
				citation,
				excerpt: stripHtml(r.full_text_excerpt ?? ''),
				url: r.document_url ? `https://www.ecfr.gov${r.document_url}` : '',
			};
		});

		return { results, query: searchQuery.trim(), count: results.length };
	},
});

function stripHtml(html: string): string {
	return html
		.replace(/<[^>]+>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}
