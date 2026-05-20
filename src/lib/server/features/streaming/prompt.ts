import { readFileSync } from 'node:fs';
import { defaultLLMParams, defaultLLMSettings } from '../../../shared/schemas';
import type {
	Attachment,
	LLMParams,
	Message,
	MessageRole,
} from '../../../shared/types';
import type { LLMAdapter, LLMMessage } from '../../llm/adapter';
import { countMessageTokens, countTokens } from '../../llm/tokens';

export const CONTEXT_SUMMARY_THRESHOLD = 0.75;
/**
 * Safety multiplier applied to heuristic token counts so that under-counting
 * by the `len/4` estimator does not push the prompt past `num_ctx`.
 * Gemma 4's tokenizer typically yields ~10–15% more tokens than the heuristic.
 */
export const TOKEN_SAFETY_MARGIN = 1.15;

const SUMMARY_SYSTEM_PROMPT = `Summarize the earlier conversation for a future assistant turn.
Keep durable user goals, decisions, constraints, and unresolved questions.
Do not invent facts. Be concise.`;
const MAX_DOCUMENT_PROMPT_CHARS = 60_000;

export type PromptHistoryMessage = Pick<
	Message,
	'id' | 'role' | 'content' | 'createdAt' | 'summarized' | 'attachmentsJson'
>;

export type PromptBuilderOptions = {
	adapter?: LLMAdapter;
	model?: string;
	params?: Partial<LLMParams>;
	summaryThreshold?: number;
};

export type PromptBuildInput = {
	personaSystemPrompt: string;
	messages: PromptHistoryMessage[];
	model?: string;
	params?: Partial<LLMParams>;
	signal?: AbortSignal;
};

export type PromptBuildResult = {
	messages: LLMMessage[];
	tokensIn: number;
	contextLimit: number;
	tokenBudget: number;
	summary: string | null;
	summarizedMessageIds: string[];
	strategy: 'full' | 'summarized' | 'sliding-window';
};

export class PromptBuilder {
	private readonly adapter: LLMAdapter | null;
	private readonly model: string;
	private readonly defaultParams: Partial<LLMParams>;
	private readonly summaryThreshold: number;

	constructor(options: PromptBuilderOptions = {}) {
		this.adapter = options.adapter ?? null;
		this.model = options.model ?? defaultLLMSettings.model;
		this.defaultParams = options.params ?? {};
		this.summaryThreshold =
			options.summaryThreshold ?? CONTEXT_SUMMARY_THRESHOLD;
	}

	async build(input: PromptBuildInput): Promise<PromptBuildResult> {
		const params = { ...this.defaultParams, ...input.params };
		const contextLimit = params.num_ctx ?? defaultLLMParams.num_ctx;
		const tokenBudget = Math.max(
			1,
			Math.floor(contextLimit * this.summaryThreshold),
		);
		const systemMessage = toLLMMessage('system', input.personaSystemPrompt);
		const history = normalizeHistory(input.messages);
		const fullMessages = [systemMessage, ...history.map(toHistoryLLMMessage)];
		const fullTokens = countMessageTokens(fullMessages);
		const safeTokens = Math.ceil(fullTokens * TOKEN_SAFETY_MARGIN);

		if (safeTokens <= tokenBudget) {
			return {
				messages: fullMessages,
				tokensIn: fullTokens,
				contextLimit,
				tokenBudget,
				summary: null,
				summarizedMessageIds: [],
				strategy: 'full',
			};
		}

		if (this.adapter) {
			const summarized = await this.tryBuildSummarizedPrompt({
				systemMessage,
				history,
				tokenBudget,
				contextLimit,
				params,
				model: input.model ?? this.model,
				signal: input.signal,
			});

			if (summarized) return summarized;
		}

		return this.buildSlidingWindowPrompt({
			systemMessage,
			history,
			tokenBudget,
			contextLimit,
		});
	}

