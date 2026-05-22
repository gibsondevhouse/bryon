import type { PrivacySettings } from '$lib/shared/types';
import {
	BUILT_IN_LOCAL_ONLY_CATEGORIES,
	normalizeRoutingCategories,
	normalizeRoutingCategory,
} from '$lib/shared/routing';

export const LOCAL_ONLY_CATEGORIES = BUILT_IN_LOCAL_ONLY_CATEGORIES;

export type LocalOnlyCategory = (typeof LOCAL_ONLY_CATEGORIES)[number];

export type RoutingPolicyContext = {
	settings: PrivacySettings;
	planLocalOnlyCategories?: readonly string[];
	fileCategories?: readonly string[];
	explicitLocalOnly?: boolean;
	sensitive?: boolean;
};

export type RoutingPolicyDecision = {
	allowedTierMax: 1 | 2 | 3 | 4;
	blockedCategories: string[];
	previewRequired: boolean;
	reasons: string[];
};

export function evaluateRoutingPolicy(
	context: RoutingPolicyContext,
): RoutingPolicyDecision {
	const builtIn = new Set<string>(LOCAL_ONLY_CATEGORIES);
	const userDefined = new Set(
		normalizeRoutingCategories(context.settings.local_only_categories),
	);
	const planDefined = new Set(
		normalizeRoutingCategories(context.planLocalOnlyCategories),
	);
	const fileCategories = normalizeRoutingCategories(context.fileCategories);
	const blockedCategories = new Set<string>();
	const reasons: string[] = [];

	for (const category of fileCategories) {
		if (
			builtIn.has(category) ||
			userDefined.has(category) ||
			planDefined.has(category)
		) {
			blockedCategories.add(category);
		}
	}

	for (const category of planDefined) {
		blockedCategories.add(category);
	}

	if (context.sensitive) {
		blockedCategories.add('sensitive_file_marker');
	}

	if (context.explicitLocalOnly) {
		blockedCategories.add('explicit_local_only');
	}

	if (blockedCategories.size > 0) {
		reasons.push(
			'Local-only content is present; remote model tiers are denied.',
		);
	}

	if (context.settings.require_remote_preview) {
		reasons.push('Remote preview is required before remote model use.');
	}

	return {
		allowedTierMax: blockedCategories.size > 0 ? 2 : 4,
		blockedCategories: Array.from(blockedCategories)
			.map(normalizeRoutingCategory)
			.sort(),
		previewRequired: context.settings.require_remote_preview,
		reasons,
	};
}
