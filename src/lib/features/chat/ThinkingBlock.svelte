<script lang="ts">
import { ChevronRight } from '@lucide/svelte';

let {
	thinking = '',
	isStreaming = false,
}: {
	thinking?: string;
	isStreaming?: boolean;
} = $props();

let open = $state(false);
let contentEl: HTMLDivElement | undefined = $state();

$effect(() => {
	if (isStreaming) open = true;
});

$effect(() => {
	void thinking;
	if (isStreaming && open && contentEl) {
		contentEl.scrollTop = contentEl.scrollHeight;
	}
});
</script>

<div class="thinking-block">
	<button class="toggle" onclick={() => { open = !open; }} aria-expanded={open}>
		<span class="chevron" class:open><ChevronRight size={12} strokeWidth={2.5} /></span>
		<span class="label">{isStreaming ? 'Thinking…' : 'Reasoning'}</span>
		{#if isStreaming}
			<span class="pulse-dot"></span>
		{/if}
	</button>

	{#if open}
		<div class="content" bind:this={contentEl}>
			<pre class="thinking-pre">{thinking}</pre>
		</div>
	{/if}
</div>

<style>
.thinking-block {
	margin-bottom: var(--sp-4);
}

.toggle {
	display: inline-flex;
	align-items: center;
	gap: var(--sp-2);
	padding: 3px var(--sp-2) 3px var(--sp-1);
	border: 1px solid var(--border-subtle);
	border-radius: 6px;
	background: transparent;
	color: var(--text-muted);
	font-size: 12px;
	font-weight: 500;
	cursor: pointer;
	transition: background 120ms ease, color 120ms ease;
	user-select: none;
}

.toggle:hover {
	background: var(--bg-surface);
	color: var(--text-secondary);
}

.chevron {
	display: flex;
	align-items: center;
	transition: transform 180ms ease;
}
.chevron.open {
	transform: rotate(90deg);
}

.pulse-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--accent);
	opacity: 0.7;
	animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
	0%, 100% { opacity: 0.3; }
	50% { opacity: 0.9; }
}

.content {
	margin-top: var(--sp-2);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-sm);
	background: var(--bg-surface);
	max-height: 280px;
	overflow-y: auto;
}

.thinking-pre {
	margin: 0;
	padding: var(--sp-3) var(--sp-4);
	font-family: 'SF Mono', 'JetBrains Mono', ui-monospace, monospace;
	font-size: 12px;
	line-height: 1.65;
	color: var(--text-muted);
	white-space: pre-wrap;
	word-break: break-word;
}
</style>
