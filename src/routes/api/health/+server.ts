import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadConfig } from '$lib/server/config';
import { getSqlite } from '$lib/server/db/client';
import { checkModelReadiness } from '$lib/server/llm/readiness';
import { getRuntimeReadiness } from '$lib/server/runtime/readiness';

export const GET: RequestHandler = async () => {
	const { config, configPath, parseError } = loadConfig();
	const db = checkDb();
	const modelReadiness = await checkModelReadiness({
		baseUrl: config.llm.base_url,
		models: {
			chat: config.llm.model,
			vision: config.llm.vision_model,
		},
	});
	const chatModel = modelReadiness.entries.find((entry) => entry.slot === 'chat');
	const runtime = getRuntimeReadiness();

	return json({
		db,
		ollama: modelReadiness.reachable,
		model: {
			name: config.llm.model,
			present: chatModel?.present ?? false,
		},
		models: {
			allPresent: modelReadiness.allPresent,
			entries: modelReadiness.entries,
			missing: modelReadiness.missing,
			missingCommands: modelReadiness.missing.map((entry) => entry.pullCommand),
			error: modelReadiness.error,
		},
		runtime,
		config: {
			path: configPath,
			parseError: parseError?.message ?? null,
		},
	});
};

function checkDb(): boolean {
	try {
		getSqlite().prepare('select 1').get();
		return true;
	} catch {
		return false;
	}
}
