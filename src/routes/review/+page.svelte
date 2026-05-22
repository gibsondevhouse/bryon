<script lang="ts">
import { untrack } from 'svelte';
import { goto } from '$app/navigation';
import { ClipboardCheck, FileText } from '@lucide/svelte';
import { fmtDate } from '$lib/utils';
import DoctrineStatusBadge from '$lib/features/doctrine/DoctrineStatusBadge.svelte';
import type { Plan, PlanStatus } from '$lib/shared/types';

let { data } = $props();

let plans = $state<Plan[]>(untrack(() => data.plans));

// TODO(Phase 102): replace with plan.doctrineLifecycle once planSchema exposes it.
function doctrineLifecycleFor(status: PlanStatus): string {
	const mapping: Record<string, string> = {
		ideation: 'proposed',
		definition: 'drafting',
		drafting: 'drafting',
		execution: 'active',
		active: 'active',
		maintenance: 'archived',
	};
	return mapping[status] ?? 'proposed';
}

const activePlans = $derived(
	plans.filter((p) => ['execution', 'active'].includes(p.status) && !p.archivedAt)
);
const archivedPlans = $derived(
	plans.filter((p) => p.status === 'maintenance' || p.archivedAt)
);
const allReviewable = $derived([...activePlans, ...archivedPlans]);
</script>

<svelte:head>
	<title>Review — Bryon</title>
</svelte:head>

<div class="shell">
	<header class="page-header">
		<div class="header-left">
			<ClipboardCheck size={18} strokeWidth={2} class="header-icon" />
			<h1 class="page-title">After Action Review</h1>
		</div>
		<span class="header-count">{allReviewable.length} plans</span>
	</header>

	<div class="content">
		{#if allReviewable.length === 0}
			<div class="empty-state">
				<FileText size={40} strokeWidth={1.2} class="empty-icon" />
				<p class="empty-text">No plans ready for review yet.</p>
				<p class="empty-sub">Plans in Active or Archived lifecycle will appear here for After Action Review.</p>
			</div>
		{:else}
			{#if activePlans.length > 0}
				<section class="review-section">
					<h2 class="section-label">Active — In-Progress Reviews</h2>
					<div class="plan-list">
						{#each activePlans as plan (plan.id)}
							<button
								class="review-card"
								type="button"
								onclick={() => goto(`/plans/${plan.id}`)}
							>
								<div class="card-main">
									<span class="card-name">{plan.name}</span>
									{#if plan.summary}
										<span class="card-summary">{plan.summary}</span>
									{/if}
								</div>
								<div class="card-side">
									<DoctrineStatusBadge kind="plan" status={doctrineLifecycleFor(plan.status)} />
									<span class="card-date">{fmtDate(plan.updatedAt)}</span>
								</div>
							</button>
						{/each}
					</div>
				</section>
			{/if}

			{#if archivedPlans.length > 0}
				<section class="review-section">
					<h2 class="section-label">Archived — Completed Reviews</h2>
					<div class="plan-list">
						{#each archivedPlans as plan (plan.id)}
							<button
								class="review-card"
								type="button"
								onclick={() => goto(`/plans/${plan.id}`)}
							>
								<div class="card-main">
									<span class="card-name">{plan.name}</span>
									{#if plan.summary}
										<span class="card-summary">{plan.summary}</span>
									{/if}
								</div>
								<div class="card-side">
									<DoctrineStatusBadge kind="plan" status={doctrineLifecycleFor(plan.status)} />
									<span class="card-date">{fmtDate(plan.updatedAt)}</span>
								</div>
							</button>
						{/each}
					</div>
				</section>
			{/if}
		{/if}
	</div>
</div>

<style>
.shell {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.page-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--sp-6) var(--sp-6) var(--sp-5);
	border-bottom: 1px solid var(--border-subtle);
	flex-shrink: 0;
}

.header-left {
	display: flex;
	align-items: center;
	gap: var(--sp-3);
}

.header-left :global(.header-icon) {
	color: var(--text-muted);
}

.page-title {
	font-size: var(--font-size-heading);
	font-weight: 700;
	color: var(--text-primary);
	letter-spacing: -0.01em;
}

.header-count {
	font-size: 12px;
	font-weight: 500;
	color: var(--text-muted);
}

.content {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	padding: var(--sp-6);
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: var(--sp-3);
	padding: var(--sp-12) var(--sp-6);
	text-align: center;
}

.empty-state :global(.empty-icon) {
	color: var(--text-placeholder);
	margin-bottom: var(--sp-2);
}

.empty-text {
	font-size: 15px;
	font-weight: 500;
	color: var(--text-secondary);
}

.empty-sub {
	font-size: 13px;
	color: var(--text-muted);
	max-width: 360px;
	line-height: 1.55;
}

.review-section {
	margin-bottom: var(--sp-8);
}

.section-label {
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.07em;
	text-transform: uppercase;
	color: var(--text-muted);
	padding: 0 2px var(--sp-3);
}

.plan-list {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.review-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-4);
	padding: 14px 16px;
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
	background: var(--bg-surface);
	cursor: pointer;
	text-align: left;
	font-family: inherit;
	transition: border-color var(--motion-fast), background var(--motion-fast);
}

.review-card:hover {
	border-color: var(--border-default);
	background: var(--bg-surface-hover);
}

.card-main {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
	flex: 1;
}

.card-name {
	font-size: 14px;
	font-weight: 500;
	color: var(--text-primary);
	line-height: 1.4;
}

.card-summary {
	font-size: 12px;
	color: var(--text-muted);
	line-height: 1.45;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.card-side {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: var(--sp-2);
	flex-shrink: 0;
}

.card-date {
	font-size: 11px;
	color: var(--text-placeholder);
}
</style>
