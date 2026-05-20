import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse } from 'smol-toml';
import {
	defaultAppSettings,
	defaultLLMParams,
	defaultLLMSettings,
	defaultMemorySettings,
	defaultWebSearchSettings,
	settingsSchema,
} from '../shared/schemas';
import type { Settings } from '../shared/types';
import { isGemma4 } from './llm/vision';
import { getLogger } from './logger';

export type LoadedConfig = {
	config: Settings;
	configPath: string;
	parseError: Error | null;
};

export const defaultConfigPath = join(homedir(), '.config/bryon/config.toml');

export function expandHome(path: string): string {
	if (path === '~') return homedir();
	if (path.startsWith('~/')) return join(homedir(), path.slice(2));
	return path;
}

export function loadConfig(
	path = process.env.BRYON_CONFIG ?? defaultConfigPath,
): LoadedConfig {
	const configPath = expandHome(path);
	let rawConfig: unknown = {};
	let parseError: Error | null = null;

	if (existsSync(configPath)) {
		try {
			rawConfig = parse(readFileSync(configPath, 'utf8'));
		} catch (error) {
			parseError = error instanceof Error ? error : new Error(String(error));
			rawConfig = {};
		}
	}

	let baseConfig = settingsSchema.parse({});
	if (!parseError) {
		try {
			baseConfig = settingsSchema.parse(rawConfig);
		} catch (error) {
			parseError = error instanceof Error ? error : new Error(String(error));
		}
	}
	const config = enforceGemma4(applyEnvOverrides(baseConfig));

	return {
		config: {
			...config,
			app: {
				...config.app,
				data_dir: expandHome(config.app.data_dir),
			},
		},
		configPath,
		parseError,
	};
}

export function writeConfig(
	config: Settings,
	path = process.env.BRYON_CONFIG ?? defaultConfigPath,
): string {
	const configPath = expandHome(path);
	const parsedConfig = settingsSchema.parse(config);
	const tempPath = `${configPath}.tmp`;

	mkdirSync(dirname(configPath), { recursive: true });
	writeFileSync(tempPath, serializeConfig(parsedConfig), 'utf8');
	renameSync(tempPath, configPath);

	return configPath;
}

export function serializeConfig(config: Settings): string {
	return `[app]
host = ${tomlString(config.app.host)}
port = ${config.app.port}
data_dir = ${tomlString(config.app.data_dir)}

[llm]
backend = ${tomlString(config.llm.backend)}
base_url = ${tomlString(config.llm.base_url)}
model = ${tomlString(config.llm.model)}
vision_model = ${tomlString(config.llm.vision_model)}

[llm.params]
temperature = ${config.llm.params.temperature}
top_p = ${config.llm.params.top_p}
top_k = ${config.llm.params.top_k}
repeat_penalty = ${config.llm.params.repeat_penalty}
num_ctx = ${config.llm.params.num_ctx}
num_predict = ${config.llm.params.num_predict}
keep_alive = ${tomlString(config.llm.params.keep_alive)}

[web_search]
enabled = ${config.web_search.enabled}
searxng_url = ${tomlString(config.web_search.searxng_url)}
max_results = ${config.web_search.max_results}

[memory]
enabled = ${config.memory.enabled}
remember = ${tomlString(config.memory.remember)}
never_suggest = ${tomlString(config.memory.never_suggest)}
`;
}

