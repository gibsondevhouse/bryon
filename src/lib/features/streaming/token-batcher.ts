/**
 * Token batcher. Coalesces incoming SSE token deltas and flushes the
 * accumulated string on a fixed interval so the Svelte renderer doesn't
 * thrash on every keystroke-sized chunk.
 */
export const TOKEN_BATCH_FLUSH_MS = 50;

export type TokenBatcher = {
	push(delta: string): void;
	flush(): void;
	dispose(): void;
};

export type TokenBatcherOptions = {
	flushIntervalMs?: number;
	onFlush: (combined: string) => void;
};

export function createTokenBatcher(options: TokenBatcherOptions): TokenBatcher {
	let pending = '';
	let frame: number | null = null;

	const flush = () => {
		if (frame) {
			cancelAnimationFrame(frame);
			frame = null;
		}
		if (pending) {
			const combined = pending;
			pending = '';
			options.onFlush(combined);
		}
	};

	return {
		push(delta: string): void {
			if (!delta) return;
			pending += delta;
			if (!frame && (typeof window !== 'undefined' || typeof requestAnimationFrame !== 'undefined')) {
				frame = requestAnimationFrame(flush);
			}
		},
		flush,
		dispose(): void {
			if (frame) {
				cancelAnimationFrame(frame);
				frame = null;
			}
			pending = '';
		},
	};
}
