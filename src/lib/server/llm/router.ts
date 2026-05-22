import { randomUUID } from 'node:crypto';
import { routingLogs } from '$lib/server/db/schema';
import { getDb } from '$lib/server/db/client';
import type { Settings } from '$lib/shared/types';

export type ModelTaskType =
	| 'classification'
	| 'chat'
	| 'summarization'
	| 'plan_generation'
	| 'project_expansion'
	| 'sync'
	| 'agent_instructions';

export type PrivacyDecision =
	| 'allowed_local'
	| 'allowed_remote'
	| 'blocked_local_only'
	| 'tier3_disabled_fallback'
	| 'remote_preview_required_fallback'
	| 'chat_pin';

export type RoutingDecision = {
	taskType: ModelTaskType;
	tier: 1 | 2 | 3 | 4;
	model: string;
	remote: boolean;
	privacyDecision: PrivacyDecision;
	blocked: boolean;
	reason: string | null;
};

export type RouteModelInput = {
	config: Settings;
	taskType: ModelTaskType;
	localOnly?: boolean;
	hasImageAttachment?: boolean;
	chatPinnedModel?: string | null;
	highestQuality?: boolean;
	preferRemote?: boolean;
	remoteApproved?: boolean;
};

const HEAVY_TASKS = new Set<ModelTaskType>([
	'summarization',
	'plan_generation',
	'project_expansion',
	'sync',
	'agent_instructions',
]);

export function routeModel(input: RouteModelInput): RoutingDecision {
	const localOnly = input.localOnly ?? false;

	if (input.hasImageAttachment) {
		return localDecision(input.taskType, 1, input.config.llm.vision_model);
	}

	if (input.chatPinnedModel) {
		return {
			taskType: input.taskType,
			tier: 1,
			model: input.chatPinnedModel,
			remote: false,
			privacyDecision: 'chat_pin',
			blocked: false,
			reason: null,
		};
	}

	if (input.taskType === 'classification') {
		return localDecision(input.taskType, 1, input.config.llm.small_model);
	}

	if (input.taskType === 'chat' && !input.highestQuality && !input.preferRemote) {
		return localDecision(input.taskType, 1, input.config.llm.small_model);
	}

	if (localOnly) {
		return localDecision(input.taskType, HEAVY_TASKS.has(input.taskType) ? 2 : 1, HEAVY_TASKS.has(input.taskType)
			? input.config.llm.large_model
			: input.config.llm.small_model);
	}

	if (
		(input.highestQuality || input.preferRemote)
		&& input.config.privacy.require_remote_preview
		&& !input.remoteApproved
	) {
		return {
			taskType: input.taskType,
			tier: 2,
			model: input.config.llm.large_model,
			remote: false,
			privacyDecision: 'remote_preview_required_fallback',
			blocked: false,
			reason: 'Remote preview is required; using local Tier 2 until approved.',
		};
	}

	if (input.highestQuality && input.config.llm.gemini_api.enabled) {
		return {
			taskType: input.taskType,
			tier: 4,
			model: input.config.llm.gemini_api.model,
			remote: true,
			privacyDecision: 'allowed_remote',
			blocked: false,
			reason: null,
		};
	}

	if (input.preferRemote) {
		if (!input.config.privacy.tier3_enabled) {
			return {
				taskType: input.taskType,
				tier: 2,
				model: input.config.llm.large_model,
				remote: false,
				privacyDecision: 'tier3_disabled_fallback',
				blocked: false,
				reason: 'Tier 3 is disabled; using local Tier 2.',
			};
		}
		return {
			taskType: input.taskType,
			tier: 3,
			model: input.config.llm.flash_model,
			remote: true,
			privacyDecision: 'allowed_remote',
			blocked: false,
			reason: null,
		};
	}

	return localDecision(
		input.taskType,
		HEAVY_TASKS.has(input.taskType) ? 2 : 1,
		HEAVY_TASKS.has(input.taskType)
			? input.config.llm.large_model
			: input.config.llm.small_model,
	);
}

export function refuseRemoteForLocalOnly(input: {
	taskType: ModelTaskType;
	model: string;
	tier: 3 | 4;
}): RoutingDecision {
	return {
		taskType: input.taskType,
		tier: input.tier,
		model: input.model,
		remote: true,
		privacyDecision: 'blocked_local_only',
		blocked: true,
		reason: 'Local-only content cannot be sent to a remote model tier.',
	};
}

export function logRoutingDecision(
	decision: RoutingDecision,
	input: {
		tokensIn?: number | null;
		tokensOut?: number | null;
		errorCode?: string | null;
	} = {},
): void {
	getDb().insert(routingLogs).values({
		id: randomUUID(),
		taskType: decision.taskType,
		tier: decision.tier,
		model: decision.model,
		remote: decision.remote ? 1 : 0,
		privacyDecision: decision.privacyDecision,
		tokensIn: input.tokensIn ?? null,
		tokensOut: input.tokensOut ?? null,
		errorCode: input.errorCode ?? null,
		createdAt: Date.now(),
	}).run();
}

function localDecision(
	taskType: ModelTaskType,
	tier: 1 | 2,
	model: string,
): RoutingDecision {
	return {
		taskType,
		tier,
		model,
		remote: false,
		privacyDecision: 'allowed_local',
		blocked: false,
		reason: null,
	};
}
