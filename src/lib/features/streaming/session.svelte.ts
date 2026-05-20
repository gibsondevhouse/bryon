import type { Attachment, Chat, Message, Project, ProjectFile, Settings } from '$lib/shared/types';
import {
	STREAM_ERROR_CODE,
	type NewsArticle,
	type StreamErrorEvent,
} from '$lib/shared/stream-events';
import { invalidate } from '$app/navigation';
import { consumeSseStream, type StreamHandlers } from './stream-consumer';
import { errorChannel } from './error-channel.svelte';
import type { SessionEvent } from '$lib/shared/stream-events';
import type { StreamPhase, StreamErrorCode } from '$lib/shared/types';
import {
	handleSlashCommand,
	type SlashCommandContext,
	type SlashCommandResult,
} from './commands';

export type { SlashCommandResult } from './commands';

export const MESSAGES_INVALIDATION_KEY = 'app:messages';

export type SessionMetrics = {
	tps: number;
	ttft: number;
	tokensIn: number;
	tokensOut: number;
	msTotal: number;
};

export type ThinkingMode = 'off' | 'auto' | 'light' | 'normal' | 'extended';

export type ContextBudgetStatus = {
	contextLimit: number;
	tokenBudget: number;
	tokensIn: number;
	/** Fraction 0–1 of the budget consumed by the prompt this turn. */
	usedPct: number;
	softCapReached: boolean;
};

export type SendOptions = {
	attachments?: Attachment[];
	projectFileIds?: string[];
	webSearch?: boolean;
};

export class Session {
	chats = $state<Chat[]>([]);
	projects = $state<Project[]>([]);
	projectFiles = $state(new Map<string, ProjectFile[]>());
	currentChatId = $state<string | null>(null);
	messages = $state<Message[]>([]);
	phase = $state<StreamPhase>({ kind: 'idle' });
	streamingContent = $state('');
	draft = $state('');
	metrics = $state<SessionMetrics | null>(null);
	settings = $state<Settings | null>(null);
	ollamaReachable = $state(true);
	lastUserContent = $state<string | null>(null);
	lastSendOptions = $state<SendOptions>({});
	articlesByMessageId = $state(new Map<string, NewsArticle[]>());
	thinkingByMessageId = $state(new Map<string, string>());
	thinkingDurationByMessageId = $state(new Map<string, number>());
	streamingThinking = $state('');
	streamingThinkingDurationMs = $state(0);
	activityPanelOpen = $state(false);
	activeActivityMessageId = $state<string | null>(null);
	availableModels = $state<string[]>([]);
	thinkingMode = $state<ThinkingMode>('normal');
	contextBudget = $state<ContextBudgetStatus | null>(null);
	ollamaState = $state<'unknown' | 'ready' | 'unreachable'>('unknown');
	draftWebSearch = $state(false);

	// Derived states from phase
	streaming = $derived(
		this.phase.kind === 'connecting' ||
			this.phase.kind === 'streaming' ||
			this.phase.kind === 'thinking',
	);

	private abortController: AbortController | null = null;
	private tokensReceived = 0;
	private streamingThinkingStartedAt: number | null = null;
	private streamingThinkingFrozen = false;

	hydrate(input: {
		chats?: Chat[];
		projects?: Project[];
		currentChatId?: string | null;
		messages?: Message[];
		projectFiles?: ProjectFile[];
		settings?: Settings;
		ollamaReachable?: boolean;
	}): void {
		if (input.chats) this.chats = input.chats;
		if (input.projects) this.projects = input.projects;
		if ('currentChatId' in input) {
			this.currentChatId = input.currentChatId ?? null;
		}
		if (input.messages) this.messages = input.messages;
		if (input.projectFiles && this.currentChatId) {
			const chat = this.chats.find((item) => item.id === this.currentChatId);
			if (chat?.projectId) {
				const next = new Map(this.projectFiles);
				next.set(chat.projectId, input.projectFiles);
				this.projectFiles = next;
			}
		}
		if (input.settings) this.settings = input.settings;
		if ('ollamaReachable' in input) {
			this.ollamaReachable = input.ollamaReachable ?? true;
			this.ollamaState = this.ollamaReachable ? 'ready' : 'unreachable';
		}
		this.startHealthPolling();
	}

