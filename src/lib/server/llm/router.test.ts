import { describe, expect, it } from 'vitest';
import { settingsSchema } from '$lib/shared/schemas';
import { createRemoteRoutePreview, routeModel } from './router';

describe('routeModel', () => {
	it('keeps classification local on tier 1', () => {
		const config = settingsSchema.parse({});
		const decision = routeModel({ config, taskType: 'classification' });
		expect(decision).toMatchObject({
			tier: 1,
			model: 'gemma4:e4b',
			remote: false,
			privacyDecision: 'allowed_local',
		});
	});

	it('uses tier 2 for local-only heavy work', () => {
		const config = settingsSchema.parse({});
		const decision = routeModel({
			config,
			taskType: 'plan_generation',
			localOnly: true,
		});
		expect(decision).toMatchObject({
			tier: 2,
			model: 'gemma4:31b',
			remote: false,
		});
	});

	it('falls back to tier 2 when remote is preferred but tier 3 is disabled', () => {
		const config = settingsSchema.parse({
			privacy: {
				tier3_enabled: false,
				require_remote_preview: false,
			},
		});
		const decision = routeModel({
			config,
			taskType: 'summarization',
			preferRemote: true,
		});
		expect(decision).toMatchObject({
			tier: 2,
			model: 'gemma4:31b',
			remote: false,
			privacyDecision: 'tier3_disabled_fallback',
		});
	});

	it('uses optional tier 4 for highest quality when enabled', () => {
		const config = settingsSchema.parse({
			llm: {
				gemini_api: {
					enabled: true,
					model: 'gemini-3-pro',
				},
			},
			privacy: {
				require_remote_preview: false,
			},
		});
		const decision = routeModel({
			config,
			taskType: 'project_expansion',
			highestQuality: true,
		});
		expect(decision).toMatchObject({
			tier: 4,
			model: 'gemini-3-pro',
			remote: true,
			privacyDecision: 'allowed_remote',
		});
	});

	it('uses tier 3 remote-capable model only when enabled and configured', () => {
		const config = settingsSchema.parse({
			llm: {
				flash_model: 'gemini-flash',
			},
			privacy: {
				tier3_enabled: true,
			},
		});
		const decision = routeModel({
			config,
			taskType: 'summarization',
			preferRemote: true,
			remoteApproved: true,
		});

		expect(decision).toMatchObject({
			tier: 3,
			model: 'gemini-flash',
			remote: true,
			privacyDecision: 'allowed_remote',
		});
	});

	it('hard-denies remote routing for local-only file categories', () => {
		const config = settingsSchema.parse({
			llm: {
				flash_model: 'gemini-flash',
			},
			privacy: {
				tier3_enabled: true,
			},
		});
		const decision = routeModel({
			config,
			taskType: 'summarization',
			preferRemote: true,
			remoteApproved: true,
			fileCategories: ['credentials'],
		});

		expect(decision).toMatchObject({
			tier: 3,
			remote: true,
			blocked: true,
			privacyDecision: 'blocked_local_only',
		});
		expect(decision.policy.blockedCategories).toEqual(['credentials']);
	});

	it('creates a reusable remote preview payload', () => {
		const config = settingsSchema.parse({
			llm: {
				flash_model: 'gemini-flash',
			},
			privacy: {
				tier3_enabled: true,
				require_remote_preview: true,
			},
		});
		const decision = routeModel({
			config,
			taskType: 'summarization',
			preferRemote: true,
			remoteApproved: true,
		});

		expect(createRemoteRoutePreview(decision)).toMatchObject({
			taskType: 'summarization',
			tier: 3,
			model: 'gemini-flash',
			requiresApproval: true,
		});
	});

	it('falls back to local tier 2 when remote preview is required but not approved', () => {
		const config = settingsSchema.parse({
			privacy: {
				require_remote_preview: true,
			},
		});
		const decision = routeModel({
			config,
			taskType: 'project_expansion',
			preferRemote: true,
		});
		expect(decision).toMatchObject({
			tier: 2,
			model: 'gemma4:31b',
			remote: false,
			privacyDecision: 'remote_preview_required_fallback',
		});
	});
});
