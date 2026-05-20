import { describe, expect, it } from 'vitest';
import { isGemma4, isVisionCapable } from './vision';

describe('isVisionCapable', () => {
	it.each([
		'gemma4:e4b',
		'gemma4:e2b',
		'gemma4:26b',
		'gemma4:31b',
		'gemma4:latest',
		'gemma-4:e4b',
		'GEMMA4:E4B',
	])('returns true for Gemma 4 model: %s', (model) => {
		expect(isVisionCapable(model)).toBe(true);
	});

	it.each([
		'gemma3:4b',
		'gemma3:27b',
		'gemma2:9b',
		'llava:7b',
		'moondream:latest',
		'minicpm-v:8b',
		'qwen-vl:latest',
		'phi3:vision',
		'bakllava:latest',
		'mistral:7b',
		'llama3.2:3b',
		'deepseek-r1:14b',
		'',
	])('returns false for non-Gemma-4 model: %s', (model) => {
		expect(isVisionCapable(model)).toBe(false);
	});

	it('isGemma4 mirrors isVisionCapable', () => {
		expect(isGemma4('gemma4:e4b')).toBe(true);
		expect(isGemma4('gemma3:4b')).toBe(false);
	});
});
