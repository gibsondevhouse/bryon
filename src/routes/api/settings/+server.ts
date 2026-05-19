import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { loadConfig, writeConfig } from '$lib/server/config';
import { apiError, parseJsonBody } from '$lib/server/http';
import {
	appSettingsSchema,
	llmParamsSchema,
	llmSettingsSchema,
	memorySettingsSchema,
	settingsSchema,
	webSearchSettingsSchema,
} from '$lib/shared/schemas';

const settingsPatchSchema = z.object({
	app: appSettingsSchema.partial().optional(),
	llm: llmSettingsSchema
		.omit({ params: true })
		.partial()
		.extend({
			params: llmParamsSchema.partial().optional(),
		})
		.optional(),
	web_search: webSearchSettingsSchema.partial().optional(),
	memory: memorySettingsSchema.partial().optional(),
});

export const GET: RequestHandler = async () => {
	const loaded = loadConfig();
	return json({
		settings: loaded.config,
		configPath: loaded.configPath,
		parseError: loaded.parseError?.message ?? null,
	});
};

export const PATCH: RequestHandler = async ({ request }) => {
	const parsed = await parseJsonBody(request, settingsPatchSchema);
	if (!parsed.ok) return parsed.response;

	const loaded = loadConfig();
	const nextSettings = settingsSchema.parse({
		app: {
			...loaded.config.app,
			...parsed.data.app,
		},
		llm: {
			...loaded.config.llm,
			...parsed.data.llm,
			params: {
				...loaded.config.llm.params,
				...parsed.data.llm?.params,
			},
		},
		web_search: {
			...loaded.config.web_search,
			...parsed.data.web_search,
		},
		memory: {
			...loaded.config.memory,
			...parsed.data.memory,
		},
	});

	try {
		const configPath = writeConfig(nextSettings, loaded.configPath);
		return json({ settings: nextSettings, configPath });
	} catch (error) {
		return apiError(
			500,
			'SETTINGS_WRITE_FAILED',
			'Settings could not be written.',
			error instanceof Error ? error.message : String(error),
		);
	}
};
