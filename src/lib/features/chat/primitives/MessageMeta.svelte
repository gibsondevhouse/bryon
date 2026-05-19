<script lang="ts">
let {
	value,
	kind = 'inline',
}: {
	value: string;
	kind?: 'inline' | 'timestamp';
} = $props();
</script>

<span class="meta" class:timestamp={kind === 'timestamp'}>{value}</span>

<style>
.meta {
	font-size: 11px;
	color: var(--text-muted);
	font-variant-numeric: tabular-nums;
}

.meta.timestamp {
	display: inline-block;
}
</style>
