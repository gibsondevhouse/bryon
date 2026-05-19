import { describe, expect, it } from 'vitest';
import { isVisionCapable } from './vision';

describe('isVisionCapable', () => {
	it.each([
		'gemma3:4b',
		'gemma3:27b',
		'gemma3:latest',
		'gemma4:e4b',
		'gemma4:e2b',
		'gemma4:26b',
		'gemma4:latest',
		'llava:7b',
		'llava:latest',
		'llava-llama3:latest',
		'llava-phi3:latest',
		'moondream:latest',
		'moondream:1.8b',
		'minicpm-v:latest',
		'minicpm-v:8b',
		'bakllava:latest',
	])('returns true for vision-capable model: %s', (model) => {
		expect(isVisionCapable(model)).toBe(true);
	});

	it.each([
		'qwen2.5-coder:7b',
		'qwen2.5:14b',
		'mistral:7b',
		'mistral:latest',
		'phi3:mini',
		'phi3:medium',
		'llama3.2:3b',
		'llama3.2:latest',
		'deepseek-r1:14b',
		'codellama:13b',
		'gemma2:9b',
		'gemma2:27b',
	])('returns false for non-vision model: %s', (model) => {
		expect(isVisionCapable(model)).toBe(false);
	});

	it('is case-insensitive for prefix matching', () => {
		expect(isVisionCapable('GEMMA3:4b')).toBe(true);
		expect(isVisionCapable('LLaVA:latest')).toBe(true);
	});
});
