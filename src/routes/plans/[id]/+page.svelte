<script lang="ts">
import { untrack } from 'svelte';
import { ArrowLeft, Plus, Trash2, CircleCheck, Circle } from '@lucide/svelte';
import { session } from '$lib/features/streaming/session.svelte';
import { fmtDate } from '$lib/utils';
import DoctrineStatusBadge from '$lib/features/doctrine/DoctrineStatusBadge.svelte';
import PlanCardBoard from '$lib/features/doctrine/PlanCardBoard.svelte';
import { evaluatePlanReadiness } from '$lib/features/doctrine/readiness';
import type { Plan, Task } from '$lib/shared/types';

let { data } = $props();

const initialPlan = untrack(() => data.plan);
const initialTasks = untrack(() => data.tasks);

let plan = $state<Plan>(initialPlan);
let tasks = $state<Task[]>(initialTasks);

// ── Name edit ──
let editingName = $state(false);
let nameValue = $state(initialPlan.name);
let nameInput: HTMLInputElement | undefined = $state();

function startNameEdit(): void {
	nameValue = plan.name;
	editingName = true;
	setTimeout(() => {
		nameInput?.focus();
		nameInput?.select();
	}, 20);
}

async function commitName(): Promise<void> {
	editingName = false;
	const trimmed = nameValue.trim();
	if (!trimmed || trimmed === plan.name) return;
	try {
		const res = await fetch(`/api/plans/${plan.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: trimmed }),
		});
		if (res.ok) {
			const { plan: updated } = await res.json();
			plan = updated;
			session.plans = session.plans.map((p) => (p.id === plan.id ? updated : p));
		}
	} catch {
		// silent — name stays unchanged visually
	}
}

function onNameKey(e: KeyboardEvent): void {
	if (e.key === 'Enter') {
		e.preventDefault();
		void commitName();
	} else if (e.key === 'Escape') {
		editingName = false;
	}
}

// ── Tabs ──
type Tab = 'mission' | 'intent' | 'doctrine' | 'tasks';
let activeTab = $state<Tab>('mission');

// ── Doctrine fields ──
let missionGap = $state(initialPlan.doctrine.missionNeed.gap ?? '');
let missionContext = $state(initialPlan.doctrine.missionNeed.context ?? '');
let intentPurpose = $state(initialPlan.doctrine.commandersIntent.purpose ?? '');
let intentEndState = $state(initialPlan.doctrine.commandersIntent.endState ?? '');
let intentKeyTasks = $state<string[]>(initialPlan.doctrine.commandersIntent.keyTasks);
let intentConstraints = $state<string[]>(initialPlan.doctrine.commandersIntent.constraints);

// ── Auto-save ──
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
let saveStatus = $state<SaveStatus>('idle');
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSave(): void {
	clearTimeout(saveTimer);
	saveStatus = 'saving';
	saveTimer = setTimeout(() => void commitDoctrine(), 1000);
}

async function commitDoctrine(): Promise<void> {
	try {
		const res = await fetch(`/api/plans/${plan.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				missionNeed: {
					gap: missionGap.trim() || null,
					context: missionContext.trim() || null,
					priority: plan.doctrine.missionNeed.priority,
					source: plan.doctrine.missionNeed.source,
				},
				commandersIntent: {
					purpose: intentPurpose.trim() || null,
					endState: intentEndState.trim() || null,
					keyTasks: intentKeyTasks.filter(Boolean),
					constraints: intentConstraints.filter(Boolean),
				},
			}),
		});
		if (res.ok) {
			const { plan: updated } = await res.json();
			plan = updated;
			session.plans = session.plans.map((p) => (p.id === plan.id ? updated : p));
			saveStatus = 'saved';
			setTimeout(() => {
				saveStatus = 'idle';
			}, 2000);
		} else {
			saveStatus = 'error';
		}
	} catch {
		saveStatus = 'error';
	}
}

