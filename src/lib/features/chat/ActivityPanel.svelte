<script lang="ts">
import { X, Brain, BookOpen } from '@lucide/svelte';
import { session } from '$lib/features/streaming/session.svelte';

const activeMessageId = $derived(session.activeActivityMessageId);

const activeMessage = $derived.by(() =>
	activeMessageId
		? session.messages.find((m) => m.id === activeMessageId) ?? null
		: null,
);

const isStreamingThisMessage = $derived(
	session.streaming &&
		activeMessageId !== null &&
		!session.messages.some((m) => m.id === activeMessageId && m.role === 'assistant'),
);

const thinkingText = $derived.by(() => {
	if (!activeMessageId) return '';
	if (isStreamingThisMessage) return session.streamingThinking;
	return session.thinkingByMessageId.get(activeMessageId) ?? '';
});

const thinkingDurationMs = $derived.by(() => {
	if (!activeMessageId) return 0;
	if (isStreamingThisMessage) return session.streamingThinkingDurationMs;
	return session.thinkingDurationByMessageId.get(activeMessageId) ?? 0;
});

const articles = $derived.by(() => {
	if (!activeMessageId) return [];
	return session.articlesByMessageId.get(activeMessageId) ?? [];
});

const durationLabel = $derived.by(() => {
	const ms = thinkingDurationMs;
	if (!ms) return '';
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
});

let thinkingEl: HTMLDivElement | undefined = $state();

$effect(() => {
	void thinkingText;
	if (isStreamingThisMessage && thinkingEl) {
		thinkingEl.scrollTop = thinkingEl.scrollHeight;
	}
});

function close(): void {
	session.closeActivity();
}

function articleDomain(url: string): string {
	try {
		const u = new URL(url);
		return u.hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}
</script>

<aside class="activity-panel">
	<header class="panel-header">
		<span class="panel-title">Activity</span>
		<button class="close-btn" onclick={close} title="Close" aria-label="Close activity panel">
			<X size={16} />
		</button>
	</header>

	{#if !activeMessage && !isStreamingThisMessage}
		<div class="empty">
			Select a message's <strong>Activity</strong> button to see how it was formed.
		</div>
	{:else}
		<section class="section">
			<div class="section-header">
				<Brain size={14} />
				<span class="section-title">Thinking</span>
				{#if isStreamingThisMessage && !thinkingText}
					<span class="status">Waiting…</span>
				{:else if isStreamingThisMessage}
					<span class="status pulse">Thinking… {durationLabel}</span>
				{:else if thinkingText}
					<span class="status">Thought for {durationLabel}</span>
				{:else}
					<span class="status muted">No reasoning recorded</span>
				{/if}
			</div>
			{#if thinkingText}
				<div class="thinking-content" bind:this={thinkingEl}>
					<pre class="thinking-pre">{thinkingText}</pre>
				</div>
			{/if}
		</section>

		<section class="section">
			<div class="section-header">
				<BookOpen size={14} />
				<span class="section-title">Sources</span>
				{#if articles.length > 0}
					<span class="status">{articles.length}</span>
				{:else}
					<span class="status muted">None this turn</span>
				{/if}
			</div>
			{#if articles.length > 0}
				<ol class="sources-list">
					{#each articles as article, i (article.url)}
						<li class="source-item">
							<span class="source-num">{i + 1}</span>
							<a class="source-link" href={article.url} target="_blank" rel="noopener noreferrer">
								<span class="source-title">{article.title}</span>
								<span class="source-domain">{articleDomain(article.url)}</span>
							</a>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	{/if}
</aside>

<style>
.activity-panel {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
	background: transparent;
	overflow: hidden;
}

.panel-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--sp-3) var(--sp-4);
	border-bottom: 1px solid var(--border-subtle);
	flex-shrink: 0;
}

.panel-title {
	font-size: 13px;
	font-weight: 600;
	color: var(--text-secondary);
	letter-spacing: 0.01em;
}

.close-btn {
	display: grid;
	place-items: center;
	width: 28px;
	height: 28px;
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	transition: background var(--motion-fast), color var(--motion-fast);
}
.close-btn:hover {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

.empty {
	padding: var(--sp-6) var(--sp-4);
	font-size: 13px;
	color: var(--text-muted);
	line-height: 1.6;
}

.section {
	padding: var(--sp-4);
	border-bottom: 1px solid var(--border-subtle);
	overflow: hidden;
	flex-shrink: 0;
}
.section:last-child {
	border-bottom: none;
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
}

.section-header {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	margin-bottom: var(--sp-3);
	color: var(--text-secondary);
}

.section-title {
	font-size: 12px;
	font-weight: 600;
	letter-spacing: 0.03em;
	text-transform: uppercase;
}

.status {
	margin-left: auto;
	font-size: 11px;
	color: var(--text-muted);
	font-weight: 500;
}
.status.muted { opacity: 0.7; }
.status.pulse { color: var(--accent-text); }
.status.pulse::before {
	content: '';
	display: inline-block;
	width: 6px;
	height: 6px;
	margin-right: 6px;
	border-radius: 50%;
	background: var(--accent);
	animation: panel-pulse 1.4s ease-in-out infinite;
	vertical-align: middle;
}
@keyframes panel-pulse {
	0%, 100% { opacity: 0.3; }
	50% { opacity: 1; }
}

.thinking-content {
	max-height: 320px;
	overflow-y: auto;
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-sm);
	background: var(--bg-surface);
}

.thinking-pre {
	margin: 0;
	padding: var(--sp-3);
	font-family: 'SF Mono', 'JetBrains Mono', ui-monospace, monospace;
	font-size: 12px;
	line-height: 1.6;
	color: var(--text-muted);
	white-space: pre-wrap;
	word-break: break-word;
}

.sources-list {
	margin: 0;
	padding: 0;
	list-style: none;
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
	overflow-y: auto;
}

.source-item {
	display: flex;
	gap: var(--sp-3);
	padding: var(--sp-2) var(--sp-3);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-sm);
	background: var(--bg-surface);
	transition: border-color var(--motion-fast), background var(--motion-fast);
}
.source-item:hover {
	border-color: var(--border-strong);
	background: var(--bg-surface-hover);
}

.source-num {
	flex-shrink: 0;
	width: 20px;
	height: 20px;
	display: grid;
	place-items: center;
	font-size: 11px;
	font-weight: 600;
	color: var(--text-secondary);
	background: var(--accent-soft);
	border-radius: 4px;
}

.source-link {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
	text-decoration: none;
	color: inherit;
}

.source-title {
	font-size: 13px;
	font-weight: 500;
	color: var(--text-primary);
	line-height: 1.35;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.source-domain {
	font-size: 11px;
	color: var(--text-muted);
}
</style>
