export const BUILT_IN_LOCAL_ONLY_CATEGORIES = [
	'medical',
	'legal',
	'financial_personal',
	'identity',
	'credentials',
	'minors',
	'private_correspondence',
] as const;

export type BuiltInLocalOnlyCategory =
	(typeof BUILT_IN_LOCAL_ONLY_CATEGORIES)[number];

export const LOCAL_ONLY_CATEGORY_LABELS: Record<
	BuiltInLocalOnlyCategory,
	string
> = {
	medical: 'Medical',
	legal: 'Legal',
	financial_personal: 'Financial',
	identity: 'Identity',
	credentials: 'Credentials',
	minors: 'Minors',
	private_correspondence: 'Private correspondence',
};

export function normalizeRoutingCategory(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
}

export function normalizeRoutingCategories(
	values: readonly string[] = [],
): string[] {
	return Array.from(
		new Set(
			values.map(normalizeRoutingCategory).filter((value) => value.length > 0),
		),
	);
}
