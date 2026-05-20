<script lang="ts">
import { Bot } from '@lucide/svelte';
</script>

<div class="assistant-label">
	<span class="bot-icon"><Bot size={14} strokeWidth={2} /></span>
	<span>Bryon</span>
</div>

<style>
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
</style>
