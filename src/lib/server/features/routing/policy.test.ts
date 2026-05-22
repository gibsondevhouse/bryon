import { describe, expect, it } from 'vitest';
import { settingsSchema } from '$lib/shared/schemas';
import { evaluateRoutingPolicy, LOCAL_ONLY_CATEGORIES } from './policy';

describe('routing policy vocabulary', () => {
	it('locks the hard-block local-only categories', () => {
		expect(LOCAL_ONLY_CATEGORIES).toEqual([
			'medical',
			'legal',
			'financial_personal',
			'identity',
			'credentials',
			'minors',
			'private_correspondence',
		]);
	});

	it('denies remote tiers when file categories match built-in local-only categories', () => {
		const config = settingsSchema.parse({});
		const decision = evaluateRoutingPolicy({
			settings: config.privacy,
			fileCategories: ['Medical'],
		});

		expect(decision.allowedTierMax).toBe(2);
		expect(decision.blockedCategories).toEqual(['medical']);
	});

	it('combines user-defined and plan-defined local-only categories', () => {
		const config = settingsSchema.parse({
			privacy: {
				local_only_categories: ['Client Files'],
			},
		});
		const decision = evaluateRoutingPolicy({
			settings: config.privacy,
			planLocalOnlyCategories: ['export-controlled'],
			fileCategories: ['client_files'],
		});

		expect(decision.allowedTierMax).toBe(2);
		expect(decision.blockedCategories).toEqual([
			'client_files',
			'export_controlled',
		]);
	});
});