function applyEnvOverrides(config: Settings): Settings {
	return settingsSchema.parse({
		app: {
			host:
				process.env.BRYON_HOST ?? config.app.host ?? defaultAppSettings.host,
			port:
				parseInteger(process.env.BRYON_PORT) ??
				config.app.port ??
				defaultAppSettings.port,
			data_dir:
				process.env.BRYON_DATA_DIR ??
				config.app.data_dir ??
				defaultAppSettings.data_dir,
		},
		llm: {
			backend: 'ollama',
			base_url:
				process.env.BRYON_LLM_BASE_URL ??
				config.llm.base_url ??
				defaultLLMSettings.base_url,
			model:
				process.env.BRYON_LLM_MODEL ??
				config.llm.model ??
				defaultLLMSettings.model,
			vision_model:
				process.env.BRYON_LLM_VISION_MODEL ??
				config.llm.vision_model ??
				defaultLLMSettings.vision_model,
			params: {
				temperature:
					parseNumber(process.env.BRYON_LLM_TEMPERATURE) ??
					config.llm.params.temperature ??
					defaultLLMParams.temperature,
				top_p:
					parseNumber(process.env.BRYON_LLM_TOP_P) ??
					config.llm.params.top_p ??
					defaultLLMParams.top_p,
				top_k:
					parseInteger(process.env.BRYON_LLM_TOP_K) ??
					config.llm.params.top_k ??
					defaultLLMParams.top_k,
				repeat_penalty:
					parseNumber(process.env.BRYON_LLM_REPEAT_PENALTY) ??
					config.llm.params.repeat_penalty ??
					defaultLLMParams.repeat_penalty,
				num_ctx:
					parseInteger(process.env.BRYON_LLM_NUM_CTX) ??
					config.llm.params.num_ctx ??
					defaultLLMParams.num_ctx,
				num_predict:
					parseInteger(process.env.BRYON_LLM_NUM_PREDICT) ??
					config.llm.params.num_predict ??
					defaultLLMParams.num_predict,
				keep_alive:
					process.env.BRYON_LLM_KEEP_ALIVE ??
					config.llm.params.keep_alive ??
					defaultLLMParams.keep_alive,
			},
		},
		web_search: {
			enabled:
				parseBoolean(process.env.BRYON_WEB_SEARCH_ENABLED) ??
				config.web_search.enabled ??
				defaultWebSearchSettings.enabled,
			searxng_url:
				process.env.BRYON_SEARXNG_URL ??
				config.web_search.searxng_url ??
				defaultWebSearchSettings.searxng_url,
			max_results:
				parseInteger(process.env.BRYON_WEB_SEARCH_MAX_RESULTS) ??
				config.web_search.max_results ??
				defaultWebSearchSettings.max_results,
		},
		memory: {
			enabled:
				parseBoolean(process.env.BRYON_MEMORY_ENABLED) ??
				config.memory.enabled ??
				defaultMemorySettings.enabled,
			remember:
				process.env.BRYON_MEMORY_REMEMBER ??
				config.memory.remember ??
				defaultMemorySettings.remember,
			never_suggest:
				process.env.BRYON_MEMORY_NEVER_SUGGEST ??
				config.memory.never_suggest ??
				defaultMemorySettings.never_suggest,
		},
	});
}

function parseBoolean(value: string | undefined): boolean | null {
	if (!value) return null;
	if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
	if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
	return null;
}

function parseInteger(value: string | undefined): number | null {
	if (!value) return null;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseNumber(value: string | undefined): number | null {
	if (!value) return null;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function tomlString(value: string): string {
	return JSON.stringify(value);
}

/**
 * Bryon v1 is locked to the Gemma 4 family. If config or env vars point at
 * anything else, log a warning and substitute the default Gemma 4 tag so the
 * app stays usable instead of failing closed at boot.
 */
function enforceGemma4(config: Settings): Settings {
	const warnings: Array<{ field: string; value: string; replacement: string }> =
		[];

	const model = isGemma4(config.llm.model)
		? config.llm.model
		: (warnings.push({
				field: 'llm.model',
				value: config.llm.model,
				replacement: defaultLLMSettings.model,
			}),
			defaultLLMSettings.model);

	const visionModel = isGemma4(config.llm.vision_model)
		? config.llm.vision_model
		: (warnings.push({
				field: 'llm.vision_model',
				value: config.llm.vision_model,
				replacement: defaultLLMSettings.vision_model,
			}),
			defaultLLMSettings.vision_model);

	if (warnings.length > 0) {
		for (const w of warnings) {
			getLogger().warn(
				{ field: w.field, value: w.value, replacement: w.replacement },
				'config: non-Gemma-4 model rejected; using default',
			);
		}
	}

	if (model === config.llm.model && visionModel === config.llm.vision_model) {
		return config;
	}
	return {
		...config,
		llm: { ...config.llm, model, vision_model: visionModel },
	};
}
