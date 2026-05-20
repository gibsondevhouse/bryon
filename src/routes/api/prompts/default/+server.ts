import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody } from '$lib/server/http';
import { defaultPersona } from '$lib/server/default-persona';
import { PersonaService } from '$lib/server/features/personas/persona';

const defaultPromptPatchSchema = z.object({
	systemPrompt: z.string().trim().min(1),
});

export const GET: RequestHandler = async () => {
	const service = new PersonaService();
	const persona = service.get(defaultPersona.id) ?? service.getFirst();
	if (!persona) {
		return apiError(404, 'DEFAULT_PROMPT_NOT_FOUND', 'Default Bryon prompt not found.');
	}
	return json({ prompt: persona.systemPrompt, persona });
};

export const PATCH: RequestHandler = async ({ request }) => {
	const parsed = await parseJsonBody(request, defaultPromptPatchSchema);
	if (!parsed.ok) return parsed.response;

	const service = new PersonaService();
	const persona = service.update(defaultPersona.id, {
		systemPrompt: parsed.data.systemPrompt,
	});
	if (!persona) {
		return apiError(404, 'DEFAULT_PROMPT_NOT_FOUND', 'Default Bryon prompt not found.');
	}
	return json({ prompt: persona.systemPrompt, persona });
};
