import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadConfig } from '$lib/server/config';

type OllamaModel = { name: string; modified_at?: string; size?: number };
type OllamaTagsResponse = { models?: OllamaModel[] };

export const GET: RequestHandler = async () => {
	const { config } = loadConfig();
	try {
		const response = await fetch(`${config.llm.base_url}/api/tags`, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(3000),
		});
		if (!response.ok) return json({ models: [] });
		const data = (await response.json()) as OllamaTagsResponse;
		const models = (data.models ?? []).map((m) => m.name).sort();
		return json({ models });
	} catch {
		return json({ models: [] });
	}
};
