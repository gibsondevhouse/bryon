<script lang="ts">
type Props = {
	taskType: string;
	tier: number;
	model: string;
	remote: boolean;
	privacyDecision: string;
	errorCode?: string | null;
};

let {
	taskType,
	tier,
	model,
	remote,
	privacyDecision,
	errorCode = null,
}: Props = $props();

const TIER_LABELS: Record<number, string> = {
	1: 'Tier 1 local',
	2: 'Tier 2 local',
	3: 'Tier 3 remote-capable',
	4: 'Tier 4 direct remote',
};

const DECISION_COPY: Record<string, string> = {
	allowed_local: 'Allowed locally',
	allowed_remote: 'Allowed remote',
	blocked_local_only: 'Denied by local-only policy',
	tier3_disabled_fallback: 'Tier 3 disabled; used local fallback',
	remote_model_unconfigured_fallback:
		'Remote model missing; used local fallback',
	remote_preview_required_fallback:
		'Remote preview required; used local fallback',
	chat_pin: 'Used pinned chat model',
};

const tierLabel = $derived(TIER_LABELS[tier] ?? `Tier ${tier}`);
const decisionLabel = $derived(
	DECISION_COPY[privacyDecision] ?? privacyDecision,
);
</script>

<div class="routing-summary" class:remote class:blocked={privacyDecision === 'blocked_local_only'}>
	<div class="routing-top">
		<strong>{taskType}</strong>
		<span>{tierLabel}</span>
	</div>
	<code>{model}</code>
	<p>{decisionLabel}{errorCode ? ` (${errorCode})` : ''}</p>
</div>

<style>
.routing-summary {
	display: grid;
	gap: 5px;
}

.routing-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-2);
}

.routing-top span {
	color: var(--text-muted);
	font-size: 12px;
}

.routing-summary p {
	margin: 0;
	color: var(--text-secondary);
	font-size: 12.5px;
}

.routing-summary.remote p {
	color: var(--accent-text);
}

.routing-summary.blocked p {
	color: var(--red);
}
</style>
