<script lang="ts">
import { Copy, Check, RotateCcw, ThumbsUp, ThumbsDown, Sparkles } from '@lucide/svelte';
import IconActionButton from './primitives/IconActionButton.svelte';
import MessageMeta from './primitives/MessageMeta.svelte';

let {
	content,
	msTotal = null,
	tokensOut = null,
	onRetry,
	onOpenActivity,
}: {
	content: string;
	msTotal?: number | null;
	tokensOut?: number | null;
	onRetry?: () => void;
	onOpenActivity?: () => void;
} = $props();

let copied = $state(false);

async function copyContent(): Promise<void> {
	try {
		await navigator.clipboard.writeText(content);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	} catch {
		/* clipboard fallback not needed for local app */
	}
}
</script>

<div class="actions">
	<IconActionButton
		onclick={copyContent}
		title={copied ? 'Copied' : 'Copy'}
		label={copied ? 'Copied to clipboard' : 'Copy message'}
	>
		{#if copied}<Check size={15} />{:else}<Copy size={15} />{/if}
	</IconActionButton>
	{#if onRetry}
		<IconActionButton onclick={onRetry} title="Regenerate" label="Regenerate response">
			<RotateCcw size={15} />
		</IconActionButton>
	{/if}
	<IconActionButton title="Good response" label="Mark as good response">
		<ThumbsUp size={15} />
	</IconActionButton>
	<IconActionButton title="Bad response" label="Mark as bad response">
		<ThumbsDown size={15} />
	</IconActionButton>
	{#if onOpenActivity}
		<IconActionButton onclick={onOpenActivity} title="Activity" label="Open activity panel">
			<Sparkles size={15} />
		</IconActionButton>
	{/if}

	{#if msTotal && tokensOut}
		<div class="meta-wrap">
			<MessageMeta value={`${(msTotal / 1000).toFixed(1)}s · ${tokensOut} tok`} />
		</div>
	{/if}
</div>

<style>
.actions {
	display: flex;
	align-items: center;
	gap: var(--sp-1);
	margin-top: var(--sp-3);
	opacity: 0;
	transition: opacity 180ms ease;
}

:global(.msg:hover) .actions,
.actions:focus-within {
	opacity: 1;
}
.meta-wrap {
	margin-left: auto;
}
</style>
