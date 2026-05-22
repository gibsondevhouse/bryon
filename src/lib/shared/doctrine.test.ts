import { describe, expect, it } from 'vitest';
import { doctrineTerms } from './doctrine';
import {
	aarSchema,
	conopsPhaseSchema,
	fragoSchema,
	missionNeedSchema,
	opordSchema,
	planDoctrineSchema,
	taskTraceabilitySchema,
} from './schemas';

describe('doctrine contracts', () => {
	it('exposes the canonical doctrine vocabulary', () => {
		expect(doctrineTerms.missionNeed).toBe('Mission Need');
		expect(doctrineTerms.opord).toBe('OPORD');
		expect(doctrineTerms.aar).toBe('AAR');
	});

	it('parses doctrine plan snapshots', () => {
		const parsed = planDoctrineSchema.parse({
			lifecycle: 'drafting',
			missionNeed: {},
			commandersIntent: {},
			lineOfEffort: ['Line 1'],
			oplan: {},
		});

		expect(parsed.lifecycle).toBe('drafting');
		expect(parsed.missionNeed.gap).toBeNull();
		expect(parsed.commandersIntent.keyTasks).toEqual([]);
		expect(parsed.oplan.references).toEqual([]);
	});

	it('parses the structured doctrine record types', () => {
		expect(
			conopsPhaseSchema.parse({
				id: 'phase-1',
				planId: 'plan-1',
				ordinal: 0,
				name: 'Shape the area',
				startEvent: null,
				endEvent: null,
				objectives: [],
				decisionPoints: [
					{
						id: 'dp-1',
						label: 'Hold',
						trigger: null,
						branch: null,
						notes: null,
					},
				],
				branches: [],
				contingencies: [],
				archivedAt: null,
				createdAt: 1,
				updatedAt: 1,
			}).decisionPoints[0]?.label,
		).toBe('Hold');

		expect(
			opordSchema.parse({
				id: 'opord-1',
				planId: 'plan-1',
				paragraphs: {},
				createdAt: 1,
				updatedAt: 1,
			}).status,
		).toBe('draft');

		expect(
			fragoSchema.parse({
				id: 'frago-1',
				opordId: 'opord-1',
				changeType: 'modification',
				targets: [],
				createdAt: 1,
				updatedAt: 1,
			}).status,
		).toBe('draft');

		expect(
			aarSchema.parse({
				id: 'aar-1',
				planId: 'plan-1',
				relatedTaskIds: [],
				createdAt: 1,
				updatedAt: 1,
			}).status,
		).toBe('draft');

		expect(taskTraceabilitySchema.parse({}).sourceKind).toBe('manual');
		expect(missionNeedSchema.parse({}).gap).toBeNull();
	});
});
