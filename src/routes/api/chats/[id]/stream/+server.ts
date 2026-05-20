import { randomUUID } from 'node:crypto';
import type { RequestHandler } from './$types';
import { loadConfig } from '$lib/server/config';
import { OllamaAdapter } from '$lib/server/llm/ollama';
import { getOllamaSupervisor } from '$lib/server/llm/supervisor';
import { isVisionCapable } from '$lib/server/llm/vision';
import { countTokens } from '$lib/server/llm/tokens';
import { getLogger } from '$lib/server/logger';
import { apiError, parseJsonBody } from '$lib/server/http';
import { ChatService } from '$lib/server/features/chat/chat';
import { PersonaService } from '$lib/server/features/personas/persona';
import {
	MemoryEntryService,
	ProjectService,
	projectFileToAttachment,
} from '$lib/server/features/projects/project';
import { PromptBuilder } from '$lib/server/features/streaming/prompt';
import {
	buildSystemPrompt,
	finalizeAssistant,
	finalizeInterrupted,
	loadStreamContext,
	makeEmitter,
	persistPromptSummary,
	queueTitleGeneration,
	runLLMStream,
	toStreamError,
} from '$lib/server/features/streaming/pipeline';
import { resolveThinking, thinkingDepthInstruction } from '$lib/server/features/streaming/thinking';
import {
	WebSearchError,
	WebSearchService,
	formatWebSearchForPrompt,
} from '$lib/server/web-search';
import { streamRequestSchema } from '$lib/shared/schemas';
import { STREAM_ERROR_CODE, STREAM_EVENT } from '$lib/shared/stream-events';

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = await parseJsonBody(request, streamRequestSchema);
	if (!parsed.ok) return parsed.response;

	const { config } = loadConfig();
	await getOllamaSupervisor().probe(true);

	const chatService = new ChatService();
	const personaService = new PersonaService();
	const projectService = new ProjectService();
	const memoryEntryService = new MemoryEntryService();
	const chat = chatService.get(params.id);
	if (!chat) return apiError(404, 'CHAT_NOT_FOUND', 'Chat not found.');

	const requestedProjectFileIds = [...new Set(parsed.data.projectFileIds ?? [])];
	if (requestedProjectFileIds.length > 0 && !chat.projectId) {
		return apiError(
			400,
			STREAM_ERROR_CODE.BadRequest,
			'Project files can only be attached from a project chat.',
		);
	}
	const projectFiles = requestedProjectFileIds.length
		? projectService.getFilesByIds(requestedProjectFileIds, chat.projectId)
		: [];
	if (projectFiles.length !== requestedProjectFileIds.length) {
		return apiError(
			400,
			STREAM_ERROR_CODE.BadRequest,
			'One or more selected project files are unavailable.',
		);
	}

	const attachments = [
		...(parsed.data.attachments ?? []),
		...projectFiles.map(projectFileToAttachment),
	];
	const hasImageAttachment = attachments.some((item) => item.kind === 'image');
	// Client-sent thinkingMode takes priority over the config default.
	const effectiveThinkingMode =
		parsed.data.thinkingMode ?? config.llm.thinking;
	const thinking = resolveThinking(effectiveThinkingMode, parsed.data.content);
	const thinkingInstruction = thinkingDepthInstruction(effectiveThinkingMode);

	const ctx = loadStreamContext(
		chatService,
		personaService,
		params.id,
		hasImageAttachment,
	);
	if ('response' in ctx) return ctx.response;
	const { persona, model, llmParams } = ctx;
	const project = ctx.chat.projectId ? projectService.get(ctx.chat.projectId) : null;

	if (hasImageAttachment && !isVisionCapable(model)) {
		return apiError(
			400,
			STREAM_ERROR_CODE.ModelNotVision,
			`Vision model "${model}" does not support images. Set [llm].vision_model to a vision-capable Ollama model such as gemma4:e4b.`,
		);
	}

	let webContext: string | null = null;
	let webArticles: import('$lib/server/web-search').WebSearchResult[] = [];
	if (parsed.data.webSearch) {
		try {
			const search = new WebSearchService(config.web_search);
			const result = await search.search(parsed.data.content, request.signal);
			webContext = formatWebSearchForPrompt(result);
			webArticles = result.results.slice(0, 3);
		} catch (error) {
			const code =
				error instanceof WebSearchError
					? error.code
					: STREAM_ERROR_CODE.WebSearchFailed;
			return apiError(
				code === 'WEB_SEARCH_DISABLED' ? 400 : 502,
				code,
				error instanceof Error ? error.message : 'Web lookup failed.',
			);
		}
	}

	const history = chatService.listMessages(params.id, { limit: 500 });
	const isFirstUserTurn = !history.some((message) => message.role === 'user');
	const userMessage = chatService.addMessage({
		chatId: params.id,
		role: 'user',
		content: parsed.data.content,
		tokensIn: countTokens(parsed.data.content),
		attachmentsJson: attachments.length > 0 ? JSON.stringify(attachments) : null,
	});

	const adapter = new OllamaAdapter({
		baseUrl: config.llm.base_url,
		defaultParams: config.llm.params,
	});
	const promptBuilder = new PromptBuilder({
		adapter,
		model,
		params: llmParams,
	});
	const prompt = await promptBuilder.build({
		personaSystemPrompt: buildSystemPrompt({
			basePrompt: persona.systemPrompt,
			projectPromptOverride: project?.promptOverride,
			memory: memoryEntryService.promptMemory(config.memory, project),
			webContext,
			thinkingInstruction,
		}),
		messages: [...history, userMessage],
		model,
		params: llmParams,
		signal: request.signal,
	});
	persistPromptSummary(chatService, params.id, history, prompt);

	const abortController = new AbortController();
	request.signal.addEventListener(
		'abort',
		() => abortController.abort(request.signal.reason),
		{ once: true },
	);

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const emit = makeEmitter(controller);
			const startedAt = performance.now();
			const assistantId = randomUUID();
			let assistantContent = '';
			let tokensIn: number | null = null;
			let tokensOut: number | null = null;
			let msToFirst: number | null = null;

			try {
				const result = await runLLMStream({
					adapter,
					model,
					prompt,
					params: llmParams,
					signal: abortController.signal,
					emit,
					startedAt,
					assistantId,
					thinking,
				});
				assistantContent = result.assistantContent;
				tokensIn = result.tokensIn;
				tokensOut = result.tokensOut;
				msToFirst = result.msToFirst;

				const msTotal = Math.round(performance.now() - startedAt);
				const assistantMessage = finalizeAssistant({
					chatService,
					chatId: params.id,
					assistantId,
					prompt,
					assistantContent,
					tokensIn,
					tokensOut,
					msToFirst,
					msTotal,
				});

				if (isFirstUserTurn) {
					queueTitleGeneration({
						adapter,
						chatService,
						chatId: params.id,
						messages: [
							{ role: 'user', content: parsed.data.content },
							{ role: 'assistant', content: assistantContent },
						],
						model,
						params: llmParams,
					});
				}

				emit(STREAM_EVENT.Done, {
					id: assistantMessage.id,
					tokensOut: assistantMessage.tokensOut ?? 0,
					msTotal,
				});

				if (webArticles.length > 0) {
					emit(STREAM_EVENT.Articles, {
						messageId: assistantMessage.id,
						articles: webArticles,
					});
				}

				getLogger().info(
					{
						chatId: params.id,
						model,
						msToFirst,
						msTotal,
						tokensIn: prompt.tokensIn,
						tokensOut: assistantMessage.tokensOut,
						strategy: prompt.strategy,
						webSearch: parsed.data.webSearch,
						thinking,
					},
					'stream.done',
				);
				controller.close();
			} catch (error) {
				if (assistantContent) {
					finalizeInterrupted({
						chatService,
						chatId: params.id,
						assistantId,
						prompt,
						assistantContent,
						tokensIn,
						tokensOut,
						msToFirst,
					});
				}

				const payload = toStreamError(error, model, request.signal.aborted);
				getLogger().warn(
					{
						chatId: params.id,
						model,
						msToFirst,
						tokensIn: prompt.tokensIn,
						tokensOut,
						strategy: prompt.strategy,
						errorCode: payload.code,
						error,
					},
					'stream.failed',
				);
				emit(STREAM_EVENT.Error, payload);
				controller.close();
			}
		},
		cancel() {
			abortController.abort();
		},
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream; charset=utf-8',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			'x-accel-buffering': 'no',
		},
	});
};
