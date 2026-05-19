import { loadConfig } from '../src/lib/server/config';
import { OllamaAdapter } from '../src/lib/server/llm/ollama';
import { countMessageTokens } from '../src/lib/server/llm/tokens';

const { config } = loadConfig();
const adapter = new OllamaAdapter({
	baseUrl: config.llm.base_url,
	defaultParams: {
		...config.llm.params,
		num_predict: 48,
	},
});

const messages = [
	{
		role: 'user' as const,
		content: 'Reply in one short sentence: Bryon streaming check.',
	},
];

const stream = await adapter.stream({
	model: config.llm.model,
	messages,
	params: {
		num_predict: 48,
	},
});

const reader = stream.getReader();
let output = '';
let tokensOut: number | undefined;

process.stdout.write(
	`model=${config.llm.model} tokensIn~${countMessageTokens(messages)}\n`,
);

while (true) {
	const { done, value } = await reader.read();
	if (done) break;

	if (value.type === 'token') {
		output += value.delta;
		process.stdout.write(value.delta);
	}

	if (value.type === 'done') {
		tokensOut = value.tokensOut;
	}
}

process.stdout.write(
	`\n\ntokensOut=${tokensOut ?? 'unknown'} chars=${output.length}\n`,
);