// ── Readiness ──
const readiness = $derived(
	evaluatePlanReadiness({
		lifecycle: plan.doctrineLifecycle,
		missionNeed: {
			gap: missionGap || null,
			context: missionContext || null,
			priority: plan.doctrine.missionNeed.priority,
			source: plan.doctrine.missionNeed.source,
		},
		commandersIntent: {
			purpose: intentPurpose || null,
			keyTasks: intentKeyTasks.filter(Boolean),
			endState: intentEndState || null,
			constraints: intentConstraints.filter(Boolean),
		},
		lineOfEffort: [],
		oplan: {
			missionStatement: null,
			executionTimeline: [],
			taskOrganization: [],
			sustainment: [],
			annexes: [],
			references: [],
		},
	}),
);
const readinessPct = $derived(Math.round(readiness.score * 100));

// ── Key tasks ──
let newKeyTask = $state('');

function addKeyTask(): void {
	const t = newKeyTask.trim();
	if (!t) return;
	intentKeyTasks = [...intentKeyTasks, t];
	newKeyTask = '';
	scheduleSave();
}

function removeKeyTask(i: number): void {
	intentKeyTasks = intentKeyTasks.filter((_, idx) => idx !== i);
	scheduleSave();
}

function onKeyTaskKey(e: KeyboardEvent): void {
	if (e.key === 'Enter') {
		e.preventDefault();
		addKeyTask();
	}
}

// ── Constraints ──
let newConstraint = $state('');

function addConstraint(): void {
	const c = newConstraint.trim();
	if (!c) return;
	intentConstraints = [...intentConstraints, c];
	newConstraint = '';
	scheduleSave();
}

function removeConstraint(i: number): void {
	intentConstraints = intentConstraints.filter((_, idx) => idx !== i);
	scheduleSave();
}

function onConstraintKey(e: KeyboardEvent): void {
	if (e.key === 'Enter') {
		e.preventDefault();
		addConstraint();
	}
}

// ── Tasks ──
let newTaskTitle = $state('');
let addingTask = $state(false);

async function addTask(): Promise<void> {
	const title = newTaskTitle.trim();
	if (!title || addingTask) return;
	addingTask = true;
	try {
		const res = await fetch(`/api/plans/${plan.id}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title }),
		});
		if (res.ok) {
			const { task } = await res.json();
			tasks = [...tasks, task];
			newTaskTitle = '';
		}
	} finally {
		addingTask = false;
	}
}

async function toggleTask(task: Task): Promise<void> {
	const next = !task.done;
	tasks = tasks.map((t) => (t.id === task.id ? { ...t, done: next } : t));
	try {
		await fetch(`/api/plans/${plan.id}/tasks/${task.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ done: next }),
		});
	} catch {
		tasks = tasks.map((t) => (t.id === task.id ? { ...t, done: !next } : t));
	}
}

async function deleteTask(task: Task): Promise<void> {
	tasks = tasks.filter((t) => t.id !== task.id);
	try {
		await fetch(`/api/plans/${plan.id}/tasks/${task.id}`, { method: 'DELETE' });
	} catch {
		tasks = [...tasks, task];
	}
}

const activeTasks = $derived(tasks.filter((t) => !t.done));
const completedTasks = $derived(tasks.filter((t) => t.done));
</script>

<svelte:head>
	<title>{plan.name} — Bryon</title>
</svelte:head>

