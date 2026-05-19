export type ModelSlot = 'chat' | 'vision';

export type ModelReadinessEntry = {
	slot: ModelSlot;
	model: string;
	present: boolean;
	pullCommand: string;
};

export type ModelReadinessReport = {
	reachable: boolean;
	entries: ModelReadinessEntry[];
	missing: ModelReadinessEntry[];
	allPresent: boolean;
	error: string | null;
};

type OllamaTagsResponse = {
	models?: Array<{ name?: string; model?: string }>;
};

export async function checkModelReadiness(input: {
	baseUrl: string;
	models: {
		chat: string;
		vision: string;
	};
	timeoutMs?: number;
}): Promise<ModelReadinessReport> {
	const tags = await fetchOllamaModelNames(input.baseUrl, input.timeoutMs ?? 1_500);
	const entries: ModelReadinessEntry[] = [
		buildEntry('chat', input.models.chat, tags),
		buildEntry('vision', input.models.vision, tags),
	];
	const missing = entries.filter((entry) => !entry.present);

	return {
		reachable: tags.reachable,
		entries,
		missing,
		allPresent: tags.reachable && missing.length === 0,
		error: tags.error,
	};
}

export async function fetchOllamaModelNames(
	baseUrl: string,
	timeoutMs = 1_500,
): Promise<{ reachable: boolean; names: Set<string>; error: string | null }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(new URL('/api/tags', baseUrl), {
			signal: controller.signal,
		});
		if (!response.ok) {
			return {
				reachable: false,
				names: new Set(),
				error: `HTTP ${response.status}`,
			};
		}

		const tags = (await response.json()) as OllamaTagsResponse;
		const names = new Set<string>();
		for (const model of tags.models ?? []) {
			if (model.name) names.add(model.name);
			if (model.model) names.add(model.model);
		}
		return { reachable: true, names, error: null };
	} catch (error) {
		return {
			reachable: false,
			names: new Set(),
			error: (error as Error).message,
		};
	} finally {
		clearTimeout(timeout);
	}
}

function buildEntry(
	slot: ModelSlot,
	model: string,
	tags: { reachable: boolean; names: Set<string> },
): ModelReadinessEntry {
	return {
		slot,
		model,
		present: tags.reachable ? tags.names.has(model) : false,
		pullCommand: `ollama pull ${model}`,
	};
}
