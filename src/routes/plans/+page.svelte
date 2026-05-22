<script lang="ts">
import { untrack } from 'svelte';
import { goto } from '$app/navigation';
import { Plus, X, Archive, AlertTriangle } from '@lucide/svelte';
import { fmtDate } from '$lib/utils';
import { Dialog, DialogContent, DialogTitle } from '$lib/ui/dialog';
import { session } from '$lib/features/streaming/session.svelte';
import DoctrineStatusBadge from '$lib/features/doctrine/DoctrineStatusBadge.svelte';
import type { DoctrineLifecycle, Plan } from '$lib/shared/types';

let { data } = $props();

type DoctrineColumn = { id: DoctrineLifecycle; label: string };

const COLUMNS: DoctrineColumn[] = [
	{ id: 'proposed', label: 'Proposed' },
	{ id: 'drafting', label: 'Drafting' },
	{ id: 'active', label: 'Active' },
	{ id: 'archived', label: 'Archived' },
];

let plans = $state<Plan[]>(untrack(() => data.plans));

let draggingId = $state<string | null>(null);
let dragOverColumn = $state<string | null>(null);

let modalOpen = $state(false);
let newName = $state('');
let newSummary = $state('');
let newType = $state('');
let newStartDate = $state('');
let nameInput: HTMLInputElement | undefined = $state();
let submitting = $state(false);

function openModal(): void {
	newName = '';
	newSummary = '';
	newType = '';
	newStartDate = '';
	modalOpen = true;
	setTimeout(() => nameInput?.focus(), 50);
}

function closeModal(): void {
	modalOpen = false;
}

async function submitPlan(e: SubmitEvent): Promise<void> {
	e.preventDefault();
	const trimmed = newName.trim();
	if (!trimmed || submitting) return;
	submitting = true;

	try {
		const res = await fetch('/api/plans', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: trimmed,
				summary: newSummary.trim() || null,
				planType: newType.trim() || null,
				startDate: newStartDate || null,
			}),
		});
		if (!res.ok) throw new Error(await res.text());
		const { plan } = await res.json();
		plans = [...plans, plan];
		session.plans = [...session.plans, plan];
		closeModal();
	} finally {
		submitting = false;
	}
}

function columnPlans(col: DoctrineColumn): Plan[] {
	return plans.filter((p) => p.doctrineLifecycle === col.id);
}

