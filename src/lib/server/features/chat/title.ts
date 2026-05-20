import { defaultLLMParams, defaultLLMSettings } from '../../../shared/schemas';
import type { LLMParams } from '../../../shared/types';
import type { LLMAdapter, LLMStreamEvent } from '../../llm/adapter';
import { ChatService } from './chat';

const TITLE_SYSTEM_PROMPT = `You are a title generator for chat conversations.
Given a conversation excerpt, output a short, descriptive title.
Return ONLY the title — no explanation, no quotes, no trailing punctuation.
3 to 6 words. Title Case. Style: Wikipedia article or book chapter heading.

Examples:
Conversation:
User: what's the best way to learn guitar as an adult?
Assistant: Start with basic chords and practice for 15–20 minutes daily...
Title: Learning Guitar as an Adult

Conversation:
User: explain how black holes form
Assistant: Black holes form when massive stars collapse under their own gravity...
Title: How Black Holes Form

Conversation:
User: help me write a cover letter for a software engineering job
Assistant: Here's a cover letter template you can adapt...
Title: Software Engineering Cover Letter`;

export type ConversationMessage = { role: string; content: string };

export type TitleServiceOptions = {
	adapter: LLMAdapter;
	chatService?: ChatService;
	model?: string;
	params?: Partial<LLMParams>;
};

export type GenerateTitleInput = {
	messages: ConversationMessage[];
	model?: string;
	params?: Partial<LLMParams>;
	signal?: AbortSignal;
};

export type QueueGenerateTitleInput = GenerateTitleInput & {
	chatId: string;
};

export class TitleService {
	private readonly adapter: LLMAdapter;
	private readonly chatService: ChatService;
	private readonly model: string;
	private readonly defaultParams: Partial<LLMParams>;

	constructor(options: TitleServiceOptions) {
		this.adapter = options.adapter;
		this.chatService = options.chatService ?? new ChatService();
		this.model = options.model ?? defaultLLMSettings.model;
		this.defaultParams = options.params ?? {};
	}

	async generate(input: GenerateTitleInput): Promise<string> {
		const conversation = buildConversationContext(input.messages);
		const firstUserContent = input.messages.find((m) => m.role === 'user')?.content ?? '';
		try {
			const stream = await this.adapter.stream({
				model: input.model ?? this.model,
				messages: [
					{ role: 'system', content: TITLE_SYSTEM_PROMPT },
					{
						role: 'user',
						content: `Conversation:\n${conversation}\n\nTitle:`,
					},
				],
				params: {
					...defaultLLMParams,
					...this.defaultParams,
					...input.params,
					temperature: 0.3,
					num_predict: 32,
				},
				signal: input.signal,
				// Titles never need chain-of-thought; skip it so we don't
				// waste tokens or evict the chat model from VRAM.
				thinking: false,
			});

			const title = sanitizeTitle(await collectStreamText(stream));
			return title || fallbackTitle(firstUserContent);
		} catch {
			return fallbackTitle(firstUserContent);
		}
	}

	queueGenerate(input: QueueGenerateTitleInput): void {
		void this.generateAndPersist(input);
	}

	async generateAndPersist(input: QueueGenerateTitleInput): Promise<string> {
		const title = await this.generate(input);
		this.chatService.update(input.chatId, { title });
		return title;
	}
}

function buildConversationContext(messages: ConversationMessage[]): string {
	return messages
		.filter((m) => m.role === 'user' || m.role === 'assistant')
		.slice(0, 8) // up to 4 full exchanges
		.map((m) => {
			const label = m.role === 'user' ? 'User' : 'Assistant';
			const content = m.content.replace(/\s+/g, ' ').trim().slice(0, 300);
			return `${label}: ${content}`;
		})
		.join('\n');
}

export function fallbackTitle(content: string, maxLength = 48): string {
	const normalized = content.replace(/\s+/g, ' ').trim();
	if (!normalized) return 'New chat';
	if (normalized.length <= maxLength) return normalized;

	const truncated = normalized.slice(0, maxLength - 3);
	const lastSpace = truncated.lastIndexOf(' ');
	const prefix = lastSpace >= 20 ? truncated.slice(0, lastSpace) : truncated;
	return `${prefix.trimEnd()}...`;
}

function sanitizeTitle(value: string): string {
	return value
		.replace(/^["'`]+|["'`.!?]+$/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 60);
}

async function collectStreamText(
	stream: ReadableStream<LLMStreamEvent>,
): Promise<string> {
	const reader = stream.getReader();
	let text = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value.type === 'token') text += value.delta;
		}
	} finally {
		reader.releaseLock();
	}

	return text.trim();
}