	private healthInterval: number | null = null;
	private startHealthPolling(): void {
		if (typeof window === 'undefined' || this.healthInterval) return;

		const poll = async () => {
			const wasReachable = this.ollamaReachable;
			try {
				const response = await fetch('/api/health');
				if (response.ok) {
					const data = (await response.json()) as {
						ollama?: boolean;
						ollamaState?: 'unknown' | 'ready' | 'unreachable';
					};
					this.ollamaState =
						data.ollamaState ?? (data.ollama ? 'ready' : 'unreachable');
					this.ollamaReachable = data.ollama ?? this.ollamaState === 'ready';
				}
			} catch {
				this.ollamaState = 'unreachable';
				this.ollamaReachable = false;
			}

			if (wasReachable && !this.ollamaReachable) {
				errorChannel.push({
					code: 'OLLAMA_UNREACHABLE',
					message: 'Ollama is unreachable. Make sure the daemon is running.',
					severity: 'error',
					type: 'system',
				});
			} else if (!wasReachable && this.ollamaReachable) {
				errorChannel.push({
					code: 'OLLAMA_REACHABLE',
					message: 'Ollama is back online.',
					severity: 'info',
					type: 'system',
				});
			}
		};

		void poll();
		this.healthInterval = window.setInterval(poll, 10000);
	}

	resetComposer(): void {
		this.draft = '';
		this.streamingContent = '';
		this.streamingThinking = '';
		this.streamingThinkingDurationMs = 0;
		this.streamingThinkingStartedAt = null;
		this.streamingThinkingFrozen = false;
		this.phase = { kind: 'idle' };
	}

	openActivityFor(messageId: string): void {
		this.activeActivityMessageId = messageId;
		this.activityPanelOpen = true;
	}

	closeActivity(): void {
		this.activityPanelOpen = false;
	}

	toggleActivityFor(messageId: string): void {
		if (this.activityPanelOpen && this.activeActivityMessageId === messageId) {
			this.activityPanelOpen = false;
		} else {
			this.openActivityFor(messageId);
		}
	}

