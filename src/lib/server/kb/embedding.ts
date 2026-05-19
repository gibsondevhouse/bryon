const EMBED_BATCH_SIZE = 64;
const EXPECTED_DIM = 768;

export type EmbeddingAdapterOptions = {
	baseUrl: string;
	model: string;
};

export class EmbeddingDimError extends Error {
	constructor(actual: number) {
		super(`Embedding dimension mismatch: expected ${EXPECTED_DIM}, got ${actual}`);
		this.name = 'EmbeddingDimError';
	}
}

export class EmbeddingAdapter {
	constructor(private readonly opts: EmbeddingAdapterOptions) {}

	async embedBatch(texts: string[], signal?: AbortSignal): Promise<Float32Array[]> {
		const results: Float32Array[] = [];

		for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
			const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
			const embeddings = await this.requestEmbeddings(batch, signal);
			results.push(...embeddings);
		}

		return results;
	}

	async embed(text: string, signal?: AbortSignal): Promise<Float32Array> {
		const [embedding] = await this.requestEmbeddings([text], signal);
		if (!embedding) throw new Error('Empty embedding response');
		return embedding;
	}

	private async requestEmbeddings(
		texts: string[],
		signal?: AbortSignal,
	): Promise<Float32Array[]> {
		const response = await fetch(`${this.opts.baseUrl}/api/embed`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model: this.opts.model, input: texts }),
			signal,
		});

		if (!response.ok) {
			const body = await response.text().catch(() => '');
			throw new Error(`Embedding request failed (${response.status}): ${body}`);
		}

		const data = (await response.json()) as { embeddings?: number[][] };
		const embeddings = data.embeddings;
		if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
			throw new Error('Unexpected embedding response shape');
		}

		return embeddings.map((vec) => {
			if (vec.length !== EXPECTED_DIM) {
				throw new EmbeddingDimError(vec.length);
			}
			return new Float32Array(vec);
		});
	}
}
