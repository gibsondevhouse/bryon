import { describe, expect, it, vi } from 'vitest';
import { createTokenBatcher } from './token-batcher';

describe('token-batcher', () => {
	it('flushes accumulated deltas after the interval', () => {
		vi.useFakeTimers();
		const flushes: string[] = [];
		const batcher = createTokenBatcher({
			flushIntervalMs: 50,
			onFlush: (combined) => flushes.push(combined),
		});

		batcher.push('Hel');
		batcher.push('lo');
		expect(flushes).toEqual([]);

		vi.advanceTimersByTime(50);
		expect(flushes).toEqual(['Hello']);
		vi.useRealTimers();
	});

	it('does not flush empty buffers', () => {
		vi.useFakeTimers();
		const flushes: string[] = [];
		const batcher = createTokenBatcher({
			flushIntervalMs: 50,
			onFlush: (combined) => flushes.push(combined),
		});
		batcher.push('');
		vi.advanceTimersByTime(50);
		expect(flushes).toEqual([]);
		vi.useRealTimers();
	});

	it('flush() drains immediately', () => {
		const flushes: string[] = [];
		const batcher = createTokenBatcher({
			flushIntervalMs: 50,
			onFlush: (combined) => flushes.push(combined),
		});
		batcher.push('abc');
		batcher.flush();
		expect(flushes).toEqual(['abc']);
	});

	it('dispose() drops pending deltas without flushing', () => {
		vi.useFakeTimers();
		const flushes: string[] = [];
		const batcher = createTokenBatcher({
			flushIntervalMs: 50,
			onFlush: (combined) => flushes.push(combined),
		});
		batcher.push('abc');
		batcher.dispose();
		vi.advanceTimersByTime(100);
		expect(flushes).toEqual([]);
		vi.useRealTimers();
	});

	it('starts a new timer after a flush', () => {
		vi.useFakeTimers();
		const flushes: string[] = [];
		const batcher = createTokenBatcher({
			flushIntervalMs: 50,
			onFlush: (combined) => flushes.push(combined),
		});
		batcher.push('a');
		vi.advanceTimersByTime(50);
		batcher.push('b');
		vi.advanceTimersByTime(50);
		expect(flushes).toEqual(['a', 'b']);
		vi.useRealTimers();
	});
});
