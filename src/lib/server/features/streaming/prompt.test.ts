import { describe, expect, it } from 'vitest';
import type { LLMAdapter, LLMStreamEvent } from '../../llm/adapter';
import { PromptBuilder, stripThinkingBlocks, type PromptHistoryMessage } from './prompt';

describe('stripThinkingBlocks', () => {
	it('removes <think>…</think> wrappers', () => {
		expect(stripThinkingBlocks('<think>plan...</think>Hello.')).toBe('Hello.');
	});

	it('removes Gemma 4 channel-tagged thought blocks', () => {
		const input = '<|channel|>thought\nreasoning here<channel|>The answer is 42.';
		expect(stripThinkingBlocks(input)).toBe('The answer is 42.');
	});

	it('is a no-op when no thinking markers are present', () => {
		expect(stripThinkingBlocks('Just a normal reply.')).toBe('Just a normal reply.');
	});

	it('handles multiple blocks', () => {
		const input = '<think>a</think>X<think>b</think>Y';
		expect(stripThinkingBlocks(input)).toBe('XY');
	});
});

describe('PromptBuilder', () => {
	it('keeps the full prompt when history fits under the context threshold', async () => {
		const builder = new PromptBuilder({ params: { num_ctx: 120 } });
		const result = await builder.build({
			personaSystemPrompt: 'You are Bryon.',
			messages: [
				message('m1', 'user', 'Hello.'),
				message('m2', 'assistant', 'How can I help?'),
			],
		});

		expect(result.strategy).toBe('full');
		expect(result.messages).toHaveLength(3);
		expect(result.messages.map((item) => item.content)).toEqual([
			'You are Bryon.',
			'Hello.',
			'How can I help?',
		]);
		expect(result.summarizedMessageIds).toEqual([]);
	});

	it('falls back to a recent-message sliding window without an adapter', async () => {
		const builder = new PromptBuilder({ params: { num_ctx: 80 } });
		const result = await builder.build({
			personaSystemPrompt: 'You are Bryon.',
			messages: [
				message('m1', 'user', longContent('oldest')),
				message('m2', 'assistant', longContent('older')),
				message('m3', 'user', longContent('recent user')),
				message('m4', 'assistant', longContent('recent assistant')),
			],
		});

		expect(result.strategy).toBe('sliding-window');
		expect(result.messages.map((item) => item.content)).not.toContain(
			longContent('oldest'),
		);
		expect(result.messages.map((item) => item.content)).toContain(
			longContent('recent assistant'),
		);
		expect(result.tokensIn).toBeLessThanOrEqual(result.tokenBudget);
	});

	it('summarizes older messages and keeps recent messages when over budget', async () => {
		const builder = new PromptBuilder({
			adapter: new FakeAdapter('durable summary'),
			params: { num_ctx: 130 },
		});
		const result = await builder.build({
			personaSystemPrompt: 'You are Bryon.',
			messages: [
				message('m1', 'user', longContent('oldest')),
				message('m2', 'assistant', longContent('older')),
				message('m3', 'user', longContent('middle')),
				message('m4', 'assistant', longContent('recent assistant')),
				message('m5', 'user', longContent('recent user')),
			],
		});

		expect(result.strategy).toBe('summarized');
		expect(result.summary).toBe('durable summary');
		expect(result.summarizedMessageIds).toEqual(['m1', 'm2', 'm3']);
		expect(result.messages.map((item) => item.content).join('\n')).toContain(
			'Earlier conversation summary:',
		);
		expect(result.messages.map((item) => item.content)).toContain(
			longContent('recent user'),
		);
		expect(result.tokensIn).toBeLessThanOrEqual(result.tokenBudget);
	});

	it('uses the sliding window when summarization fails', async () => {
		const builder = new PromptBuilder({
			adapter: new FailingAdapter(),
			params: { num_ctx: 80 },
		});
		const result = await builder.build({
			personaSystemPrompt: 'You are Bryon.',
			messages: [
				message('m1', 'user', longContent('oldest')),
				message('m2', 'assistant', longContent('older')),
				message('m3', 'user', longContent('recent user')),
				message('m4', 'assistant', longContent('recent assistant')),
			],
		});

		expect(result.strategy).toBe('sliding-window');
		expect(result.summary).toBeNull();
		expect(result.summarizedMessageIds).toEqual([]);
		expect(result.tokensIn).toBeLessThanOrEqual(result.tokenBudget);
	});
});

class FakeAdapter implements LLMAdapter {
	constructor(private readonly response: string) {}

	async ping(): Promise<boolean> {
		return true;
	}

	async stream(): Promise<ReadableStream<LLMStreamEvent>> {
		return streamFrom([
			{ type: 'token', delta: this.response },
			{ type: 'done' },
		]);
	}
}

class FailingAdapter implements LLMAdapter {
	async ping(): Promise<boolean> {
		return true;
	}

	async stream(): Promise<ReadableStream<LLMStreamEvent>> {
		throw new Error('summary failed');
	}
}

function streamFrom(events: LLMStreamEvent[]): ReadableStream<LLMStreamEvent> {
	return new ReadableStream<LLMStreamEvent>({
		start(controller) {
			for (const event of events) {
				controller.enqueue(event);
			}
			controller.close();
		},
	});
}

function message(
	id: string,
	role: PromptHistoryMessage['role'],
	content: string,
): PromptHistoryMessage {
	return {
		id,
		role,
		content,
		createdAt: Number(id.slice(1)),
		summarized: false,
		attachmentsJson: null,
	};
}

function longContent(label: string): string {
	return `${label} ${'x'.repeat(72)}`;
}
