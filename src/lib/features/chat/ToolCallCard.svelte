<script lang="ts">
import { CircleCheck, CircleX, Wrench } from '@lucide/svelte';

let {
	callId,
	name,
	args,
	result = null,
}: {
	callId: string;
	name: string;
	args: Record<string, unknown>;
	result?: {
		ok: boolean;
		result?: unknown;
		code?: string;
		error?: string;
	} | null;
} = $props();

const summary = $derived.by(() => {
	if (!result) return `${name} • running`;
	if (result.ok) return `${name} • success`;
	return `${name} • failed`;
});

const resultJson = $derived.by(() => {
	if (!result) return '';
	return result.ok
		? JSON.stringify(result.result ?? null, null, 2)
		: JSON.stringify(
				{
					code: result.code ?? 'EXECUTION',
					error: result.error ?? 'Tool execution failed.',
				},
				null,
				2,
			);
});
</script>

<details class="tool-card" class:failed={result && !result.ok}>
	<summary>
		<span class="left">
			<Wrench size={14} />
			<span>{summary}</span>
		</span>
		<span class="status">
			{#if !result}
				…
			{:else if result.ok}
				<CircleCheck size={14} />
			{:else}
				<CircleX size={14} />
			{/if}
		</span>
	</summary>

	<div class="body">
		<div class="block">
			<div class="label">args</div>
			<pre>{JSON.stringify(args, null, 2)}</pre>
		</div>
		{#if result}
			<div class="block">
				<div class="label">result</div>
				<pre>{resultJson}</pre>
			</div>
		{/if}
		<div class="call-id">{callId}</div>
	</div>
</details>

<style>
.tool-card {
	margin: var(--sp-2) 0 var(--sp-3) 30px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-surface);
	overflow: hidden;
}

.tool-card.failed {
	border-color: color-mix(in srgb, var(--red) 58%, transparent);
}

summary {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-2);
	padding: var(--sp-2) var(--sp-3);
	cursor: pointer;
	list-style: none;
	font-size: 13px;
	color: var(--text-secondary);
}

summary::-webkit-details-marker {
	display: none;
}

.left {
	display: inline-flex;
	align-items: center;
	gap: var(--sp-2);
	min-width: 0;
}

.status {
	display: inline-flex;
	align-items: center;
	color: var(--text-muted);
}

.tool-card.failed .status {
	color: var(--red);
}

.body {
	border-top: 1px solid var(--border-subtle);
	padding: var(--sp-2) var(--sp-3);
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
}

.label {
	font-size: 11px;
	color: var(--text-muted);
	margin-bottom: 4px;
	text-transform: uppercase;
}

pre {
	margin: 0;
	font-size: 12px;
	line-height: 1.5;
	white-space: pre-wrap;
	word-break: break-word;
	color: var(--text-primary);
	background: var(--bg-input);
	border: 1px solid var(--border-subtle);
	border-radius: 6px;
	padding: var(--sp-2);
}

.call-id {
	font-size: 11px;
	color: var(--text-muted);
	font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