function onDragStart(e: DragEvent, plan: Plan): void {
	draggingId = plan.id;
	e.dataTransfer?.setData('text/plain', plan.id);
	if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(): void {
	draggingId = null;
	dragOverColumn = null;
}

function onColumnDragOver(e: DragEvent, colId: string): void {
	e.preventDefault();
	dragOverColumn = colId;
	if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
}

function onColumnDragLeave(e: DragEvent): void {
	const rel = e.relatedTarget as HTMLElement | null;
	if (!rel || !(e.currentTarget as HTMLElement).contains(rel)) {
		dragOverColumn = null;
	}
}

async function onColumnDrop(e: DragEvent, colId: string): Promise<void> {
	e.preventDefault();
	const id = e.dataTransfer?.getData('text/plain');
	if (!id) return;
	const plan = plans.find((p) => p.id === id);
	const targetLifecycle = colId as DoctrineLifecycle;
	if (!plan || plan.doctrineLifecycle === targetLifecycle) {
		draggingId = null;
		dragOverColumn = null;
		return;
	}
	plans = plans.map((p) =>
		p.id === id ? { ...p, doctrineLifecycle: targetLifecycle } : p,
	);
	draggingId = null;
	dragOverColumn = null;

	try {
		const res = await fetch(`/api/plans/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ doctrineLifecycle: targetLifecycle }),
		});
		if (!res.ok) {
			plans = plans.map((p) => (p.id === id ? plan : p));
		} else {
			const { plan: updated } = await res.json();
			plans = plans.map((p) => (p.id === id ? updated : p));
		}
	} catch {
		plans = plans.map((p) => (p.id === id ? plan : p));
		session.plans = plans;
	}
}

let justDragged = $state(false);

function onDragStartWrapped(e: DragEvent, plan: Plan): void {
	justDragged = false;
	onDragStart(e, plan);
}

function onDragEndWrapped(): void {
	justDragged = true;
	onDragEnd();
	setTimeout(() => {
		justDragged = false;
	}, 150);
}

function onCardClick(plan: Plan): void {
	if (justDragged) return;
	goto(`/plans/${plan.id}`);
}

async function archivePlan(e: MouseEvent, plan: Plan): Promise<void> {
	e.stopPropagation();
	const res = await fetch(`/api/plans/${plan.id}`, { method: 'DELETE' });
	if (res.ok) {
		plans = plans.filter((p) => p.id !== plan.id);
		session.plans = session.plans.filter((p) => p.id !== plan.id);
	}
}

const formatDate = fmtDate;
</script>

<svelte:head>
	<title>Plans — Bryon</title>
</svelte:head>

<div class="shell">
	<header class="board-header">
		<h1 class="board-title">Plans</h1>
		<button class="new-plan-btn" type="button" onclick={openModal}>
			<Plus size={13} strokeWidth={2.5} />
			<span>New Plan</span>
		</button>
	</header>

	<div class="board">
		{#each COLUMNS as col (col.id)}
			<div
				class="col"
				class:drop-active={dragOverColumn === col.id && draggingId !== null}
				role="region"
				aria-label="{col.label} column"
				ondragover={(e) => onColumnDragOver(e, col.id)}
				ondragleave={onColumnDragLeave}
				ondrop={(e) => onColumnDrop(e, col.id)}
			>
				<div class="col-header">
					<span class="col-label">{col.label}</span>
					<span class="col-count">{columnPlans(col).length}</span>
				</div>

				<div class="col-body">
					{#each columnPlans(col) as plan (plan.id)}
						<div
							class="plan-card"
							class:is-dragging={draggingId === plan.id}
							draggable="true"
							role="button"
							tabindex="0"
							ondragstart={(e) => onDragStartWrapped(e, plan)}
							ondragend={onDragEndWrapped}
							onclick={() => onCardClick(plan)}
							onkeydown={(e) => e.key === 'Enter' && onCardClick(plan)}
						>
							<div class="card-top">
								<span class="plan-name">{plan.name}</span>
								<button
									class="card-archive-btn"
									type="button"
									title="Archive plan"
									aria-label="Archive {plan.name}"
									onclick={(e) => void archivePlan(e, plan)}
								>
									<Archive size={11} />
								</button>
							</div>
							<div class="card-meta">
								<DoctrineStatusBadge kind="plan" status={plan.doctrineLifecycle} />
								<span class="plan-date">{formatDate(plan.updatedAt)}</span>
							</div>
						</div>
					{:else}
						<div class="col-empty">No plans</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<Dialog bind:open={modalOpen}>
	<DialogContent showCloseButton={false} class="new-plan-dialog" aria-labelledby="new-plan-title">
		<header class="modal-header">
			<DialogTitle id="new-plan-title">New Plan</DialogTitle>
			<button class="modal-close" type="button" onclick={closeModal} aria-label="Close">
				<X size={16} />
			</button>
		</header>

		<form class="modal-body" onsubmit={submitPlan}>
			<div class="modal-fields">
				<div class="field">
					<label class="field-label" for="plan-name">Name <span class="required">*</span></label>
					<input bind:this={nameInput} id="plan-name" class="field-input" type="text" placeholder="e.g. Q3 infrastructure migration" bind:value={newName} required autocomplete="off" />
				</div>
				<div class="field">
					<label class="field-label" for="plan-gap">Mission Need / Gap <span class="optional">optional</span></label>
					<textarea id="plan-gap" class="field-input field-textarea" placeholder="What capability gap or need does this plan address?" bind:value={newSummary} rows="3"></textarea>
				</div>
				<div class="field-row">
					<div class="field">
						<label class="field-label" for="plan-type">Type <span class="optional">optional</span></label>
						<input id="plan-type" class="field-input" type="text" placeholder="e.g. software, ops" bind:value={newType} autocomplete="off" />
					</div>
					<div class="field">
						<label class="field-label" for="plan-start">Start date <span class="optional">optional</span></label>
						<input id="plan-start" class="field-input field-date" type="date" bind:value={newStartDate} />
					</div>
				</div>
			</div>

			<div class="modal-actions">
				<button type="button" class="btn-ghost" onclick={closeModal}>Cancel</button>
				<button type="submit" class="btn-primary" disabled={!newName.trim() || submitting}>
					Create Plan
				</button>
			</div>
		</form>
	</DialogContent>
</Dialog>

<style>
.shell {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.board-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--sp-6) var(--sp-6) var(--sp-5);
	border-bottom: 1px solid var(--border-subtle);
	flex-shrink: 0;
}

.board-title {
	font-size: var(--font-size-heading);
	font-weight: 700;
	color: var(--text-primary);
	letter-spacing: -0.01em;
}

.new-plan-btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 7px 14px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-secondary);
	font-size: 13px;
	font-weight: 500;
	font-family: inherit;
	cursor: pointer;
	transition: color var(--motion-fast), background var(--motion-fast), border-color var(--motion-fast);
}

.new-plan-btn:hover {
	background: var(--bg-surface);
	border-color: var(--border-strong);
	color: var(--text-primary);
}

.board {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	grid-template-rows: minmax(0, 1fr);
	gap: var(--sp-6);
	padding: var(--sp-5) var(--sp-6) var(--sp-6);
	overflow: hidden;
}

.col {
	display: flex;
	flex-direction: column;
	overflow: hidden;
	border-radius: var(--radius-md);
	padding: var(--sp-2);
	background: transparent;
	transition: background var(--motion-fast), outline-color var(--motion-fast);
	outline: 1px solid transparent;
	outline-offset: -1px;
}

.col.drop-active {
	background: rgba(77, 107, 254, 0.035);
	outline-color: rgba(77, 107, 254, 0.22);
}

.col-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 2px 4px var(--sp-3);
	flex-shrink: 0;
}

.col-label {
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.07em;
	text-transform: uppercase;
	color: var(--text-muted);
}

.col-count {
	font-size: 11px;
	font-weight: 600;
	color: var(--text-placeholder);
	min-width: 18px;
	height: 18px;
	display: grid;
	place-items: center;
	border-radius: 4px;
	background: var(--bg-surface);
}

.col-body {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding-right: 2px;
}

.plan-card {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 13px 14px;
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
	background: var(--bg-surface);
	cursor: grab;
	user-select: none;
	transition: transform 230ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 230ms cubic-bezier(0.215, 0.61, 0.355, 1), border-color var(--motion-fast), opacity var(--motion-fast);
}

.plan-card:hover {
	transform: translateY(-2px);
	border-color: var(--border-default);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.32), 0 1px 3px rgba(0, 0, 0, 0.18);
}

.plan-card:active { cursor: grabbing; }
.plan-card.is-dragging { opacity: 0.4; transform: scale(0.98); box-shadow: none; }

.card-top {
	display: flex;
	align-items: flex-start;
	gap: 8px;
}

.plan-name {
	flex: 1;
	font-size: 13.5px;
	font-weight: 500;
	color: var(--text-primary);
	line-height: 1.45;
}

.card-meta {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
}

.plan-date {
	font-size: 11px;
	color: var(--text-placeholder);
	margin-left: auto;
}

.card-archive-btn {
	flex-shrink: 0;
	display: grid;
	place-items: center;
	width: 20px;
	height: 20px;
	border: 1px solid transparent;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-placeholder);
	cursor: pointer;
	opacity: 0;
	margin-top: 1px;
	transition: opacity var(--motion-fast), background var(--motion-fast), color var(--motion-fast);
}

.plan-card:hover .card-archive-btn { opacity: 1; }
.card-archive-btn:hover { background: rgba(248, 113, 113, 0.12); color: var(--red, #f87171); }

.col-empty {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: var(--sp-8) var(--sp-4);
	color: var(--text-placeholder);
	font-size: 12px;
	border: 1px dashed var(--border-hair);
	border-radius: var(--radius-md);
}

/* ── Modal ── */
:global(.new-plan-dialog) {
	background: var(--bg-base);
	border: 1px solid var(--border-default);
	border-radius: var(--radius-lg);
	box-shadow: var(--shadow-lg);
	padding: 0;
	max-width: min(96vw, 540px);
	width: 100%;
}

.modal-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--sp-4) var(--sp-5);
	border-bottom: 1px solid var(--border-subtle);
}

.modal-header :global([data-slot='dialog-title']) {
	margin: 0;
	font-size: 16px;
	font-weight: 600;
	color: var(--text-primary);
}

.modal-close {
	display: grid;
	place-items: center;
	width: 28px;
	height: 28px;
	border: 1px solid transparent;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	transition: background var(--motion-fast), color var(--motion-fast);
}

.modal-close:hover {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

.modal-body {
	display: flex;
	flex-direction: column;
	gap: 0;
}

.modal-fields {
	display: flex;
	flex-direction: column;
	gap: var(--sp-4);
	padding: var(--sp-5);
}

.field {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
	flex: 1;
}

.field-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--sp-3);
}

.field-label {
	font-size: 12.5px;
	font-weight: 600;
	color: var(--text-secondary);
}

.required { color: var(--red, #f87171); margin-left: 2px; }
.optional { font-weight: 400; color: var(--text-placeholder); margin-left: 4px; font-size: 11px; }

.field-input {
	padding: 8px 11px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-surface);
	color: var(--text-primary);
	font-size: 13.5px;
	font-family: inherit;
	outline: none;
	transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}

.field-input::placeholder { color: var(--text-placeholder); }
.field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(77, 107, 254, 0.14); }
.field-textarea { resize: vertical; min-height: 80px; line-height: 1.55; }
.field-date { color-scheme: dark; }

.modal-actions {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: var(--sp-2);
	padding: var(--sp-3) var(--sp-5);
	border-top: 1px solid var(--border-subtle);
}

.btn-ghost {
	padding: 7px 14px;
	border: 1px solid transparent;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-secondary);
	font-size: 13px;
	font-weight: 500;
	font-family: inherit;
	cursor: pointer;
	transition: background var(--motion-fast), color var(--motion-fast);
}

.btn-ghost:hover { background: var(--bg-surface-hover); color: var(--text-primary); }

.btn-primary {
	padding: 7px 16px;
	border: 1px solid var(--accent);
	border-radius: var(--radius-sm);
	background: var(--accent);
	color: #fff;
	font-size: 13px;
	font-weight: 600;
	font-family: inherit;
	cursor: pointer;
	transition: opacity var(--motion-fast), background var(--motion-fast);
}

.btn-primary:hover:not(:disabled) { background: color-mix(in oklab, var(--accent) 85%, #fff); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