	private async tryBuildSummarizedPrompt(input: {
		systemMessage: LLMMessage;
		history: PromptHistoryMessage[];
		tokenBudget: number;
		contextLimit: number;
		model: string;
		params: Partial<LLMParams>;
		signal?: AbortSignal;
	}): Promise<PromptBuildResult | null> {
		const partition = partitionForSummary(
			input.systemMessage,
			input.history,
			input.tokenBudget,
		);

		if (!partition) return null;

		try {
			const summary = await this.summarize({
				candidates: partition.candidates,
				model: input.model,
				params: input.params,
				signal: input.signal,
			});

			if (!summary) return null;

			const summaryMessage = toLLMMessage(
				'system',
				`Earlier conversation summary:\n${summary}`,
			);
			const recentMessages = takeRecentWithinBudget({
				fixedMessages: [input.systemMessage, summaryMessage],
				history: partition.recent,
				tokenBudget: input.tokenBudget,
			});
			const messages = [
				input.systemMessage,
				summaryMessage,
				...recentMessages.map(toHistoryLLMMessage),
			];
			const tokensIn = countMessageTokens(messages);

			if (tokensIn > input.tokenBudget) return null;

			return {
				messages,
				tokensIn,
				contextLimit: input.contextLimit,
				tokenBudget: input.tokenBudget,
				summary,
				summarizedMessageIds: partition.candidates.map((message) => message.id),
				strategy: 'summarized',
			};
		} catch {
			return null;
		}
	}

	private buildSlidingWindowPrompt(input: {
		systemMessage: LLMMessage;
		history: PromptHistoryMessage[];
		tokenBudget: number;
		contextLimit: number;
	}): PromptBuildResult {
		const recentMessages = takeRecentWithinBudget({
			fixedMessages: [input.systemMessage],
			history: input.history,
			tokenBudget: input.tokenBudget,
		});
		const messages = [
			input.systemMessage,
			...recentMessages.map(toHistoryLLMMessage),
		];

		return {
			messages,
			tokensIn: countMessageTokens(messages),
			contextLimit: input.contextLimit,
			tokenBudget: input.tokenBudget,
			summary: null,
			summarizedMessageIds: [],
			strategy: 'sliding-window',
		};
	}

	private async summarize(input: {
		candidates: PromptHistoryMessage[];
		model: string;
		params: Partial<LLMParams>;
		signal?: AbortSignal;
	}): Promise<string> {
		if (!this.adapter) return '';

		const transcript = input.candidates.map(formatForSummary).join('\n\n');
		const stream = await this.adapter.stream({
			model: input.model,
			messages: [
				toLLMMessage('system', SUMMARY_SYSTEM_PROMPT),
				toLLMMessage('user', transcript),
			],
			params: {
				...input.params,
				temperature: Math.min(input.params.temperature ?? 0.2, 0.2),
				num_predict: Math.min(input.params.num_predict ?? 256, 256),
			},
			signal: input.signal,
		});

		return collectStreamText(stream);
	}
}

function normalizeHistory(
	messages: PromptHistoryMessage[],
): PromptHistoryMessage[] {
	return [...messages]
		.filter((message) => !message.summarized)
		.filter(
			(message) =>
				message.role === 'system' ||
				message.role === 'user' ||
				message.role === 'assistant',
		)
		.map((message) =>
			message.role === 'assistant'
				? { ...message, content: stripThinkingBlocks(message.content) }
				: message,
		)
		.sort((left, right) => left.createdAt - right.createdAt);
}

/**
 * Strip any chain-of-thought blocks from a prior assistant message before
 * resending it to the model. Per `dev/docs/gemma-exploitation/thinking.md`,
 * Gemma 4 must not see its own previous reasoning carried into the next turn.
 *
 * Handles both:
 *  - Ollama/`think:true` fallback wrapping: `<think>…</think>`
 *  - Native Gemma 4 channel tags: `<|channel>thought\n…<channel|>`
 */
export function stripThinkingBlocks(content: string): string {
	return content
		.replace(/<think>[\s\S]*?<\/think>/gi, '')
		.replace(/<\|channel\|?>thought[\s\S]*?<channel\|?>/gi, '')
		.replace(/^\s+/, '');
}

