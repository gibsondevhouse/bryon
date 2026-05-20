<script lang="ts">
import { session } from '$lib/features/streaming/session.svelte';
import { defaultLLMParams } from '$lib/shared/schemas';

const RADIUS = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Prefer per-turn budget reported by the server when available; fall back to
// the configured num_ctx so the meter still renders before the first turn.
const max = $derived(
	session.contextBudget?.contextLimit ??
		session.settings?.llm.params.num_ctx ??
		defaultLLMParams.num_ctx,
);
const used = $derived(
	session.contextBudget?.tokensIn ?? session.metrics?.tokensIn ?? 0,
);
const pct = $derived(Math.min(1, max > 0 ? used / max : 0));
const percentLabel = $derived(`${Math.round(pct * 100)}%`);
const dashOffset = $derived(CIRCUMFERENCE * (1 - pct));
const softCapReached = $derived(session.contextBudget?.softCapReached ?? false);

const tone = $derived(
	softCapReached || pct >= 0.85
		? 'danger'
		: pct >= 0.6
			? 'warn'
			: 'ok',
);

const title = $derived(
	softCapReached
		? `Soft cap reached — earlier turns were summarized. Used ${used.toLocaleString()} / ${max.toLocaleString()} tokens (${percentLabel}).`
		: used > 0
			? `Context used: ${used.toLocaleString()} / ${max.toLocaleString()} tokens (${percentLabel})`
			: `Context window: ${max.toLocaleString()} tokens`,
);
</script>

<div class="meter" data-tone={tone} title={title} aria-label={title}>
	<svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
		<circle
			class="track"
			cx="9"
			cy="9"
			r={RADIUS}
			fill="none"
			stroke-width="2"
		/>
		<circle
			class="fill"
			cx="9"
			cy="9"
			r={RADIUS}
			fill="none"
			stroke-width="2"
			stroke-linecap="round"
			stroke-dasharray={CIRCUMFERENCE}
			stroke-dashoffset={dashOffset}
			transform="rotate(-90 9 9)"
		/>
	</svg>
	<span class="label">{percentLabel}</span>
</div>

<style>
.meter {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	color: var(--text-muted);
	font-size: 11px;
	font-variant-numeric: tabular-nums;
	user-select: none;
}

.meter svg {
	display: block;
	overflow: visible;
}

.track {
	stroke: var(--border-default);
}

.fill {
	stroke: var(--accent);
	transition: stroke-dashoffset 240ms ease, stroke 200ms ease;
}

.meter[data-tone='warn'] .fill {
	stroke: var(--amber);
}

.meter[data-tone='warn'] .label {
	color: var(--amber);
}

.meter[data-tone='danger'] .fill {
	stroke: var(--red);
}

.meter[data-tone='danger'] .label {
	color: var(--red);
}
</style>