<div class="workspace">
	<!-- Header -->
	<header class="ws-header">
		<a class="back-link" href="/plans"><ArrowLeft size={15} /> Plans</a>

		<div class="ws-header-main">
			<div class="ws-title-row">
				<div class="ws-title-group">
					{#if editingName}
						<input
							bind:this={nameInput}
							class="name-input"
							bind:value={nameValue}
							onkeydown={onNameKey}
							onblur={() => void commitName()}
						/>
					{:else}
						<h1 class="ws-title" ondblclick={startNameEdit} title="Double-click to rename">
							{plan.name}
						</h1>
					{/if}
					<DoctrineStatusBadge kind="plan" status={plan.doctrineLifecycle} />
				</div>

				<div class="ws-header-right">
					{#if saveStatus === 'saving'}
						<span class="save-indicator saving">Saving…</span>
					{:else if saveStatus === 'saved'}
						<span class="save-indicator saved"><CircleCheck size={12} /> Saved</span>
					{:else if saveStatus === 'error'}
						<button class="save-indicator error" onclick={() => void commitDoctrine()}>
							Retry save
						</button>
					{/if}
					<div
						class="readiness-badge"
						class:ready={readiness.ready}
						title="{readiness.checks.filter((c) => c.passed).length} of {readiness.checks
							.length} checks passed"
					>
						{readinessPct}% ready
					</div>
				</div>
			</div>

			<div class="ws-meta">
				<span>Created {fmtDate(plan.createdAt)}</span>
				{#if plan.summary}
					<span class="meta-sep">·</span>
					<span>{plan.summary}</span>
				{/if}
			</div>
		</div>
	</header>

	<!-- Tab nav -->
	<nav class="tabs-nav" aria-label="Plan workspace sections">
		<button
			class="tab-btn"
			class:active={activeTab === 'mission'}
			onclick={() => (activeTab = 'mission')}
		>
			Mission Need
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'intent'}
			onclick={() => (activeTab = 'intent')}
		>
			Commander's Intent
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'doctrine'}
			onclick={() => (activeTab = 'doctrine')}
		>
			Doctrine Cards
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'tasks'}
			onclick={() => (activeTab = 'tasks')}
		>
			Tasks
			{#if tasks.length > 0}
				<span class="tab-badge">{tasks.length}</span>
			{/if}
		</button>
	</nav>

	<!-- Tab panels -->
	<div class="tab-content">
		<!-- ── Mission Need ── -->
		{#if activeTab === 'mission'}
			<div class="panel-card">
				<div class="panel-card-header">
					<div class="panel-header-text">
						<h2 class="panel-heading">Mission Need</h2>
						<p class="panel-desc">Define the capability gap this plan addresses.</p>
					</div>
					<div class="panel-header-checks">
						<span class="field-check" class:filled={!!missionGap.trim()}>
							{#if missionGap.trim()}
								<CircleCheck size={13} />
							{:else}
								<Circle size={13} />
							{/if}
							Gap
						</span>
						<span class="field-check" class:filled={!!missionContext.trim()}>
							{#if missionContext.trim()}
								<CircleCheck size={13} />
							{:else}
								<Circle size={13} />
							{/if}
							Context
						</span>
					</div>
				</div>

				<div class="panel-card-body">
					<div class="form-field">
						<label class="form-label" for="mission-gap">
							<span class="form-label-text"
								>Capability Gap <span class="required-star" aria-hidden="true">*</span></span
							>
							<span class="form-label-hint"
								>The specific capability that is missing or insufficient</span
							>
						</label>
						<textarea
							id="mission-gap"
							class="form-textarea"
							placeholder="Describe the capability gap this plan addresses…"
							bind:value={missionGap}
							oninput={scheduleSave}
							rows="6"
							aria-required="true"
						></textarea>
					</div>

					<div class="form-field">
						<label class="form-label" for="mission-context">
							<span class="form-label-text">Operational Context</span>
							<span class="form-label-hint"
								>The environment, conditions and constraints surrounding this gap</span
							>
						</label>
						<textarea
							id="mission-context"
							class="form-textarea"
							placeholder="Describe the operational context…"
							bind:value={missionContext}
							oninput={scheduleSave}
							rows="6"
						></textarea>
					</div>
				</div>
			</div>

		<!-- ── Commander's Intent ── -->
		{:else if activeTab === 'intent'}
			<div class="panel-card">
				<div class="panel-card-header">
					<div class="panel-header-text">
						<h2 class="panel-heading">Commander's Intent</h2>
						<p class="panel-desc">Define what success looks like for this plan.</p>
					</div>
					<div class="panel-header-checks">
						<span class="field-check" class:filled={!!intentPurpose.trim()}>
							{#if intentPurpose.trim()}
								<CircleCheck size={13} />
							{:else}
								<Circle size={13} />
							{/if}
							Purpose
						</span>
						<span class="field-check" class:filled={!!intentEndState.trim()}>
							{#if intentEndState.trim()}
								<CircleCheck size={13} />
							{:else}
								<Circle size={13} />
							{/if}
							End state
						</span>
					</div>
				</div>

				<div class="panel-card-body">
					<div class="form-field">
						<label class="form-label" for="intent-purpose">
							<span class="form-label-text"
								>Purpose <span class="required-star" aria-hidden="true">*</span></span
							>
							<span class="form-label-hint"
								>The reason for action — why this plan matters</span
							>
						</label>
						<textarea
							id="intent-purpose"
							class="form-textarea"
							placeholder="State the purpose of this plan…"
							bind:value={intentPurpose}
							oninput={scheduleSave}
							rows="6"
							aria-required="true"
						></textarea>
					</div>

					<div class="form-field">
						<label class="form-label" for="intent-end-state">
							<span class="form-label-text">End State</span>
							<span class="form-label-hint"
								>The condition that must exist when the mission ends</span
							>
						</label>
						<textarea
							id="intent-end-state"
							class="form-textarea"
							placeholder="Describe what success looks like…"
							bind:value={intentEndState}
							oninput={scheduleSave}
							rows="6"
						></textarea>
					</div>

					<div class="form-field">
						<div class="form-label" role="group" aria-labelledby="key-tasks-label">
							<span id="key-tasks-label" class="form-label-text">Key Tasks</span>
							<span class="form-label-hint"
								>The essential actions required to achieve the intent</span
							>
						</div>
						{#if intentKeyTasks.length > 0}
							<ul class="items-list" aria-label="Key tasks">
								{#each intentKeyTasks as taskItem, i (i)}
									<li class="item-row">
										<span class="item-bullet" aria-hidden="true">●</span>
										<span class="item-text">{taskItem}</span>
										<button
											class="item-remove"
											onclick={() => removeKeyTask(i)}
											aria-label="Remove key task: {taskItem}"
										>
											<Trash2 size={12} />
										</button>
									</li>
								{/each}
							</ul>
						{/if}
						<div class="item-add">
							<input
								class="item-input"
								placeholder="Add a key task…"
								bind:value={newKeyTask}
								onkeydown={onKeyTaskKey}
								aria-label="New key task"
							/>
							<button
								class="item-add-btn"
								onclick={addKeyTask}
								disabled={!newKeyTask.trim()}
								aria-label="Add key task"
							>
								<Plus size={14} />
							</button>
						</div>
					</div>

					<div class="form-field">
						<div class="form-label" role="group" aria-labelledby="constraints-label">
							<span id="constraints-label" class="form-label-text">Constraints</span>
							<span class="form-label-hint">Limitations that must not be violated</span>
						</div>
						{#if intentConstraints.length > 0}
							<ul class="items-list" aria-label="Constraints">
								{#each intentConstraints as constraint, i (i)}
									<li class="item-row">
										<span class="item-bullet" aria-hidden="true">●</span>
										<span class="item-text">{constraint}</span>
										<button
											class="item-remove"
											onclick={() => removeConstraint(i)}
											aria-label="Remove constraint: {constraint}"
										>
											<Trash2 size={12} />
										</button>
									</li>
								{/each}
							</ul>
						{/if}
						<div class="item-add">
							<input
								class="item-input"
								placeholder="Add a constraint…"
								bind:value={newConstraint}
								onkeydown={onConstraintKey}
								aria-label="New constraint"
							/>
							<button
								class="item-add-btn"
								onclick={addConstraint}
								disabled={!newConstraint.trim()}
								aria-label="Add constraint"
							>
								<Plus size={14} />
							</button>
						</div>
					</div>
				</div>
			</div>

		<!-- ── Doctrine Cards ── -->
		{:else if activeTab === 'doctrine'}
			<div class="panel-card panel-card-board">
				<div class="panel-card-header">
					<div class="panel-header-text">
						<h2 class="panel-heading">Doctrine Cards</h2>
						<p class="panel-desc">
							Capture intelligence, resources and decisions across 10 doctrine areas.
						</p>
					</div>
				</div>
				<div class="panel-card-body panel-card-body-board">
					<PlanCardBoard planId={plan.id} />
				</div>
			</div>

		<!-- ── Tasks ── -->
		{:else if activeTab === 'tasks'}
			<div class="panel-card">
				<div class="panel-card-header">
					<div class="panel-header-text">
						<h2 class="panel-heading">Tasks</h2>
						<p class="panel-desc">Track actionable items for this plan.</p>
					</div>
					{#if tasks.length > 0}
						<div class="task-progress-badge">
							{completedTasks.length}/{tasks.length} done
						</div>
					{/if}
				</div>

				<div class="panel-card-body">
					<div class="task-add-row">
						<input
							class="task-input"
							placeholder="Add a task…"
							bind:value={newTaskTitle}
							onkeydown={(e) => e.key === 'Enter' && void addTask()}
							aria-label="New task title"
						/>
						<button
							class="task-add-btn"
							onclick={() => void addTask()}
							disabled={!newTaskTitle.trim() || addingTask}
						>
							<Plus size={14} /> Add
						</button>
					</div>

					{#if activeTasks.length === 0 && completedTasks.length === 0}
						<div class="tasks-empty">
							<p>No tasks yet. Add your first task above.</p>
						</div>
					{:else}
						{#if activeTasks.length > 0}
							<ul class="task-list" aria-label="Active tasks">
								{#each activeTasks as task (task.id)}
									<li class="task-row">
										<input
											type="checkbox"
											id="task-{task.id}"
											checked={task.done}
											onchange={() => void toggleTask(task)}
											aria-label="Mark complete: {task.title || task.body}"
										/>
										<label class="task-title" for="task-{task.id}">{task.title || task.body}</label>
										<button
											class="task-delete"
											onclick={() => void deleteTask(task)}
											aria-label="Delete task: {task.title || task.body}"
										>
											<Trash2 size={12} />
										</button>
									</li>
								{/each}
							</ul>
						{/if}

						{#if completedTasks.length > 0}
							<details class="completed-section">
								<summary class="completed-summary">{completedTasks.length} completed</summary>
								<ul class="task-list completed-list" aria-label="Completed tasks">
									{#each completedTasks as task (task.id)}
										<li class="task-row">
											<input
												type="checkbox"
												id="task-{task.id}"
												checked={task.done}
												onchange={() => void toggleTask(task)}
												aria-label="Mark incomplete: {task.title || task.body}"
											/>
											<label class="task-title done" for="task-{task.id}"
												>{task.title || task.body}</label
											>
										</li>
									{/each}
								</ul>
							</details>
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
.workspace {
	max-width: 900px;
	width: 100%;
	margin: 0 auto;
	padding: var(--sp-6);
	display: flex;
	flex-direction: column;
	gap: var(--sp-5);
}

/* ── Header ── */
.ws-header {
	display: flex;
	flex-direction: column;
	gap: var(--sp-3);
}

.back-link {
	display: inline-flex;
	align-items: center;
	gap: var(--sp-2);
	color: var(--text-muted);
	font-size: 13px;
	text-decoration: none;
	transition: color var(--motion-fast);
	width: fit-content;
}

.back-link:hover {
	color: var(--text-primary);
}

.ws-header-main {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
}

.ws-title-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-3);
	flex-wrap: wrap;
}

.ws-title-group {
	display: flex;
	align-items: center;
	gap: var(--sp-3);
	flex: 1;
	min-width: 0;
}

.ws-title {
	margin: 0;
	font-size: 24px;
	font-weight: 700;
	letter-spacing: -0.02em;
	color: var(--text-primary);
	cursor: text;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.name-input {
	font-size: 24px;
	font-weight: 700;
	letter-spacing: -0.02em;
	color: var(--text-primary);
	background: transparent;
	border: 1px solid var(--accent);
	border-radius: var(--radius-sm);
	padding: 2px 8px;
	font-family: inherit;
	outline: none;
	flex: 1;
	min-width: 0;
}

.ws-header-right {
	display: flex;
	align-items: center;
	gap: var(--sp-3);
	flex-shrink: 0;
}

.save-indicator {
	font-size: 12px;
	display: flex;
	align-items: center;
	gap: 4px;
}

.save-indicator.saving {
	color: var(--text-muted);
}

.save-indicator.saved {
	color: var(--green);
}

.save-indicator.error {
	color: var(--red);
	background: none;
	border: none;
	padding: 0;
	cursor: pointer;
	font: inherit;
	text-decoration: underline;
}

.readiness-badge {
	display: inline-flex;
	align-items: center;
	padding: 4px 10px;
	border-radius: 20px;
	font-size: 12px;
	font-weight: 600;
	background: var(--bg-surface);
	border: 1px solid var(--border-default);
	color: var(--text-muted);
	white-space: nowrap;
	transition:
		background var(--motion-fast),
		color var(--motion-fast),
		border-color var(--motion-fast);
}

.readiness-badge.ready {
	background: color-mix(in srgb, var(--green) 12%, transparent);
	border-color: color-mix(in srgb, var(--green) 30%, transparent);
	color: var(--green);
}

.ws-meta {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	font-size: 12.5px;
	color: var(--text-muted);
}

.meta-sep {
	color: var(--border-default);
}

/* ── Tab nav ── */
.tabs-nav {
	display: flex;
	gap: var(--sp-1);
	padding: 4px;
	background: var(--bg-surface);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-lg);
	width: fit-content;
}

.tab-btn {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 6px 14px;
	border: 1px solid transparent;
	border-radius: var(--radius-md);
	background: transparent;
	color: var(--text-muted);
	font: inherit;
	font-size: 13px;
	font-weight: 500;
	cursor: pointer;
	transition:
		background var(--motion-fast),
		color var(--motion-fast),
		border-color var(--motion-fast);
	white-space: nowrap;
}

.tab-btn:hover:not(.active) {
	background: var(--bg-surface-hover);
	color: var(--text-secondary);
}

.tab-btn.active {
	background: var(--bg-base);
	color: var(--text-primary);
	border-color: var(--border-default);
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.tab-badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 18px;
	height: 18px;
	padding: 0 5px;
	border-radius: 9px;
	background: var(--bg-surface-hover);
	color: var(--text-muted);
	font-size: 11px;
	font-weight: 600;
}

.tab-btn.active .tab-badge {
	background: var(--accent);
	color: var(--bg-base);
}

/* ── Tab content ── */
.tab-content {
	flex: 1;
}

/* ── Panel card ── */
.panel-card {
	background: var(--bg-surface);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-lg);
	overflow: hidden;
}

.panel-card-board {
	overflow: visible;
}

.panel-card-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: var(--sp-4);
	padding: var(--sp-5);
	border-bottom: 1px solid var(--border-subtle);
}

.panel-header-text {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.panel-heading {
	margin: 0;
	font-size: 16px;
	font-weight: 700;
	color: var(--text-primary);
	letter-spacing: -0.01em;
}

.panel-desc {
	margin: 0;
	font-size: 13px;
	color: var(--text-muted);
}

.panel-header-checks {
	display: flex;
	align-items: center;
	gap: var(--sp-3);
	flex-shrink: 0;
}

.field-check {
	display: flex;
	align-items: center;
	gap: 5px;
	font-size: 12px;
	font-weight: 500;
	color: var(--text-placeholder);
	transition: color var(--motion-fast);
}

.field-check.filled {
	color: var(--green);
}

.panel-card-body {
	padding: var(--sp-5);
	display: flex;
	flex-direction: column;
	gap: var(--sp-5);
}

.panel-card-body-board {
	padding: var(--sp-4) 0;
	gap: 0;
}

.task-progress-badge {
	padding: 4px 10px;
	border-radius: 20px;
	font-size: 12px;
	font-weight: 600;
	background: var(--bg-base);
	border: 1px solid var(--border-default);
	color: var(--text-muted);
	white-space: nowrap;
	flex-shrink: 0;
}

/* ── Form fields ── */
.form-field {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
}

.form-label {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.form-label-text {
	font-size: 11.5px;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--text-secondary);
}

.required-star {
	color: var(--red);
	margin-left: 2px;
}

.form-label-hint {
	font-size: 12.5px;
	color: var(--text-muted);
	font-weight: 400;
	letter-spacing: 0;
	text-transform: none;
}

.form-textarea {
	padding: 10px 12px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-md);
	background: var(--bg-base);
	color: var(--text-primary);
	font: inherit;
	font-size: 13.5px;
	line-height: 1.6;
	resize: vertical;
	outline: none;
	transition: border-color var(--motion-fast);
}

.form-textarea:focus {
	border-color: var(--accent);
}

.form-textarea::placeholder {
	color: var(--text-placeholder);
}

/* ── Item lists (key tasks / constraints) ── */
.items-list {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.item-row {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	padding: 6px 8px;
	border-radius: var(--radius-sm);
	transition: background var(--motion-fast);
}

.item-row:hover {
	background: var(--bg-base);
}

.item-bullet {
	font-size: 6px;
	color: var(--text-muted);
	flex-shrink: 0;
}

.item-text {
	flex: 1;
	font-size: 13.5px;
	color: var(--text-primary);
	min-width: 0;
}

.item-remove {
	display: grid;
	place-items: center;
	width: 22px;
	height: 22px;
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-placeholder);
	cursor: pointer;
	opacity: 0;
	flex-shrink: 0;
	transition:
		opacity var(--motion-fast),
		color var(--motion-fast);
}

.item-row:hover .item-remove {
	opacity: 1;
}

.item-remove:hover {
	color: var(--red);
}

.item-add {
	display: flex;
	gap: var(--sp-2);
}

.item-input {
	flex: 1;
	padding: 7px 10px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	color: var(--text-primary);
	font: inherit;
	font-size: 13px;
	outline: none;
	transition: border-color var(--motion-fast);
}

.item-input::placeholder {
	color: var(--text-placeholder);
}

.item-input:focus {
	border-color: var(--accent);
}

.item-add-btn {
	display: grid;
	place-items: center;
	width: 32px;
	height: 32px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	flex-shrink: 0;
	transition:
		background var(--motion-fast),
		color var(--motion-fast);
}

.item-add-btn:hover:not(:disabled) {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

.item-add-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

/* ── Tasks ── */
.task-add-row {
	display: flex;
	gap: var(--sp-2);
}

.task-input {
	flex: 1;
	padding: 8px 12px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-md);
	background: var(--bg-base);
	color: var(--text-primary);
	font: inherit;
	font-size: 13.5px;
	outline: none;
	transition: border-color var(--motion-fast);
}

.task-input::placeholder {
	color: var(--text-placeholder);
}

.task-input:focus {
	border-color: var(--accent);
}

.task-add-btn {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 0 14px;
	height: 38px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-md);
	background: transparent;
	color: var(--text-muted);
	font: inherit;
	font-size: 13px;
	cursor: pointer;
	white-space: nowrap;
	transition:
		background var(--motion-fast),
		color var(--motion-fast);
}

.task-add-btn:hover:not(:disabled) {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

.task-add-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.tasks-empty {
	padding: var(--sp-6);
	text-align: center;
	color: var(--text-muted);
	font-size: 13.5px;
}

.tasks-empty p {
	margin: 0;
}

.task-list {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.task-row {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	padding: 6px 4px;
	border-radius: var(--radius-sm);
	transition: background var(--motion-fast);
}

.task-row:hover {
	background: var(--bg-base);
}

.task-row input[type='checkbox'] {
	accent-color: var(--accent);
	cursor: pointer;
	flex-shrink: 0;
}

.task-title {
	flex: 1;
	font-size: 13.5px;
	color: var(--text-primary);
	cursor: pointer;
	min-width: 0;
}

.task-title.done {
	text-decoration: line-through;
	color: var(--text-muted);
}

.task-delete {
	display: grid;
	place-items: center;
	width: 22px;
	height: 22px;
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-placeholder);
	cursor: pointer;
	opacity: 0;
	flex-shrink: 0;
	transition:
		opacity var(--motion-fast),
		color var(--motion-fast);
}

.task-row:hover .task-delete {
	opacity: 1;
}

.task-delete:hover {
	color: var(--red);
}

.completed-section {
	margin-top: var(--sp-3);
}

.completed-summary {
	font-size: 12px;
	color: var(--text-muted);
	cursor: pointer;
	padding: var(--sp-1) 0;
	user-select: none;
}

.completed-list {
	margin-top: var(--sp-2);
}
</style>
