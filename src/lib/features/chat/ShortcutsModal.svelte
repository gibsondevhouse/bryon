<script lang="ts">
import { X } from '@lucide/svelte';
import { Dialog, DialogContent, DialogTitle } from '$lib/ui/dialog';

let {
	open = $bindable(false),
}: {
	open?: boolean;
} = $props();

const isMac =
	typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

const shortcuts: Array<{ keys: string[]; label: string }> = [
	{ keys: [mod, '/'], label: 'Show keyboard shortcuts' },
	{ keys: [mod, 'K'], label: 'Quick chat switcher' },
	{ keys: [mod, 'L'], label: 'Focus composer' },
	{ keys: [mod, 'Shift', 'F'], label: 'Search messages' },
	{ keys: ['Enter'], label: 'Send message' },
	{ keys: ['Shift', 'Enter'], label: 'New line in composer' },
	{ keys: ['Esc'], label: 'Cancel streaming · close dialog' },
	{ keys: ['/'], label: 'Run a slash command (type /help)' },
];

function close(): void {
	open = false;
}
</script>

<Dialog bind:open>
	<DialogContent
		showCloseButton={false}
		class="shortcuts-dialog max-w-[min(100%,480px)] p-0"
		aria-labelledby="shortcuts-title"
	>
		<header class="dialog-header">
			<DialogTitle id="shortcuts-title">Keyboard shortcuts</DialogTitle>
			<button class="close-btn" type="button" onclick={close} aria-label="Close">
				<X size={18} />
			</button>
		</header>

		<ul class="shortcut-list">
			{#each shortcuts as s}
				<li class="shortcut-row">
					<span class="label">{s.label}</span>
					<span class="keys">
						{#each s.keys as k, i}
							{#if i > 0}<span class="plus">+</span>{/if}
							<kbd>{k}</kbd>
						{/each}
					</span>
				</li>
			{/each}
		</ul>
	</DialogContent>
</Dialog>

<style>
.dialog-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--sp-4) var(--sp-5);
	border-bottom: 1px solid var(--border-subtle);
}

.dialog-header :global([data-slot='dialog-title']) {
	margin: 0;
	font-size: 16px;
	font-weight: 600;
	color: var(--text-primary);
}

.close-btn {
	display: grid;
	place-items: center;
	width: 30px;
	height: 30px;
	border: 1px solid transparent;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	transition:
		background var(--motion-fast),
		color var(--motion-fast);
}

.close-btn:hover {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

.shortcut-list {
	list-style: none;
	margin: 0;
	padding: var(--sp-2) var(--sp-3) var(--sp-3);
	max-height: min(80vh, 520px);
	overflow: auto;
}

.shortcut-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-4);
	padding: var(--sp-2) var(--sp-3);
	border-radius: var(--radius-sm);
	font-size: 13px;
	color: var(--text-secondary);
}

.shortcut-row:hover {
	background: var(--bg-surface-hover);
}

.label {
	color: var(--text-primary);
}

.keys {
	display: inline-flex;
	align-items: center;
	gap: 4px;
}

.plus {
	font-size: 11px;
	color: var(--text-muted);
}

kbd {
	display: inline-grid;
	place-items: center;
	min-width: 22px;
	height: 22px;
	padding: 0 6px;
	border: 1px solid var(--border-default);
	border-bottom-width: 2px;
	border-radius: 5px;
	background: var(--bg-base);
	font-family: 'SF Mono', 'JetBrains Mono', ui-monospace, monospace;
	font-size: 11px;
	color: var(--text-secondary);
}
</style>
