<script lang="ts">
import { CircleCheck, Circle, AlertTriangle } from '@lucide/svelte';
import type { PlanReadiness } from './readiness';

let { readiness }: { readiness: PlanReadiness } = $props();

const pct = $derived(Math.round(readiness.score * 100));
</script>

<div class="readiness">
	<div class="readiness-header">
		<span class="readiness-title">Readiness</span>
		<span class="readiness-score" class:ready={readiness.ready} class:not-ready={!readiness.ready}>
			{pct}%
		</span>
	</div>
	<div class="checks">
		{#each readiness.checks as check (check.key)}
			<div class="check-row" class:passed={check.passed} class:failed={!check.passed}>
				{#if check.passed}
					<CircleCheck size={14} />
				{:else if check.required}
					<AlertTriangle size={14} />
				{:else}
					<Circle size={14} />
				{/if}
				<span class="check-label">{check.label}</span>
				{#if check.required && !check.passed}
					<span class="required-tag">Required</span>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
.readiness {
	display: flex;
	flex-direction: column;
	gap: var(--sp-3);
}

.readiness-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.readiness-title {
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: var(--text-muted);
}

.readiness-score {
	font-size: 13px;
	font-weight: 700;
}

.readiness-score.ready {
	color: #6ee7b7;
}

.readiness-score.not-ready {
	color: #fcd34d;
}

.checks {
	display: flex;
	flex-direction: column;
	gap: var(--sp-1);
}

.check-row {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	padding: 4px 0;
	font-size: 12.5px;
}

.check-row.passed {
	color: #6ee7b7;
}

.check-row.failed {
	color: var(--text-muted);
}

.check-label {
	flex: 1;
	min-width: 0;
}

.required-tag {
	font-size: 9px;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: #fcd34d;
	background: rgba(251, 191, 36, 0.12);
	padding: 1px 6px;
	border-radius: 999px;
}
</style>
