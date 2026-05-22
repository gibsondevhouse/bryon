import { describe, expect, it } from 'vitest';
import { LOCAL_ONLY_CATEGORIES } from './policy';

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
});
