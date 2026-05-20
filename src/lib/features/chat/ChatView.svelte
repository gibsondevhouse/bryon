<script lang="ts">
import MessageList from './MessageList.svelte';
import Composer from './Composer.svelte';
import StatusBar from './StatusBar.svelte';
import { session } from '$lib/features/streaming/session.svelte';

let {
	chatId,
}: {
	chatId: string;
} = $props();

let commandFeedback = $state<string | null>(null);
let composerWithMessages: Composer | undefined = $state();
let composerEmpty: Composer | undefined = $state();
let emptyWebSearch = $state(false);
let emptyMode = $derived<'chat' | 'web'>(emptyWebSearch ? 'web' : 'chat');

const hasMessages = $derived(
	session.messages.some((m) => m.role !== 'system') || session.streaming,
);

const activeModel = $derived.by(() => {
	const chat = session.chats.find((item) => item.id === chatId);
	return (
		chat?.resolvedModel ??
		chat?.model ??
		session.settings?.llm.model ??
		'unknown'
	);
});

const contextLimit = $derived(session.settings?.llm.params.num_ctx ?? 8192);
const contextTokens = $derived(session.metrics?.tokensIn ?? 0);

function handleSend(
	content: string,
	options?: { attachments?: import('$lib/shared/types').Attachment[]; webSearch?: boolean },
): void {
	void session.send(chatId, content, options);
}

function handleCancel(): void {
	session.cancel();
}

function handleSlashCommand(input: string) {
	return session.handleSlashCommand(input);
}

function handleRetry(): void {
	void session.retryLast();
}

$effect(() => {
	function onFocusComposer(): void {
		composerWithMessages?.focus();
		composerEmpty?.focus();
	}
	window.addEventListener('bryon:focus-composer', onFocusComposer);
	return () => window.removeEventListener('bryon:focus-composer', onFocusComposer);
});
</script>

{#if hasMessages}
	<div class="chat-view">
		<MessageList
			messages={session.messages}
			streaming={session.streaming}
			streamingContent={session.streamingContent}
			streamingThinking={session.streamingThinking}
			streamingThinkingDurationMs={session.streamingThinkingDurationMs}
			articlesByMessageId={session.articlesByMessageId}
			thinkingByMessageId={session.thinkingByMessageId}
			thinkingDurationByMessageId={session.thinkingDurationByMessageId}
			onRetry={handleRetry}
		/>

		<Composer
			bind:this={composerWithMessages}
			{chatId}
			bind:draft={session.draft}
			streaming={session.streaming}
			disabled={!session.ollamaReachable}
			bind:commandFeedback
			onSend={handleSend}
			onCancel={handleCancel}
			onSlashCommand={handleSlashCommand}
		/>

		<StatusBar
			model={activeModel}
			streaming={session.streaming}
			metrics={session.metrics}
			contextTokens={contextTokens}
			contextLimit={contextLimit}
		/>
	</div>
{:else}
	<div class="chat-view">
		<div class="empty-view">
			<div class="empty-center">
				<header class="empty-brand">
					<h1>Bryon</h1>
					<p class="empty-model">{activeModel}</p>
				</header>

				<div class="mode-track" role="tablist" aria-label="Mode" style:--idx={emptyMode === 'web' ? 1 : 0}>
					<span class="mode-indicator" aria-hidden="true"></span>
					<button
						type="button"
						role="tab"
						aria-selected={emptyMode === 'chat'}
						class="mode-tab"
						class:active={emptyMode === 'chat'}
						onclick={() => (emptyWebSearch = false)}
					>Chat</button>
					<button
						type="button"
						role="tab"
						aria-selected={emptyMode === 'web'}
						class="mode-tab"
						class:active={emptyMode === 'web'}
						onclick={() => (emptyWebSearch = true)}
					>Web</button>
				</div>

				<Composer
					bind:this={composerEmpty}
					{chatId}
					bind:draft={session.draft}
					bind:webSearch={emptyWebSearch}
					streaming={false}
					disabled={!session.ollamaReachable}
					bind:commandFeedback
					onSend={handleSend}
					onCancel={handleCancel}
					onSlashCommand={handleSlashCommand}
				/>
			</div>
		</div>

		<StatusBar
			model={activeModel}
			streaming={session.streaming}
			metrics={session.metrics}
			contextTokens={contextTokens}
			contextLimit={contextLimit}
		/>
	</div>
{/if}

<style>
.chat-view {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
}

.empty-view {
	display: flex;
	flex: 1;
	align-items: center;
	justify-content: center;
	min-height: 0;
	padding-bottom: 10vh;
}

.empty-center {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--sp-5);
	width: 100%;
	max-width: 720px;
	padding: 0 var(--sp-6);
}

.empty-brand {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--sp-1);
	text-align: center;
}

.empty-brand h1 {
	margin: 0;
	font-size: clamp(34px, 5vw, 44px);
	font-weight: 600;
	letter-spacing: -0.02em;
	color: #ffffff;
	line-height: 1;
}

.empty-model {
	margin: 0;
	font-size: 12.5px;
	color: var(--text-muted);
	letter-spacing: 0.01em;
}

/* ── Mode track ── */
.mode-track {
	position: relative;
	display: inline-flex;
	padding: 4px;
	background: var(--surface-tint);
	border: 1px solid var(--border-hair);
	border-radius: 999px;
	isolation: isolate;
}

.mode-indicator {
	position: absolute;
	top: 4px;
	bottom: 4px;
	left: 4px;
	width: calc(50% - 4px);
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.08);
	transform: translateX(calc(var(--idx, 0) * 100%));
	transition: transform var(--motion-luxury);
	z-index: 0;
}

.mode-tab {
	position: relative;
	z-index: 1;
	min-width: 88px;
	padding: 7px 18px;
	border: 0;
	background: transparent;
	color: var(--text-muted);
	font: inherit;
	font-size: 13px;
	font-weight: 500;
	letter-spacing: 0.01em;
	cursor: pointer;
	border-radius: 999px;
	transition: color var(--motion-luxury);
}

.mode-tab.active {
	color: #ffffff;
}

.mode-tab:focus-visible {
	outline: none;
	box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18);
}
</style>
