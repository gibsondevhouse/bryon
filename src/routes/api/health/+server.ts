import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOllamaSupervisor } from '$lib/server/llm/supervisor';

export const GET: RequestHandler = async () => {
	const supervisor = getOllamaSupervisor();
	return json({
		ollama: supervisor.getState(),
	});
};
