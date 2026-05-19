import { parseStreamEvent, type StreamEvent } from '$lib/shared/stream-events';

/**
 * Closure-based SSE parser. Persists buffer + currentEvent across
 * `feed()` calls so events split across network chunks (very common with
 * real Ollama on slow networks) are reassembled correctly.
 *
 * Unknown event names and malformed payloads are dropped — callers that
 * care can subscribe via `onMalformed`.
 */
export type SseParser = {
	feed(chunk: string): StreamEvent[];
	flush(): StreamEvent[];
};

export type SseParserOptions = {
	onMalformed?: (event: string, raw: string) => void;
};

export function createSseParser(options: SseParserOptions = {}): SseParser {
	let buffer = '';
	let currentEvent = '';

	const drain = (lines: string[]): StreamEvent[] => {
		const out: StreamEvent[] = [];
		for (const line of lines) {
			if (line === '') {
				currentEvent = '';
				continue;
			}
			if (line.startsWith('event: ')) {
				currentEvent = line.slice(7).trim();
				continue;
			}
			if (line.startsWith('data: ') && currentEvent) {
				const raw = line.slice(6);
				let parsedJson: unknown;
				try {
					parsedJson = JSON.parse(raw);
				} catch {
					options.onMalformed?.(currentEvent, raw);
					continue;
				}
				const event = parseStreamEvent(currentEvent, parsedJson);
				if (event) out.push(event);
				else options.onMalformed?.(currentEvent, raw);
			}
		}
		return out;
	};

	return {
		feed(chunk: string): StreamEvent[] {
			buffer += chunk;
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';
			return drain(lines);
		},
		flush(): StreamEvent[] {
			if (!buffer) return [];
			const lines = [buffer];
			buffer = '';
			return drain(lines);
		},
	};
}
