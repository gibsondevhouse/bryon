import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadConfig } from '$lib/server/config';
import { getOllamaSupervisor } from '$lib/server/llm/supervisor';
import { checkModelReadiness } from '$lib/server/llm/readiness';
import { getRuntimeReadiness } from '$lib/server/runtime/readiness';

export const GET: RequestHandler = async () => {
	const supervisor = getOllamaSupervisor();
	const { config, configPath, parseError } = loadConfig();
	const reachable = await supervisor.probe(true);
	const ollamaState = supervisor.getState();
	const models = await checkModelReadiness({
		baseUrl: config.llm.base_url,
		models: {
			chat: config.llm.model,
			vision: config.llm.vision_model,
		},
		timeoutMs: 1500,
	});

	return json({
		db: true,
		ollama: reachable,
		ollamaState,
		models,
		config: {
			path: configPath,
			parseError: parseError?.message ?? null,
		},
		readiness: getRuntimeReadiness(),
	});
};
