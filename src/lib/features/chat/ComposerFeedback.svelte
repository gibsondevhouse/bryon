<script lang="ts">
let { message }: { message: string } = $props();
</script>

<div class="feedback" role="status" aria-live="polite">{message}</div>

<style>
.feedback {
	border-radius: var(--radius-sm);
	background: var(--bg-surface);
	padding: var(--sp-2) var(--sp-3);
	font-size: 13px;
	color: var(--text-secondary);
}
</style>
