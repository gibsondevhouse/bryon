<script lang="ts">
import type { SessionMetrics } from '$lib/features/streaming/session.svelte';

import { session } from '$lib/features/streaming/session.svelte';

let {
	model,
	streaming = false,
	metrics = null,
	contextTokens = 0,
	contextLimit = 8192,
}: {
	model: string;
	streaming?: boolean;
	metrics?: SessionMetrics | null;
	contextTokens?: number;
	contextLimit?: number;
} = $props();

const contextLabel = $derived(
	`${(contextTokens / 1000).toFixed(1)}k / ${(contextLimit / 1000).toFixed(1)}k ctx`,
);

const tpsLabel = $derived(
	metrics?.tps ? `${metrics.tps.toFixed(1)} tok/s` : '',
);

const ttftLabel = $derived(
	metrics?.ttft ? `${(metrics.ttft / 1000).toFixed(2)}s ttft` : '',
);
</script>

<div class="status" role="contentinfo" aria-label="Chat status">
	<span class="item model" title="Model">{model}</span>
	<span class="sep">&middot;</span>

	<div class="item health-indicator" title="Ollama Status: {session.ollamaState}">
		<span class="dot" class:ready={session.ollamaState === 'ready'} class:unreachable={session.ollamaState === 'unreachable'}></span>
		Ollama
	</div>
	<span class="sep">&middot;</span>

	<span class="item">{contextLabel}</span>

	{#if streaming}
		<span class="sep">&middot;</span>
		<span class="item generating">Generating</span>
		{#if ttftLabel}
			<span class="sep">&middot;</span>
			<span class="item ttft-flash">{ttftLabel}</span>
		{/if}
	{:else if tpsLabel}
		<span class="sep">&middot;</span>
		<span class="item">{tpsLabel}</span>
		{#if ttftLabel}
			<span class="sep">&middot;</span>
			<span class="item">{ttftLabel}</span>
		{/if}
	{/if}
</div>

<style>
.status {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 6px 24px;
	border-top: 1px solid var(--border-subtle);
	background: var(--bg-base);
}

.item {
	color: var(--text-muted);
	font-size: 11px;
	font-weight: 500;
	white-space: nowrap;
}

.model {
	font-family: 'SF Mono', 'JetBrains Mono', ui-monospace, monospace;
	font-size: 10px;
	letter-spacing: 0.02em;
}

.health-indicator {
	display: flex;
	align-items: center;
	gap: 6px;
}

.dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--text-muted);
}

.dot.ready {
	background: var(--green);
	box-shadow: 0 0 4px var(--green);
}

.dot.unreachable {
	background: var(--red);
}

.sep {
	color: var(--text-muted);
	font-size: 11px;
	opacity: 0.5;
}

.generating {
	color: var(--primary);
	animation: pulse 2s ease-in-out infinite;
}

.ttft-flash {
	color: var(--primary);
	animation: ttft-fade 1.2s ease-out;
}

@keyframes pulse {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.4; }
}

@keyframes ttft-fade {
	0% { opacity: 0; transform: translateY(2px); }
	100% { opacity: 1; transform: none; }
}
</style>
