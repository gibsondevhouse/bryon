import { randomUUID } from 'node:crypto';
import { routingLogs } from '$lib/server/db/schema';
import { getDb } from '$lib/server/db/client';
import type { Settings } from '$lib/shared/types';
import {
	evaluateRoutingPolicy,
	type RoutingPolicyDecision,
} from '$lib/server/features/routing/policy';

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
	| 'remote_model_unconfigured_fallback'
	| 'remote_preview_required_fallback'
	| 'chat_pin';

export type RoutingDecision = {
	taskType: ModelTaskType;
	tier: 1 | 2 | 3 | 4;
	model: string;
	remote: boolean;
	privacyDecision: PrivacyDecision;
	blocked: boolean;
	reason: string;
	policy: RoutingPolicyDecision;
};

export type RemoteRoutePreview = {
	taskType: ModelTaskType;
	tier: 3 | 4;
	model: string;
	requiresApproval: boolean;
	blockedCategories: string[];
	reason: string;
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
	planLocalOnlyCategories?: readonly string[];
	fileCategories?: readonly string[];
	sensitive?: boolean;
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
	const policy = evaluateRoutingPolicy({
		settings: input.config.privacy,
		planLocalOnlyCategories: input.planLocalOnlyCategories,
		fileCategories: input.fileCategories,
		explicitLocalOnly: localOnly,
		sensitive: input.sensitive,
	});
	const requestedRemote = input.highestQuality || input.preferRemote;

	if (requestedRemote && policy.allowedTierMax < 3) {
		const requestedTier = input.highestQuality ? 4 : 3;
		return remoteDeniedDecision(input, policy, requestedTier);
	}

	if (input.hasImageAttachment) {
		return localDecision(
			input.taskType,
			1,
			input.config.llm.vision_model,
			policy,
		);
	}

	if (input.chatPinnedModel) {
		return {
			taskType: input.taskType,
			tier: 1,
			model: input.chatPinnedModel,
			remote: false,
			privacyDecision: 'chat_pin',
			blocked: false,
			reason: 'Chat has a pinned local model.',
			policy,
		};
	}

	if (input.taskType === 'classification') {
		return localDecision(
			input.taskType,
			1,
			input.config.llm.small_model || input.config.llm.model,
			policy,
		);
	}

	if (
		input.taskType === 'chat' &&
		!input.highestQuality &&
		!input.preferRemote
	) {
		return localDecision(
			input.taskType,
			1,
			input.config.llm.small_model || input.config.llm.model,
			policy,
		);
	}

	if (policy.allowedTierMax < 3) {
		return localDecision(
			input.taskType,
			HEAVY_TASKS.has(input.taskType) ? 2 : 1,
			HEAVY_TASKS.has(input.taskType)
				? input.config.llm.large_model || input.config.llm.model
				: input.config.llm.small_model || input.config.llm.model,
			policy,
		);
	}

	if (
		(input.highestQuality || input.preferRemote) &&
		input.config.privacy.require_remote_preview &&
		!input.remoteApproved
	) {
		return {
			taskType: input.taskType,
			tier: 2,
			model: input.config.llm.large_model || input.config.llm.model,
			remote: false,
			privacyDecision: 'remote_preview_required_fallback',
			blocked: false,
			reason: 'Remote preview is required; using local Tier 2 until approved.',
			policy,
		};
	}

	if (
		input.highestQuality &&
		input.config.llm.gemini_api.enabled &&
		input.config.llm.gemini_api.model.trim()
	) {
		return {
			taskType: input.taskType,
			tier: 4,
			model: input.config.llm.gemini_api.model,
			remote: true,
			privacyDecision: 'allowed_remote',
			blocked: false,
			reason:
				'Tier 4 direct Gemini is explicitly enabled and selected for highest-quality work.',
			policy,
		};
	}

	if (input.preferRemote) {
		if (!input.config.privacy.tier3_enabled) {
			return {
				taskType: input.taskType,
				tier: 2,
				model: input.config.llm.large_model || input.config.llm.model,
				remote: false,
				privacyDecision: 'tier3_disabled_fallback',
				blocked: false,
				reason: 'Tier 3 is disabled; using local Tier 2.',
				policy,
			};
		}
		if (!input.config.llm.flash_model.trim()) {
			return {
				taskType: input.taskType,
				tier: 2,
				model: input.config.llm.large_model || input.config.llm.model,
				remote: false,
				privacyDecision: 'remote_model_unconfigured_fallback',
				blocked: false,
				reason: 'Tier 3 has no model configured; using local Tier 2.',
				policy,
			};
		}
		return {
			taskType: input.taskType,
			tier: 3,
			model: input.config.llm.flash_model,
			remote: true,
			privacyDecision: 'allowed_remote',
			blocked: false,
			reason: 'Tier 3 remote-capable model is enabled and selected.',
			policy,
		};
	}

	return localDecision(
		input.taskType,
		HEAVY_TASKS.has(input.taskType) ? 2 : 1,
		HEAVY_TASKS.has(input.taskType)
			? input.config.llm.large_model || input.config.llm.model
			: input.config.llm.small_model || input.config.llm.model,
		policy,
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
		policy: {
			allowedTierMax: 2,
			blockedCategories: ['explicit_local_only'],
			previewRequired: false,
			reasons: [
				'Local-only content is present; remote model tiers are denied.',
			],
		},
	};
}

export function createRemoteRoutePreview(
	decision: RoutingDecision,
): RemoteRoutePreview | null {
	if (decision.tier < 3) return null;
	return {
		taskType: decision.taskType,
		tier: decision.tier as 3 | 4,
		model: decision.model,
		requiresApproval: decision.policy.previewRequired,
		blockedCategories: decision.policy.blockedCategories,
		reason: decision.reason,
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
	getDb()
		.insert(routingLogs)
		.values({
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
		})
		.run();
}

function localDecision(
	taskType: ModelTaskType,
	tier: 1 | 2,
	model: string,
	policy: RoutingPolicyDecision,
): RoutingDecision {
	return {
		taskType,
		tier,
		model,
		remote: false,
		privacyDecision: 'allowed_local',
		blocked: false,
		reason:
			tier === 1
				? 'Tier 1 local model selected for light or sensitive-safe work.'
				: 'Tier 2 local model selected for heavier local work.',
		policy,
	};
}

function remoteDeniedDecision(
	input: RouteModelInput,
	policy: RoutingPolicyDecision,
	tier: 3 | 4,
): RoutingDecision {
	const model =
		tier === 4
			? input.config.llm.gemini_api.model || 'direct-gemini'
			: input.config.llm.flash_model || 'remote-tier';

	return {
		taskType: input.taskType,
		tier,
		model,
		remote: true,
		privacyDecision: 'blocked_local_only',
		blocked: true,
		reason: policy.reasons[0] ?? 'Local-only policy denied remote model use.',
		policy,
	};
}
