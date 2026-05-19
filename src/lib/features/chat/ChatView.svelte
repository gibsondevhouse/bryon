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
				<h1 class="empty-title">What can I help with?</h1>
				<Composer
					bind:this={composerEmpty}
					{chatId}
					bind:draft={session.draft}
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
	width: 100%;
	max-width: 720px;
	padding: 0 var(--sp-6);
}

.empty-title {
	margin: 0 0 var(--sp-8);
	text-align: center;
	font-size: 30px;
	font-weight: 700;
	letter-spacing: -0.03em;
	color: var(--text-primary);
}
</style>
