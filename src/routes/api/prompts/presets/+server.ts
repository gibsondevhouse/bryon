import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { apiError, parseJsonBody } from '$lib/server/http';
import { PromptPresetService } from '$lib/server/features/projects/project';

const promptPresetCreateSchema = z.object({
	name: z.string().trim().min(1),
	body: z.string().trim().min(1),
});

export const GET: RequestHandler = async () => {
	return json({ presets: new PromptPresetService().list() });
};

export const POST: RequestHandler = async ({ request }) => {
	const parsed = await parseJsonBody(request, promptPresetCreateSchema);
	if (!parsed.ok) return parsed.response;
	try {
		const preset = new PromptPresetService().create(parsed.data);
		return json({ preset }, { status: 201 });
	} catch (error) {
		return apiError(
			500,
			'PROMPT_PRESET_CREATE_FAILED',
			'Prompt preset could not be created.',
			error instanceof Error ? error.message : String(error),
		);
	}
};
