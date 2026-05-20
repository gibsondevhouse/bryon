import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody } from '$lib/server/http';
import { PromptPresetService } from '$lib/server/features/projects/project';

const promptPresetPatchSchema = z.object({
	name: z.string().trim().min(1).optional(),
	body: z.string().trim().min(1).optional(),
});

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, promptPresetPatchSchema);
	if (!parsed.ok) return parsed.response;
	const preset = new PromptPresetService().update(params.id, parsed.data);
	if (!preset) return apiError(404, 'PROMPT_PRESET_NOT_FOUND', 'Prompt preset not found.');
	return json({ preset });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const deleted = new PromptPresetService().delete(params.id);
	if (!deleted) return apiError(404, 'PROMPT_PRESET_NOT_FOUND', 'Prompt preset not found.');
	return new Response(null, { status: 204 });
};
