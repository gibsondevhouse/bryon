const CHARS_PER_TOKEN = 4;
const TARGET_TOKENS = 512;
const OVERLAP_TOKENS = 64;
const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

export type Chunk = {
	text: string;
	ordinal: number;
	tokenCount: number;
	page?: number;
};

// Splits on sentence-ending punctuation followed by whitespace or end-of-string.
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+|(?<=[.!?])$/;

export function chunkText(text: string, page?: number): Chunk[] {
	const sentences = splitSentences(text.trim());
	if (sentences.length === 0) return [];

	const chunks: Chunk[] = [];
	let buffer = '';
	let ordinal = 0;

	for (const sentence of sentences) {
		const candidate = buffer ? `${buffer} ${sentence}` : sentence;

		if (candidate.length > TARGET_CHARS && buffer.length > 0) {
			// Flush current buffer as a chunk.
			chunks.push(makeChunk(buffer.trim(), ordinal++, page));

			// Start next buffer with overlap from end of flushed chunk.
			const overlap = extractOverlap(buffer);
			buffer = overlap ? `${overlap} ${sentence}` : sentence;
		} else {
			buffer = candidate;
		}
	}

	if (buffer.trim()) {
		chunks.push(makeChunk(buffer.trim(), ordinal, page));
	}

	return chunks;
}

function splitSentences(text: string): string[] {
	return text
		.split(SENTENCE_BOUNDARY)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

function extractOverlap(text: string): string {
	if (text.length <= OVERLAP_CHARS) return text;
	const start = text.length - OVERLAP_CHARS;
	// Walk forward to a word boundary so we don't split mid-word.
	let boundary = start;
	while (boundary < text.length && !/\s/.test(text.charAt(boundary))) {
		boundary++;
	}
	return text.slice(boundary).trim();
}

function makeChunk(text: string, ordinal: number, page?: number): Chunk {
	return {
		text,
		ordinal,
		tokenCount: Math.ceil(text.length / CHARS_PER_TOKEN),
		page,
	};
}
