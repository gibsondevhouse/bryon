<script lang="ts">
import { Globe } from '@lucide/svelte';

let {
	webSearch = false,
	onToggleWebSearch,
}: {
	webSearch?: boolean;
	onToggleWebSearch: () => void;
} = $props();
</script>

<div class="toolbar">
	<div class="toolbar-left">
		<button
			class="tool-btn"
			class:active={webSearch}
			title={webSearch ? 'Web lookup on for next message' : 'Use web lookup for next message'}
			aria-pressed={webSearch}
			onclick={onToggleWebSearch}
		>
			<Globe size={14} />
			<span>{webSearch ? 'Web on' : 'Web'}</span>
		</button>
	</div>
</div>

<style>
.toolbar {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	padding: 0 var(--sp-2);
}

.toolbar-left {
	display: flex;
	gap: var(--sp-2);
}

.tool-btn {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	height: 28px;
	padding: 0 var(--sp-3);
	border: 0;
	border-radius: var(--radius-full);
	background: transparent;
	color: var(--text-muted);
	font-size: 12px;
	font-weight: 500;
	cursor: pointer;
	transition:
		background-color var(--motion-luxury),
		color var(--motion-luxury);
}

.tool-btn:hover {
	color: var(--text-secondary);
	background: rgba(255, 255, 255, 0.04);
}

.tool-btn.active {
	color: #ffffff;
	background: rgba(255, 255, 255, 0.08);
}

.tool-btn.active:hover {
	background: rgba(255, 255, 255, 0.12);
}
</style>
