import { z } from 'zod';
import { loadConfig } from '$lib/server/config';
import { RetrievalService } from '$lib/server/kb/retrieval';
import { toolRegistry } from '../registry';

const searchKbArgsSchema = z.object({
	query: z.string().min(1).describe('The search query'),
	collection: z.string().min(1).optional().describe('Limit results to a specific collection name'),
	k: z.number().int().min(1).max(20).optional().describe('Number of results to return (default 8)'),
});

const searchKbResultSchema = z.object({
	results: z.array(
		z.object({
			text: z.string(),
			source: z.string(),
			page: z.number().nullable(),
			score: z.number(),
		}),
	),
	query: z.string(),
	totalFound: z.number().int(),
	degraded: z
		.object({
			code: z.literal('VECTOR_UNAVAILABLE'),
			message: z.string(),
			fallback: z.literal('bm25'),
			detail: z.string(),
		})
		.nullable()
		.optional(),
});

toolRegistry.register({
	name: 'search_kb',
	description:
		'Search the local knowledge base for relevant text chunks. Returns the most relevant passages with source attribution. Use this before answering questions that may be covered by local documents.',
	parameters: searchKbArgsSchema,
	returns: searchKbResultSchema,
	async execute(args, ctx) {
		const { config } = loadConfig();
		const service = new RetrievalService();

		const retrieval = await service.query({
			baseUrl: config.llm.base_url,
			embeddingModel: config.llm.model,
			query: args.query,
			collection: args.collection,
			k: args.k ?? 8,
			signal: ctx.signal,
		});

		const results = retrieval.chunks.map((c) => ({
			text: c.text,
			source: c.documentTitle
				? `${c.documentTitle} (${c.documentPath})`
				: c.documentPath,
			page: c.page,
			score: Math.round(c.score * 1000) / 1000,
		}));

		return {
			results,
			query: args.query,
			totalFound: results.length,
			degraded: retrieval.degraded,
		};
	},
});
