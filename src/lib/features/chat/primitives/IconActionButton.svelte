<script lang="ts">
let {
	title,
	label,
	disabled = false,
	danger = false,
	tabindex = undefined,
	onclick,
	children,
}: {
	title: string;
	label: string;
	disabled?: boolean;
	danger?: boolean;
	tabindex?: number | undefined;
	onclick?: () => void;
	children?: import('svelte').Snippet;
} = $props();
</script>

<button
	class="icon-btn"
	class:danger
	type="button"
	{disabled}
	{title}
	tabindex={tabindex}
	aria-label={label}
	onclick={onclick}
>
	{@render children?.()}
</button>

<style>
.icon-btn {
	display: grid;
	place-items: center;
	width: 30px;
	height: 30px;
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	transition:
		color var(--motion-fast),
		background var(--motion-fast);
}

.icon-btn:hover:not(:disabled) {
	color: var(--text-secondary);
	background: var(--bg-surface);
}

.icon-btn.danger:hover:not(:disabled) {
	color: #fda4af;
	background: rgba(239, 68, 68, 0.12);
}

.icon-btn:disabled {
	opacity: 0.55;
	cursor: default;
}
</style>
