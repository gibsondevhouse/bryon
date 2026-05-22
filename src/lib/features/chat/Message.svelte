<script lang="ts">
import { RotateCcw } from '@lucide/svelte';
import { fmtDate, fmtTime } from '$lib/utils';
import type { Attachment, Message } from '$lib/shared/types';
import type { NewsArticle } from '$lib/shared/stream-events';
import MessageActions from './MessageActions.svelte';
import MessageMeta from './primitives/MessageMeta.svelte';
import ArticlesCarousel from './ArticlesCarousel.svelte';
import ThinkingChip from './ThinkingChip.svelte';
import MessageHeader from './MessageHeader.svelte';
import AssistantMarkdown from './AssistantMarkdown.svelte';
import UserMessage from './UserMessage.svelte';
import { session } from '$lib/features/streaming/session.svelte';

let {
	message,
	isStreaming = false,
	streamingContent = '',
	thinking,
	thinkingDurationMs = 0,
	articles,
	onRetry,
}: {
	message?: Message;
	isStreaming?: boolean;
	streamingContent?: string;
	thinking?: string;
	thinkingDurationMs?: number;
	articles?: NewsArticle[];
	onRetry?: () => void;
} = $props();

function openActivity(): void {
	if (isStreaming) {
		session.openActivityFor('streaming');
		return;
	}
	if (message?.id) session.openActivityFor(message.id);
}

const content = $derived(isStreaming ? streamingContent : (message?.content ?? ''));
const role = $derived(isStreaming ? 'assistant' : (message?.role ?? 'assistant'));
const isError = $derived(
	!isStreaming &&
		message?.role === 'assistant' &&
		message.msTotal === null &&
		message.id.startsWith('error-'),
);
const isCancelled = $derived(
	!isStreaming &&
		message?.role === 'assistant' &&
		message.msTotal === null &&
		!isError &&
		message.content.length > 0,
);

const timestamp = $derived.by(() => {
	if (isStreaming || !message?.createdAt) return null;
	const d = new Date(message.createdAt);
	return { short: fmtTime(d), full: `${fmtDate(d)} ${fmtTime(d)}` };
});

const attachments = $derived.by((): Attachment[] => {
	const json = isStreaming ? null : (message?.attachmentsJson ?? null);
	if (!json) return [];
	try {
		return JSON.parse(json) as Attachment[];
	} catch {
		return [];
	}
});

let lightboxSrc = $state<string | null>(null);

function openLightbox(src: string): void {
	lightboxSrc = src;
}
function closeLightbox(): void {
	lightboxSrc = null;
}
function handleLightboxClick(event: MouseEvent): void {
	if (event.target === event.currentTarget) closeLightbox();
}
function handleLightboxKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape') closeLightbox();
}
</script>

{#if role === 'system' || role === 'tool_call' || role === 'tool_result'}
	<!-- hidden -->
{:else if role === 'user'}
	<article class="msg-container" aria-label="Message from user">
		<UserMessage {content} {attachments} onOpenLightbox={openLightbox} />
		{#if timestamp}
			<div class="msg-user">
				<time class="ts ts-user" datetime={new Date(message?.createdAt ?? 0).toISOString()} title={timestamp.full}>
					<MessageMeta value={timestamp.short} kind="timestamp" />
				</time>
			</div>
		{/if}

		{#if lightboxSrc}
			<dialog
				class="lightbox"
				open
				onclick={handleLightboxClick}
				onkeydown={handleLightboxKeydown}
				aria-label="Image preview"
			>
				<img src={lightboxSrc} alt="Full-size preview" class="lightbox-img" />
			</dialog>
		{/if}
	</article>
{:else}
	<article class="msg msg-assistant" class:streaming={isStreaming} aria-label="Message from Bryon">
		<MessageHeader />

		<div class="assistant-body">
			{#if thinking || isStreaming}
				<ThinkingChip
					hasThinking={!!thinking}
					{isStreaming}
					durationMs={thinkingDurationMs}
					onclick={openActivity}
				/>
			{/if}

			{#if content}
				<AssistantMarkdown {content} {isStreaming} />
			{:else if isStreaming}
				<span class="dots"><span></span><span></span><span></span></span>
			{/if}

			{#if isCancelled}
				<div class="cancelled-row">
					<em>Cancelled</em>
					{#if onRetry}
						<button class="retry-btn" onclick={onRetry}><RotateCcw size={12} /> Retry</button>
					{/if}
				</div>
			{:else if isError && onRetry}
				<div class="cancelled-row">
					<button class="retry-btn" onclick={onRetry}><RotateCcw size={12} /> Retry</button>
				</div>
			{/if}

			{#if content && !isStreaming}
				<MessageActions
					{content}
					msTotal={message?.msTotal ?? null}
					tokensOut={message?.tokensOut ?? null}
					onOpenActivity={openActivity}
					{onRetry}
				/>
				{#if timestamp}
					<time class="ts ts-assistant" datetime={new Date(message?.createdAt ?? 0).toISOString()} title={timestamp.full}>
						<MessageMeta value={timestamp.short} kind="timestamp" />
					</time>
				{/if}
				{#if articles && articles.length > 0}
					<ArticlesCarousel {articles} />
				{/if}
			{/if}
		</div>
	</article>
{/if}

<style>
/* ── Message block ── */
.msg {
	padding: var(--sp-5) 0;
}

.ts {
	display: inline-flex;
}
.ts-user {
	margin-top: var(--sp-1);
	margin-right: var(--sp-1);
}
.ts-assistant {
	margin-top: var(--sp-1);
	opacity: 0;
	transition: opacity 180ms ease;
}
:global(.msg:hover) .ts-assistant {
	opacity: 1;
}

.assistant-body {
	padding-left: 30px; /* align with text after icon + gap */
}

/* ── Lightbox ── */
.lightbox {
	position: fixed;
	inset: 0;
	margin: 0;
	width: 100%;
	height: 100%;
	max-width: 100%;
	max-height: 100%;
	background: rgba(0, 0, 0, 0.8);
	border: none;
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 9999;
	cursor: zoom-out;
	padding: var(--sp-6);
}

.lightbox-img {
	max-width: 90vw;
	max-height: 90vh;
	object-fit: contain;
	border-radius: var(--radius-sm);
	cursor: default;
}

/* ── Cancelled row ── */
.cancelled-row {
	display: flex;
	align-items: center;
	gap: var(--sp-3);
	margin-top: var(--sp-2);
	font-size: 13px;
	color: var(--text-muted);
}

.retry-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	border: 1px solid var(--border-default);
	border-radius: 6px;
	background: transparent;
	padding: 3px 8px;
	font-size: 12px;
	color: var(--text-muted);
	cursor: pointer;
}

.retry-btn:hover {
	background: var(--bg-surface);
	color: var(--text-primary);
}

/* ── Thinking dots ── */
.dots { display: inline-flex; gap: 5px; padding: var(--sp-1) 0; }
.dots span {
	width: 5px; height: 5px; border-radius: 50%;
	background: var(--text-muted); animation: blink 1.4s infinite both;
}
.dots span:nth-child(2) { animation-delay: 0.2s; }
.dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
	0%, 80%, 100% { opacity: 0.15; }
	40% { opacity: 1; }
}
</style>
