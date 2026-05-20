<script lang="ts">
import { RotateCcw } from '@lucide/svelte';
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
	const time = d.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
	});
	const full = d.toLocaleString('en-US', {
		dateStyle: 'medium',
		timeStyle: 'short',
	});
	return { short: time, full };
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
	<article class="msg-container" role="article" aria-label="Message from user">
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
	<article class="msg msg-assistant" class:streaming={isStreaming} role="article" aria-label="Message from Bryon">
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

/* ── User message ── */
.msg-user {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	justify-content: flex-end;
}

.user-bubble {
	max-width: 85%;
	padding: var(--sp-3) var(--sp-4);
	border-radius: var(--radius-lg) var(--radius-lg) var(--sp-1) var(--radius-lg);
	background: var(--bg-user-msg);
	border: 1px solid var(--border-subtle);
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

/* ── Assistant message ── */
.assistant-label {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	margin-bottom: var(--sp-3);
	font-size: 13px;
	font-weight: 600;
	color: var(--text-secondary);
}

.bot-icon {
	display: grid;
	place-items: center;
	width: 22px;
	height: 22px;
	border-radius: 6px;
	background: var(--accent);
	color: white;
}

.assistant-body {
	padding-left: 30px; /* align with text after icon + gap */
}

/* ── Prose (markdown) ── */
.prose {
	font-size: 15px;
	line-height: 1.75;
	color: var(--text-primary);
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.prose :global(p)            { margin: 0 0 var(--sp-3); }
.prose :global(p:last-child) { margin: 0; }

.prose :global(pre) {
	margin: var(--sp-4) 0;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-code);
	padding: var(--sp-4);
	overflow-x: auto;
	color: #cdd6f4;
	font-size: 13px;
	line-height: 1.6;
}

/* ── Shiki-enhanced code block ── */
.prose :global(.code-block) {
	margin: var(--sp-4) 0;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	overflow: hidden;
	background: #fff;
}
.prose :global(.code-block .code-header) {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-2);
	padding: 4px var(--sp-2) 4px var(--sp-3);
	border-bottom: 1px solid var(--border-subtle);
	background: var(--bg-surface);
	font-size: 11px;
	color: var(--text-muted);
	font-family: 'SF Mono', 'JetBrains Mono', ui-monospace, monospace;
}
.prose :global(.code-block .code-lang) {
	text-transform: lowercase;
	letter-spacing: 0.04em;
}
.prose :global(.code-block .code-copy) {
	border: 1px solid transparent;
	border-radius: 4px;
	background: transparent;
	color: var(--text-muted);
	font-family: inherit;
	font-size: 11px;
	padding: 2px 8px;
	cursor: pointer;
}
.prose :global(.code-block .code-copy:hover) {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}
.prose :global(.code-block .code-copy.copied) {
	color: var(--green);
}
.prose :global(.code-block .code-body) {
	overflow-x: auto;
	font-size: 13px;
	line-height: 1.55;
}
.prose :global(.code-block .code-body pre) {
	margin: 0;
	border: none;
	border-radius: 0;
	padding: var(--sp-3) var(--sp-4);
	background: #fff !important;
	color: inherit;
	font-size: 13px;
	overflow: visible;
}
.prose :global(.code-block .code-body code) {
	font-size: 13px;
	background: transparent;
	padding: 0;
	color: inherit;
}

.prose :global(code) {
	font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace;
	font-size: 0.88em;
}

.prose :global(:not(pre) > code) {
	border-radius: 5px;
	background: var(--accent-soft);
	padding: 2px 7px;
	color: var(--accent-text);
}

.prose :global(ul),
.prose :global(ol) { margin: var(--sp-2) 0; padding-left: 22px; }
.prose :global(li)  { margin-bottom: var(--sp-1); }
.prose :global(li::marker) { color: var(--text-muted); }

.prose :global(blockquote) {
	margin: var(--sp-4) 0;
	border-left: 3px solid var(--accent);
	padding: var(--sp-1) 0 var(--sp-1) var(--sp-4);
	color: var(--text-secondary);
}

.prose :global(h1),
.prose :global(h2),
.prose :global(h3) {
	margin: var(--sp-6) 0 var(--sp-2);
	font-weight: 650;
	color: var(--text-primary);
	line-height: 1.4;
}
.prose :global(h1) { font-size: 1.3em; }
.prose :global(h2) { font-size: 1.15em; }
.prose :global(h3) { font-size: 1.05em; }

.prose :global(table) {
	width: 100%; margin: var(--sp-4) 0; border-collapse: collapse; font-size: 14px;
}
.prose :global(th),
.prose :global(td) {
	border: 1px solid var(--border-default); padding: var(--sp-2) var(--sp-3); text-align: left;
}
.prose :global(th) { background: var(--bg-surface); font-weight: 600; }

.prose :global(hr) {
	margin: var(--sp-6) 0; border: none; border-top: 1px solid var(--border-subtle);
}
.prose :global(a)       { color: var(--accent-text); text-decoration: none; }
.prose :global(a:hover) { text-decoration: underline; }
.prose :global(strong)  { font-weight: 650; color: var(--text-primary); }

/* ── Image attachments ── */
.msg-images {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: var(--sp-2);
	margin-bottom: var(--sp-2);
	max-width: 85%;
}

.msg-img-btn {
	padding: 0;
	background: none;
	border: none;
	cursor: zoom-in;
	border-radius: var(--radius-sm);
	overflow: hidden;
	flex-shrink: 0;
}

.msg-img {
	display: block;
	max-width: 200px;
	max-height: 180px;
	object-fit: cover;
	border-radius: var(--radius-sm);
	border: 1px solid var(--border-subtle);
}

.msg-docs {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: var(--sp-2);
	margin-bottom: var(--sp-2);
	max-width: 85%;
}

.msg-doc {
	display: inline-flex;
	align-items: center;
	gap: var(--sp-2);
	max-width: 260px;
	padding: var(--sp-2) var(--sp-3);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-sm);
	background: var(--bg-surface);
	color: var(--text-secondary);
	font-size: 12px;
}

.msg-doc span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
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
