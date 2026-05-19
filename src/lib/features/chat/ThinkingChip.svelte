<script lang="ts">
import { Brain, ChevronRight } from '@lucide/svelte';

let {
	hasThinking = false,
	isStreaming = false,
	durationMs = 0,
	onclick,
}: {
	hasThinking?: boolean;
	isStreaming?: boolean;
	durationMs?: number;
	onclick?: () => void;
} = $props();

const label = $derived.by(() => {
	if (isStreaming && !hasThinking) return 'Thinking…';
	if (isStreaming && hasThinking) {
		return durationMs > 0 ? `Thinking… ${formatDuration(durationMs)}` : 'Thinking…';
	}
	if (hasThinking && durationMs > 0) return `Thought for ${formatDuration(durationMs)}`;
	if (hasThinking) return 'Reasoning';
	return '';
});

function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}
</script>

{#if label}
	<button class="chip" class:streaming={isStreaming} {onclick} title="Open activity panel">
		<span class="icon"><Brain size={12} strokeWidth={2.25} /></span>
		<span class="text">{label}</span>
		<span class="caret"><ChevronRight size={12} strokeWidth={2.5} /></span>
	</button>
{/if}

<style>
.chip {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	margin-bottom: var(--sp-3);
	padding: 3px var(--sp-2) 3px var(--sp-2);
	border: 1px solid var(--border-subtle);
	border-radius: 6px;
	background: transparent;
	color: var(--text-muted);
	font-size: 12px;
	font-weight: 500;
	cursor: pointer;
	transition:
		background var(--motion-fast),
		color var(--motion-fast),
		border-color var(--motion-fast);
}

.chip:hover {
	background: var(--bg-surface);
	color: var(--text-primary);
	border-color: var(--border-default);
}

.icon {
	display: flex;
	align-items: center;
	color: var(--text-muted);
}
.chip:hover .icon {
	color: var(--accent-text);
}

.chip.streaming {
	color: var(--accent-text);
	border-color: var(--accent-soft);
}
.chip.streaming .icon {
	color: var(--accent);
	animation: chip-pulse 1.4s ease-in-out infinite;
}

@keyframes chip-pulse {
	0%, 100% { opacity: 0.5; }
	50% { opacity: 1; }
}

.caret {
	display: flex;
	align-items: center;
	opacity: 0.6;
}
</style>