function partitionForSummary(
	systemMessage: LLMMessage,
	history: PromptHistoryMessage[],
	tokenBudget: number,
): {
	candidates: PromptHistoryMessage[];
	recent: PromptHistoryMessage[];
} | null {
	const systemTokens = countTokens(systemMessage.content);
	const summaryReserve = Math.min(
		Math.max(Math.floor(tokenBudget * 0.15), 48),
		512,
	);
	let usedTokens = systemTokens + summaryReserve;
	let recentStart = history.length;

	for (let index = history.length - 1; index >= 0; index -= 1) {
		const nextTokens = countTokens(history[index].content);
		if (usedTokens + nextTokens > tokenBudget) {
			if (recentStart === history.length) recentStart = index;
			break;
		}
		usedTokens += nextTokens;
		recentStart = index;
	}

	const candidates = history.slice(0, recentStart);
	if (candidates.length === 0) return null;

	return {
		candidates,
		recent: history.slice(recentStart),
	};
}

function takeRecentWithinBudget(input: {
	fixedMessages: LLMMessage[];
	history: PromptHistoryMessage[];
	tokenBudget: number;
}): PromptHistoryMessage[] {
	const fixedTokens = countMessageTokens(input.fixedMessages);
	if (fixedTokens >= input.tokenBudget) return [];

	let usedTokens = fixedTokens;
	const kept: PromptHistoryMessage[] = [];

	for (let index = input.history.length - 1; index >= 0; index -= 1) {
		const message = input.history[index];
		const nextTokens = countTokens(message.content);
		if (usedTokens + nextTokens > input.tokenBudget) {
			if (kept.length === 0) kept.unshift(message);
			break;
		}

		usedTokens += nextTokens;
		kept.unshift(message);
	}

	return kept;
}

async function collectStreamText(stream: ReadableStream): Promise<string> {
	const reader = stream.getReader();
	let text = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			if (isTokenEvent(value)) text += value.delta;
		}
	} finally {
		reader.releaseLock();
	}

	return text.trim();
}

function isTokenEvent(
	value: unknown,
): value is { type: 'token'; delta: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'type' in value &&
		value.type === 'token' &&
		'delta' in value &&
		typeof value.delta === 'string'
	);
}

function toHistoryLLMMessage(message: PromptHistoryMessage): LLMMessage {
	const llm = toLLMMessage(message.role, message.content);
	if (message.role === 'user' && message.attachmentsJson) {
		const attachments = readAttachments(message.attachmentsJson);
		const images = readAttachmentImages(attachments);
		if (images.length > 0) llm.images = images;

		const documentContext = readAttachmentDocuments(attachments);
		if (documentContext) {
			llm.content = `${llm.content}\n\n${documentContext}`;
		}
	}
	return llm;
}

function readAttachments(attachmentsJson: string): Attachment[] {
	try {
		return JSON.parse(attachmentsJson) as Attachment[];
	} catch {
		return [];
	}
}

function readAttachmentImages(attachments: Attachment[]): string[] {
	return attachments
		.filter((attachment) => attachment.kind === 'image')
		.flatMap((attachment) => {
			try {
				return [readFileSync(attachment.path).toString('base64')];
			} catch {
				return [];
			}
		});
}

function readAttachmentDocuments(attachments: Attachment[]): string {
	const parts: string[] = [];
	for (const attachment of attachments) {
		if (attachment.kind !== 'document') continue;
		if (!attachment.textPath) {
			parts.push(
				`[${attachment.name}] Document text is unavailable${attachment.errorMessage ? `: ${attachment.errorMessage}` : '.'}`,
			);
			continue;
		}

		try {
			const text = readFileSync(attachment.textPath, 'utf8')
				.slice(0, MAX_DOCUMENT_PROMPT_CHARS)
				.trim();
			if (text) {
				parts.push(
					`Document: ${attachment.title ?? attachment.name}\nFilename: ${attachment.name}\n\n${text}`,
				);
			}
		} catch {
			parts.push(`[${attachment.name}] Document text could not be read from disk.`);
		}
	}

	if (parts.length === 0) return '';
	return `Attached document context for this user message:\n\n${parts.join('\n\n---\n\n')}`;
}

function toLLMMessage(role: MessageRole, content: string): LLMMessage {
	return { role, content };
}

function formatForSummary(message: PromptHistoryMessage): string {
	return `${message.role.toUpperCase()}:\n${message.content}`;
}
