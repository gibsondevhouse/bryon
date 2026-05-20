import { describe, expect, it, vi } from 'vitest';
import { createTokenBatcher } from './token-batcher';

describe('token-batcher', () => {
	it('flushes accumulated deltas after the interval', () => {
		let rafCallback: FrameRequestCallback | null = null;
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallback = cb;
			return 1;
		}));
		vi.stubGlobal('cancelAnimationFrame', vi.fn());

		const flushes: string[] = [];
		const batcher = createTokenBatcher({
			onFlush: (combined) => flushes.push(combined),
		});

		batcher.push('Hel');
		batcher.push('lo');
		expect(flushes).toEqual([]);

		(rafCallback as FrameRequestCallback | null)?.(0);
		expect(flushes).toEqual(['Hello']);

		vi.unstubAllGlobals();
	});

	it('does not flush empty buffers', () => {
		let rafCallback: FrameRequestCallback | null = null;
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallback = cb;
			return 1;
		}));

		const flushes: string[] = [];
		const batcher = createTokenBatcher({
			onFlush: (combined) => flushes.push(combined),
		});
		batcher.push('');
		(rafCallback as FrameRequestCallback | null)?.(0);
		expect(flushes).toEqual([]);

		vi.unstubAllGlobals();
	});

	it('flush() drains immediately', () => {
		vi.stubGlobal('requestAnimationFrame', vi.fn());
		const flushes: string[] = [];
		const batcher = createTokenBatcher({
			onFlush: (combined) => flushes.push(combined),
		});
		batcher.push('abc');
		batcher.flush();
		expect(flushes).toEqual(['abc']);
		vi.unstubAllGlobals();
	});

	it('dispose() drops pending deltas without flushing', () => {
		let rafCallback: FrameRequestCallback | null = null;
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallback = cb;
			return 1;
		}));
		vi.stubGlobal('cancelAnimationFrame', vi.fn());

		const flushes: string[] = [];
		const batcher = createTokenBatcher({
			onFlush: (combined) => flushes.push(combined),
		});
		batcher.push('abc');
		batcher.dispose();
		(rafCallback as FrameRequestCallback | null)?.(0);
		expect(flushes).toEqual([]);
		vi.unstubAllGlobals();
	});

	it('starts a new timer after a flush', () => {
		let rafCallback: FrameRequestCallback | null = null;
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallback = cb;
			return 1;
		}));
		vi.stubGlobal('cancelAnimationFrame', vi.fn());

		const flushes: string[] = [];
		const batcher = createTokenBatcher({
			onFlush: (combined) => flushes.push(combined),
		});

		batcher.push('a');
		(rafCallback as FrameRequestCallback | null)?.(0);
		rafCallback = null;

		batcher.push('b');
		(rafCallback as FrameRequestCallback | null)?.(0);

		expect(flushes).toEqual(['a', 'b']);
		vi.unstubAllGlobals();
	});
});