	async send(
		chatId: string,
		content: string,
		options: SendOptions = {},
	): Promise<void> {
		if (this.streaming) return;
		const trimmed = content.trim();
		if (!trimmed) return;
		const attachments = options.attachments ?? [];

		const userMessageId = `temp-${Date.now()}`;
		this.transition({ type: 'START', userMessageId });

		this.streamingContent = '';
		this.streamingThinking = '';
		this.streamingThinkingDurationMs = 0;
		this.streamingThinkingStartedAt = null;
		this.streamingThinkingFrozen = false;
		this.metrics = null;
		this.tokensReceived = 0;
		this.lastUserContent = trimmed;
		this.lastSendOptions = {
			attachments,
			projectFileIds: options.projectFileIds ?? [],
			webSearch: options.webSearch ?? false,
		};

		const userMessage: Message = {
			id: userMessageId,
			chatId,
			role: 'user',
			content: trimmed,
			tokensIn: null,
			tokensOut: null,
			msToFirst: null,
			msTotal: null,
			createdAt: Date.now(),
			summarized: false,
			attachmentsJson: attachments.length ? JSON.stringify(attachments) : null,
		};
		this.messages = [...this.messages, userMessage];
		this.draft = '';

		// Pre-scroll so user message is visible
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('bryon:scroll-bottom'));
		}

		const abortController = new AbortController();
		this.abortController = abortController;

		try {
			const response = await fetch(`/api/chats/${chatId}/stream`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: trimmed,
					attachments: attachments.length ? attachments : undefined,
					projectFileIds: options.projectFileIds?.length
						? options.projectFileIds
						: undefined,
					webSearch: options.webSearch ?? false,
					thinkingMode: this.thinkingMode,
				}),
				signal: abortController.signal,
			});

			if (!response.ok || !response.body) {
				const errorData = await response.json().catch(() => null);
				const code = this.readErrorCode(errorData);
				const message: string =
					errorData?.error?.message ?? `HTTP ${response.status}`;
				this.transition({ type: 'ERROR', code, message });
				this.appendErrorMessage(chatId, { code, message });
				return;
			}

			this.transition({ type: 'OPEN' });
			await this.consumeSSE(response.body, chatId);
		} catch (error) {
			if ((error as Error).name === 'AbortError') {
				this.transition({ type: 'ABORT' });
				// Server is the source of truth for the partial assistant
				// message — refetch instead of synthesizing a local row.
				void invalidate(MESSAGES_INVALIDATION_KEY);
			} else {
				const code = STREAM_ERROR_CODE.StreamInterrupted as StreamErrorCode;
				const message = (error as Error).message || 'Stream failed.';
				this.transition({ type: 'ERROR', code, message });
				this.appendErrorMessage(chatId, { code, message });
			}
		} finally {
			this.streamingContent = '';
			this.abortController = null;
		}
	}

	private readErrorCode(data: unknown): StreamErrorCode {
		if (
			typeof data === 'object' &&
			data !== null &&
			'error' in data &&
			typeof data.error === 'object' &&
			data.error !== null &&
			'code' in data.error &&
			typeof data.error.code === 'string'
		) {
			return data.error.code as StreamErrorCode;
		}
		return STREAM_ERROR_CODE.StreamInterrupted;
	}

	async retryLast(): Promise<void> {
		if (!this.currentChatId || !this.lastUserContent) return;
		if (this.streaming) return;
		// Drop trailing error/cancelled assistant rows added by the previous
		// attempt so the UI doesn't show duplicates after a successful retry.
		this.messages = this.messages.filter(
			(m) =>
				!(
					m.role === 'assistant' &&
					m.msTotal === null &&
					m.id.startsWith('error-')
				),
		);
		await this.send(this.currentChatId, this.lastUserContent, this.lastSendOptions);
	}

	cancel(): void {
		if (this.abortController) {
			this.abortController.abort();
			this.transition({ type: 'ABORT' });
		}
	}

	async createChat(projectId?: string | null): Promise<string | null> {
		try {
			const response = await fetch('/api/chats', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId }),
			});
			if (!response.ok) return null;
			const { chat }: { chat: Chat } = await response.json();
			this.chats = [chat, ...this.chats];
			return chat.id;
		} catch {
			return null;
		}
	}

	async refreshChatList(): Promise<void> {
		try {
			const response = await fetch('/api/chats?limit=50');
			if (response.ok) {
				const { chats }: { chats: Chat[] } = await response.json();
				this.chats = chats;
			}
		} catch {
			// silent — sidebar shows stale list
		}
	}

	async moveChat(chatId: string, projectId: string | null): Promise<void> {
		try {
			const response = await fetch(`/api/chats/${chatId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId }),
			});
			if (!response.ok) return;
			const { chat }: { chat: Chat } = await response.json();
			this.chats = this.chats.map((item) => (item.id === chatId ? chat : item));
		} catch {
			// silent — chat stays in its current scope
		}
	}

	async refreshProjects(): Promise<void> {
		try {
			const response = await fetch('/api/projects');
			if (!response.ok) return;
			const { projects }: { projects: Project[] } = await response.json();
			this.projects = projects;
		} catch {
			// silent — sidebar keeps stale projects
		}
	}

	async createProject(name: string): Promise<Project | null> {
		try {
			const response = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name }),
			});
			if (!response.ok) return null;
			const { project }: { project: Project } = await response.json();
			this.projects = [project, ...this.projects];
			return project;
		} catch {
			return null;
		}
	}

	async updateProject(id: string, input: Partial<Project>): Promise<Project | null> {
		try {
			const response = await fetch(`/api/projects/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input),
			});
			if (!response.ok) return null;
			const { project }: { project: Project } = await response.json();
			this.projects = this.projects.map((item) => (item.id === id ? project : item));
			return project;
		} catch {
			return null;
		}
	}

	async archiveProject(id: string): Promise<void> {
		try {
			const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
			if (!response.ok) return;
			const { project }: { project: Project } = await response.json();
			this.projects = this.projects.map((item) => (item.id === id ? project : item));
		} catch {
			// silent — project remains visible
		}
	}

	async refreshProjectFiles(projectId: string): Promise<ProjectFile[]> {
		try {
			const response = await fetch(`/api/projects/${projectId}/files`);
			if (!response.ok) return this.projectFiles.get(projectId) ?? [];
			const { files }: { files: ProjectFile[] } = await response.json();
			const next = new Map(this.projectFiles);
			next.set(projectId, files);
			this.projectFiles = next;
			return files;
		} catch {
			return this.projectFiles.get(projectId) ?? [];
		}
	}

	async changeModel(chatId: string, model: string): Promise<void> {
		try {
			const response = await fetch(`/api/chats/${chatId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ model }),
			});
			if (!response.ok) return;
			const { chat }: { chat: Chat } = await response.json();
			this.chats = this.chats.map((c) => (c.id === chatId ? chat : c));
		} catch {
			// silent — model stays as-is
		}
	}

	async refreshModels(): Promise<void> {
		try {
			const response = await fetch('/api/models');
			if (response.ok) {
				const data: { models: string[] } = await response.json();
				this.availableModels = data.models ?? [];
			}
		} catch {
			// silent — picker shows empty list
		}
	}

	handleSlashCommand(input: string): Promise<SlashCommandResult> {
		return handleSlashCommand(this.slashContext(), input);
	}

	private slashContext(): SlashCommandContext {
		return {
			get chats() {
				return session.chats;
			},
			get currentChatId() {
				return session.currentChatId;
			},
			get messages() {
				return session.messages;
			},
			get settings() {
				return session.settings;
			},
			setChats: (chats) => {
				session.chats = chats;
			},
			createChat: () => session.createChat(),
			refreshChatList: () => session.refreshChatList(),
		};
	}

	private async consumeSSE(
		body: ReadableStream<Uint8Array>,
		chatId: string,
	): Promise<void> {
		const handlers: StreamHandlers = {
			getCurrentChatId: () => this.currentChatId,
			onThinkingToken: (data) => {
				this.transition({ type: 'THINKING_TOKEN', delta: data.delta });
				if (this.streamingThinkingStartedAt === null) {
					this.streamingThinkingStartedAt = performance.now();
				}
				this.streamingThinking += data.delta;
				if (!this.streamingThinkingFrozen) {
					this.streamingThinkingDurationMs =
						performance.now() - this.streamingThinkingStartedAt;
				}
			},
			onToken: (data) => {
				this.transition({ type: 'TOKEN', delta: data.delta });
				// First real token: freeze the thinking duration.
				if (
					!this.streamingThinkingFrozen &&
					this.streamingThinkingStartedAt !== null
				) {
					this.streamingThinkingDurationMs =
						performance.now() - this.streamingThinkingStartedAt;
					this.streamingThinkingFrozen = true;
				}
				this.tokensReceived++;
			},
			onAppend: (combined) => {
				this.streamingContent += combined;
			},
			onMeta: (data) => {
				this.transition({
					type: 'META',
					assistantId: data.assistantId,
					tokensIn: data.tokensIn,
					msToFirst: data.msToFirst,
				});
				this.metrics = {
					tps: 0,
					ttft: data.msToFirst,
					tokensIn: data.tokensIn,
					tokensOut: 0,
					msTotal: 0,
				};
				if (data.contextLimit && data.tokenBudget) {
					this.contextBudget = {
						contextLimit: data.contextLimit,
						tokenBudget: data.tokenBudget,
						tokensIn: data.tokensIn,
						usedPct: Math.min(1, data.tokensIn / data.tokenBudget),
						softCapReached: data.softCapReached ?? false,
					};
				}
			},
			onDone: (data) => {
				this.transition({
					type: 'DONE',
					assistantId: data.id,
					tokensOut: data.tokensOut || this.tokensReceived,
					msTotal: data.msTotal,
				});
				const tokensOut = data.tokensOut || this.tokensReceived;
				const msTotal = data.msTotal;
				this.metrics = {
					...(this.metrics ?? { ttft: 0, tokensIn: 0 }),
					tps: msTotal > 0 ? (tokensOut / msTotal) * 1000 : 0,
					tokensOut,
					msTotal,
				};
				this.messages = [
					...this.messages,
					{
						id: data.id,
						chatId,
						role: 'assistant',
						content: this.streamingContent,
						tokensIn: this.metrics.tokensIn,
						tokensOut,
						msToFirst: this.metrics.ttft,
						msTotal,
						createdAt: Date.now(),
						summarized: false,
						attachmentsJson: null,
					},
				];
				if (this.streamingThinking) {
					const next = new Map(this.thinkingByMessageId);
					next.set(data.id, this.streamingThinking);
					this.thinkingByMessageId = next;
					const durations = new Map(this.thinkingDurationByMessageId);
					durations.set(data.id, this.streamingThinkingDurationMs);
					this.thinkingDurationByMessageId = durations;
				}
				// If the user was watching the streaming activity, re-anchor the
				// panel to the now-persisted message id.
				if (this.activeActivityMessageId === 'streaming') {
					this.activeActivityMessageId = data.id;
				}
				this.streamingContent = '';
				this.streamingThinking = '';
				this.streamingThinkingDurationMs = 0;
				this.streamingThinkingStartedAt = null;
				this.streamingThinkingFrozen = false;
				if (typeof console !== 'undefined') {
					console.info('stream.done', {
						ttft: this.metrics.ttft,
						tps: this.metrics.tps,
						tokensIn: this.metrics.tokensIn,
						tokensOut,
						msTotal,
					});
				}
				void this.refreshChatList();
			},
			onError: (data) => {
				const code = data.code as StreamErrorCode;
				this.transition({ type: 'ERROR', code, message: data.message });
				this.appendErrorMessage(chatId, data);
			},
			onArticles: (data) => {
				this.transition({ type: 'ARTICLES', items: data.articles });
				const next = new Map(this.articlesByMessageId);
				next.set(data.messageId, data.articles);
				this.articlesByMessageId = next;
			},
		};

		await consumeSseStream(body, chatId, handlers);
	}

	transition(event: SessionEvent): void {
		const prev = this.phase;
		switch (this.phase.kind) {
			case 'idle':
				if (event.type === 'START') {
					this.phase = { kind: 'connecting', userMessageId: event.userMessageId };
				}
				break;
			case 'connecting':
				if (event.type === 'OPEN') {
					// wait for META to know assistantId
				} else if (event.type === 'META') {
					this.phase = {
						kind: 'streaming',
						userMessageId: this.phase.userMessageId,
						assistantId: event.assistantId,
						startedAt: Date.now(),
					};
				} else if (event.type === 'ERROR') {
					this.phase = { kind: 'error', code: event.code, message: event.message };
				} else if (event.type === 'ABORT') {
					this.phase = { kind: 'aborted' };
				}
				break;
			case 'streaming':
				if (event.type === 'THINKING_TOKEN') {
					this.phase = {
						kind: 'thinking',
						userMessageId: this.phase.userMessageId,
						assistantId: this.phase.assistantId,
					};
				} else if (event.type === 'DONE') {
					this.phase = { kind: 'done', assistantId: event.assistantId };
				} else if (event.type === 'ERROR') {
					this.phase = {
						kind: 'error',
						code: event.code,
						message: event.message,
						assistantId: this.phase.assistantId,
					};
				} else if (event.type === 'ABORT') {
					this.phase = { kind: 'aborted', assistantId: this.phase.assistantId };
				}
				break;
			case 'thinking':
				if (event.type === 'TOKEN') {
					this.phase = {
						kind: 'streaming',
						userMessageId: this.phase.userMessageId,
						assistantId: this.phase.assistantId,
						startedAt: Date.now(), // approximation
					};
				} else if (event.type === 'THINKING_END') {
					// optional hint, usually TOKEN happens
				} else if (event.type === 'DONE') {
					this.phase = { kind: 'done', assistantId: event.assistantId };
				} else if (event.type === 'ERROR') {
					this.phase = {
						kind: 'error',
						code: event.code,
						message: event.message,
						assistantId: this.phase.assistantId,
					};
				} else if (event.type === 'ABORT') {
					this.phase = { kind: 'aborted', assistantId: this.phase.assistantId };
				}
				break;
			case 'error':
			case 'aborted':
			case 'done':
				if (event.type === 'START') {
					this.phase = { kind: 'connecting', userMessageId: event.userMessageId };
				}
				break;
		}

		if (prev.kind !== this.phase.kind) {
			console.debug(`[session] phase: ${prev.kind} -> ${this.phase.kind}`, { event });
		}
	}

	private appendErrorMessage(
		chatId: string,
		err: StreamErrorEvent,
	): void {
		// User-initiated cancellation — no error message needed
		if (err.code === STREAM_ERROR_CODE.Aborted) return;

		const title = this.errorTitle(err);
		const hint = this.errorHint(err);
		this.messages = [
			...this.messages,
			{
				id: `error-${Date.now()}`,
				chatId,
				role: 'assistant',
				content: `**${title}:** ${err.message}${hint}`,
				tokensIn: null,
				tokensOut: null,
				msToFirst: null,
				msTotal: null,
				createdAt: Date.now(),
				summarized: false,
				attachmentsJson: null,
			},
		];
		this.streamingContent = '';
	}

	private errorTitle(err: StreamErrorEvent): string {
		switch (err.code) {
			case STREAM_ERROR_CODE.ModelNotFound:
				return 'Model not found';
			case STREAM_ERROR_CODE.ModelNotVision:
				return 'Vision not available';
			case STREAM_ERROR_CODE.StreamInterrupted:
				return 'Connection dropped';
			case STREAM_ERROR_CODE.OllamaError:
				return this.isConnectionError(err.message)
					? "Ollama isn't running"
					: 'Ollama error';
			case STREAM_ERROR_CODE.WebSearchDisabled:
				return 'Web search disabled';
			case STREAM_ERROR_CODE.WebSearchFailed:
				return 'Web search failed';
			default:
				return 'Error';
		}
	}

	private isConnectionError(message: string): boolean {
		const lower = message.toLowerCase();
		return (
			lower.includes('econnrefused') ||
			lower.includes('failed to fetch') ||
			lower.includes('networkerror') ||
			lower.includes('fetch failed') ||
			lower.includes('connection refused')
		);
	}

	private errorHint(err: StreamErrorEvent): string {
		if (err.code === STREAM_ERROR_CODE.ModelNotFound && err.model) {
			return `\n\nRun \`ollama pull ${err.model}\`, then click **Retry**.`;
		}
		if (err.code === STREAM_ERROR_CODE.ModelNotVision) {
			return '\n\nSet the vision model in Settings to a vision-capable model, then click **Retry**.';
		}
		if (err.code === STREAM_ERROR_CODE.StreamInterrupted) {
			return '\n\nYour partial answer was saved. Click **Retry** to continue.';
		}
		if (err.code === STREAM_ERROR_CODE.OllamaError) {
			return this.isConnectionError(err.message)
				? '\n\nRun `ollama serve` to start the daemon, then click **Retry**.'
				: '\n\nClick **Retry** or restart Ollama.';
		}
		if (err.code === STREAM_ERROR_CODE.WebSearchDisabled) {
			return '\n\nEnable web lookup in Settings or send again with web lookup off.';
		}
		if (err.code === STREAM_ERROR_CODE.WebSearchFailed) {
			return '\n\nCheck the SearXNG URL in Settings or send again without web lookup.';
		}
		return '\n\nRun `ollama serve` to start the daemon, then click **Retry**.';
	}
}

export const session = new Session();
