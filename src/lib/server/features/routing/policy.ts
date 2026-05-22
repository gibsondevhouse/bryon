import type { PrivacySettings } from '$lib/shared/types';

export const LOCAL_ONLY_CATEGORIES = [
	'medical',
	'legal',
	'financial_personal',
	'identity',
	'credentials',
	'minors',
	'private_correspondence',
] as const;

export type LocalOnlyCategory = (typeof LOCAL_ONLY_CATEGORIES)[number];

export type RoutingPolicyContext = {
	settings: PrivacySettings;
	planLocalOnlyCategories?: readonly string[];
	fileCategories?: readonly string[];
	sensitive?: boolean;
};

export type RoutingPolicyDecision = {
	allowedTierMax: 1 | 2 | 3 | 4;
	blockedCategories: string[];
	previewRequired: boolean;
	reasons: string[];
};

export function evaluateRoutingPolicy(_context: RoutingPolicyContext): RoutingPolicyDecision {
	throw new Error('Not implemented in 101: evaluateRoutingPolicy');
}
