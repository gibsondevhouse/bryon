<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Plus, Trash2, Check, Archive, Folder } from '@lucide/svelte';
	import { fmtDate } from '$lib/utils';
	import type { Plan, PlanStatus, Project, Task } from '$lib/shared/types';
	import { session } from '$lib/features/streaming/session.svelte';

	let { data } = $props();

	let plan     = $state<Plan>(untrack(() => data.plan));
	let tasks    = $state<Task[]>(untrack(() => data.tasks));
	const projects = $derived(data.projects as Project[]);

	// ── Name editing ──────────────────────────────────────────────────────────
	let editingName = $state(false);
	let nameDraft   = $state(untrack(() => plan.name));
	let nameInput: HTMLInputElement | undefined = $state();

	function startRename(): void {
		nameDraft   = plan.name;
		editingName = true;
		setTimeout(() => { nameInput?.focus(); nameInput?.select(); }, 30);
	}

	async function commitRename(): Promise<void> {
		editingName = false;
		const next = nameDraft.trim();
		if (!next || next === plan.name) return;
		const res = await fetch(`/api/plans/${plan.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: next }),
		});
		if (res.ok) {
			const body = await res.json() as { plan: Plan };
			plan = body.plan;
			session.plans = session.plans.map((p) => (p.id === plan.id ? plan : p));
		}
	}

	// ── Meta editing ──────────────────────────────────────────────────────────
	let editingMeta   = $state(false);
	let summaryDraft  = $state(untrack(() => plan.summary ?? ''));
	let typeDraft     = $state(untrack(() => plan.planType ?? ''));
	let dateDraft     = $state(untrack(() => plan.startDate ?? ''));
	let projectDraft  = $state(untrack(() => plan.projectId ?? ''));

	const linkedProject = $derived(projects.find((p) => p.id === plan.projectId) ?? null);

	function openMeta(): void {
		summaryDraft = plan.summary ?? '';
		typeDraft    = plan.planType ?? '';
		dateDraft    = plan.startDate ?? '';
		projectDraft = plan.projectId ?? '';
		editingMeta  = true;
	}

	async function saveMeta(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		const res = await fetch(`/api/plans/${plan.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				summary:   summaryDraft.trim() || null,
				planType:  typeDraft.trim() || null,
				startDate: dateDraft || null,
				projectId: projectDraft || null,
			}),
		});
		if (res.ok) {
			const body = await res.json() as { plan: Plan };
			plan = body.plan;
		}
		editingMeta = false;
	}

	// ── Status cycling ────────────────────────────────────────────────────────
	const STATUS_ORDER: PlanStatus[] = ['ideation', 'definition', 'execution', 'maintenance', 'drafting', 'active'];
	const STATUS_LABELS: Record<PlanStatus, string> = {
		ideation: 'Ideation', definition: 'Definition',
		execution: 'Execution', maintenance: 'Maintenance',
		drafting: 'Drafting', active: 'Active',
	};

	async function cycleStatus(): Promise<void> {
		const next = STATUS_ORDER[(STATUS_ORDER.indexOf(plan.status) + 1) % STATUS_ORDER.length];
		const res = await fetch(`/api/plans/${plan.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: next }),
		});
		if (res.ok) {
			const body = await res.json() as { plan: Plan };
			plan = body.plan;
			session.plans = session.plans.map((p) => (p.id === plan.id ? plan : p));
		}
	}

	// ── Archive ───────────────────────────────────────────────────────────────
	async function archivePlan(): Promise<void> {
		const ok = confirm(`Archive "${plan.name}"? Its tasks will be preserved.`);
		if (!ok) return;
		const res = await fetch(`/api/plans/${plan.id}`, { method: 'DELETE' });
		if (res.ok) {
			session.plans = session.plans.filter((p) => p.id !== plan.id);
			goto('/planning');
		}
	}

	// ── Tasks ─────────────────────────────────────────────────────────────────
	let taskDraft   = $state('');
	let addingTask  = $state(false);
	let taskInput: HTMLInputElement | undefined = $state();

	const doneCount  = $derived(tasks.filter((t) => t.done).length);
	const totalCount = $derived(tasks.length);

	async function addTask(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		const body = taskDraft.trim();
		if (!body || addingTask) return;
		addingTask = true;
		try {
			const res = await fetch(`/api/plans/${plan.id}/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ body }),
			});
			if (res.ok) {
				const { task } = await res.json() as { task: Task };
				tasks = [...tasks, task];
				taskDraft = '';
				taskInput?.focus();
			}
		} finally {
			addingTask = false;
		}
	}

	async function toggleTask(task: Task): Promise<void> {
		// Optimistic
		tasks = tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t));
		const res = await fetch(`/api/plans/${plan.id}/tasks/${task.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ done: !task.done }),
		});
		if (res.ok) {
			const { task: updated } = await res.json() as { task: Task };
			tasks = tasks.map((t) => (t.id === task.id ? updated : t));
		} else {
			tasks = tasks.map((t) => (t.id === task.id ? task : t));
		}
	}

	async function deleteTask(task: Task): Promise<void> {
		tasks = tasks.filter((t) => t.id !== task.id);
		const res = await fetch(`/api/plans/${plan.id}/tasks/${task.id}`, { method: 'DELETE' });
		if (!res.ok && res.status !== 204) {
			tasks = [...tasks, task].sort((a, b) => a.createdAt - b.createdAt);
		}
	}

	function formatDate(s: string | null): string {
		if (!s) return '';
		const [y, m, d] = s.split('-').map(Number);
		return fmtDate(new Date(y, m - 1, d));
	}
</script>

<div class="shell">
	<!-- ── Header ─────────────────────────────────────────────────────────── -->
	<header class="page-header">
		<nav class="breadcrumb" aria-label="Breadcrumb">
			<a class="breadcrumb-link" href="/planning">
				<ArrowLeft size={13} />
				<span>Planning</span>
			</a>
			<span class="breadcrumb-sep" aria-hidden="true">/</span>
			{#if editingName}
				<input
					bind:this={nameInput}
					class="name-edit"
					type="text"
					bind:value={nameDraft}
					onblur={commitRename}
					onkeydown={(e) => {
						if (e.key === 'Enter') { e.preventDefault(); void commitRename(); }
						if (e.key === 'Escape') { editingName = false; }
					}}
					aria-label="Rename plan"
				/>
			{:else}
				<button class="plan-name-btn" type="button" onclick={startRename} title="Click to rename">
					{plan.name}
				</button>
			{/if}
		</nav>

		<div class="header-right">
			<button
				class="status-badge status-{plan.status}"
				type="button"
				onclick={cycleStatus}
				title="Click to advance status"
			>
				{STATUS_LABELS[plan.status]}
			</button>
			<button class="danger-btn" type="button" onclick={archivePlan}>
				<Archive size={13} />
				<span>Archive</span>
			</button>
		</div>
	</header>

	<!-- ── Meta ───────────────────────────────────────────────────────────── -->
	{#if editingMeta}
		<form class="meta-form" onsubmit={saveMeta}>
			<div class="meta-fields">
				<div class="meta-field">
					<label class="meta-label" for="plan-summary">Summary</label>
					<textarea
						id="plan-summary"
						class="meta-input meta-textarea"
						rows="3"
						placeholder="What is this plan trying to achieve?"
						bind:value={summaryDraft}
					></textarea>
				</div>
				<div class="meta-row-fields">
					<div class="meta-field">
						<label class="meta-label" for="plan-type">Type</label>
						<input
							id="plan-type"
							class="meta-input"
							type="text"
							placeholder="software, business…"
							bind:value={typeDraft}
						/>
					</div>
					<div class="meta-field">
						<label class="meta-label" for="plan-date">Start date</label>
						<input
							id="plan-date"
							class="meta-input meta-date"
							type="date"
							bind:value={dateDraft}
						/>
					</div>
				</div>
				<div class="meta-field">
					<label class="meta-label" for="plan-project">Linked project</label>
					<select id="plan-project" class="meta-input meta-select" bind:value={projectDraft}>
						<option value="">None</option>
						{#each projects as proj (proj.id)}
							<option value={proj.id}>{proj.name}</option>
						{/each}
					</select>
				</div>
			</div>
			<div class="meta-actions">
				<button type="button" class="btn-ghost" onclick={() => (editingMeta = false)}>Cancel</button>
				<button type="submit" class="btn-primary">Save</button>
			</div>
		</form>
	{:else}
		<div class="meta-display" role="button" tabindex="0" onclick={openMeta} onkeydown={(e) => e.key === 'Enter' && openMeta()}>
			{#if plan.summary}
				<p class="meta-summary">{plan.summary}</p>
			{/if}
			<div class="meta-chips">
				{#if plan.planType}
					<span class="meta-chip">{plan.planType}</span>
				{/if}
				{#if plan.startDate}
					<span class="meta-chip">{formatDate(plan.startDate)}</span>
				{/if}
				{#if linkedProject}
					<a class="meta-chip meta-project-link" href="/projects/{linkedProject.id}" onclick={(e) => e.stopPropagation()}>
						<Folder size={10} />
						{linkedProject.name}
					</a>
				{/if}
				{#if !plan.summary && !plan.planType && !plan.startDate && !linkedProject}
					<span class="meta-hint">Add summary, type, start date, or linked project…</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- ── Tasks ──────────────────────────────────────────────────────────── -->
	<section class="tasks-section">
		<div class="tasks-header">
			<h2 class="tasks-title">Tasks</h2>
			{#if totalCount > 0}
				<span class="tasks-progress">{doneCount}/{totalCount}</span>
			{/if}
		</div>

		{#if totalCount > 0}
			<div class="progress-track" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={totalCount}>
				<div class="progress-fill" style="width: {totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%"></div>
			</div>
		{/if}

		<ul class="task-list" role="list">
			{#each tasks as task (task.id)}
				<li class="task-row" class:is-done={task.done}>
					<button
						class="task-check"
						type="button"
						aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
						onclick={() => toggleTask(task)}
					>
						{#if task.done}
							<Check size={11} />
						{/if}
					</button>
					<span class="task-body">{task.body}</span>
					<button
						class="task-delete"
						type="button"
						aria-label="Delete task"
						onclick={() => deleteTask(task)}
					>
						<Trash2 size={12} />
					</button>
				</li>
			{/each}
		</ul>

		<form class="add-task-form" onsubmit={addTask}>
			<Plus size={13} class="add-icon" />
			<input
				bind:this={taskInput}
				class="add-input"
				type="text"
				placeholder="Add a task…"
				bind:value={taskDraft}
				autocomplete="off"
				disabled={addingTask}
			/>
		</form>
	</section>
</div>

<style>
.shell {
	display: flex;
	flex-direction: column;
	min-height: 100%;
	max-width: 720px;
	margin: 0 auto;
	width: 100%;
	gap: var(--sp-5);
}

/* ── Header ── */
.page-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-4);
	padding-bottom: var(--sp-4);
	border-bottom: 1px solid var(--border-subtle);
}

.breadcrumb {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	min-width: 0;
}

.breadcrumb-link {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	color: var(--text-muted);
	text-decoration: none;
	font-size: 13.5px;
	flex-shrink: 0;
	transition: color var(--motion-fast);
}

.breadcrumb-link:hover { color: var(--text-primary); }

.breadcrumb-sep {
	color: var(--text-placeholder);
	font-size: 13px;
}

.plan-name-btn {
	background: none;
	border: none;
	padding: 0;
	font-family: inherit;
	font-size: 18px;
	font-weight: 700;
	color: var(--text-primary);
	cursor: pointer;
	letter-spacing: -0.01em;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	transition: color var(--motion-fast);
}

.plan-name-btn:hover { color: var(--accent); }

.name-edit {
	flex: 1;
	border: 1px solid var(--accent);
	border-radius: var(--radius-sm);
	padding: 4px 10px;
	background: var(--bg-surface);
	color: var(--text-primary);
	font-size: 16px;
	font-weight: 700;
	font-family: inherit;
	outline: none;
	box-shadow: 0 0 0 3px rgba(77, 107, 254, 0.14);
}

.header-right {
	display: flex;
	align-items: center;
	gap: var(--sp-3);
	flex-shrink: 0;
}

.status-badge {
	font-size: 10px;
	font-weight: 600;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	padding: 3px 9px;
	border-radius: 99px;
	border: 1px solid var(--border-subtle);
	background: transparent;
	color: var(--text-placeholder);
	cursor: pointer;
	font-family: inherit;
	transition: border-color var(--motion-fast), color var(--motion-fast), background var(--motion-fast);
}

.status-badge:hover {
	border-color: var(--border-strong);
	color: var(--text-secondary);
}

.status-badge.status-execution {
	border-color: rgba(77, 107, 254, 0.35);
	color: var(--accent);
}

.status-badge.status-maintenance {
	border-color: rgba(52, 211, 153, 0.35);
	color: var(--green, #34d399);
}

.danger-btn {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 5px 10px;
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-muted);
	font-size: 12px;
	font-weight: 500;
	font-family: inherit;
	cursor: pointer;
	transition: background var(--motion-fast), color var(--motion-fast), border-color var(--motion-fast);
}

.danger-btn:hover {
	background: rgba(248, 113, 113, 0.08);
	border-color: rgba(248, 113, 113, 0.3);
	color: var(--red, #f87171);
}

/* ── Meta ── */
.meta-display {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
	padding: var(--sp-3) var(--sp-4);
	border: 1px solid var(--border-hair);
	border-radius: var(--radius-md);
	background: var(--bg-surface);
	cursor: pointer;
	transition: border-color var(--motion-fast);
}

.meta-display:hover {
	border-color: var(--border-default);
}

.meta-summary {
	font-size: 13.5px;
	color: var(--text-secondary);
	line-height: 1.55;
	margin: 0;
}

.meta-chips {
	display: flex;
	flex-wrap: wrap;
	gap: var(--sp-2);
}

.meta-chip {
	font-size: 11.5px;
	color: var(--text-muted);
	padding: 2px 8px;
	border: 1px solid var(--border-subtle);
	border-radius: 99px;
	background: var(--bg-base);
}

.meta-project-link {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	text-decoration: none;
	transition: border-color var(--motion-fast), color var(--motion-fast);
}

.meta-project-link:hover {
	border-color: var(--border-default);
	color: var(--text-primary);
}

.meta-select {
	appearance: none;
	cursor: pointer;
}

.meta-select option { background: var(--bg-base); }

.meta-hint {
	font-size: 12.5px;
	color: var(--text-placeholder);
	font-style: italic;
}

.meta-form {
	display: flex;
	flex-direction: column;
	gap: var(--sp-3);
	padding: var(--sp-4);
	border: 1px solid var(--border-default);
	border-radius: var(--radius-md);
	background: var(--bg-surface);
}

.meta-fields {
	display: flex;
	flex-direction: column;
	gap: var(--sp-3);
}

.meta-row-fields {
	display: flex;
	gap: var(--sp-3);
}

.meta-field {
	display: flex;
	flex-direction: column;
	gap: var(--sp-1);
	flex: 1;
}

.meta-label {
	font-size: 12px;
	font-weight: 600;
	color: var(--text-muted);
}

.meta-input {
	padding: 7px 10px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	color: var(--text-primary);
	font-size: 13px;
	font-family: inherit;
	outline: none;
	transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}

.meta-input::placeholder { color: var(--text-placeholder); }

.meta-input:focus {
	border-color: var(--accent);
	box-shadow: 0 0 0 3px rgba(77, 107, 254, 0.14);
}

.meta-textarea {
	resize: vertical;
	min-height: 72px;
	line-height: 1.55;
}

.meta-date { color-scheme: dark; }

.meta-actions {
	display: flex;
	justify-content: flex-end;
	gap: var(--sp-2);
}

/* ── Tasks section ── */
.tasks-section {
	display: flex;
	flex-direction: column;
	gap: var(--sp-3);
}

.tasks-header {
	display: flex;
	align-items: center;
	gap: var(--sp-3);
}

.tasks-title {
	font-size: 14px;
	font-weight: 700;
	color: var(--text-primary);
	letter-spacing: -0.01em;
	margin: 0;
}

.tasks-progress {
	font-size: 11.5px;
	font-weight: 600;
	color: var(--text-placeholder);
	font-variant-numeric: tabular-nums;
}

.progress-track {
	height: 3px;
	background: var(--border-subtle);
	border-radius: 2px;
	overflow: hidden;
}

.progress-fill {
	height: 100%;
	background: var(--accent);
	border-radius: 2px;
	transition: width 300ms ease;
}

/* ── Task list ── */
.task-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
}

.task-row {
	display: flex;
	align-items: center;
	gap: var(--sp-3);
	padding: 10px 4px;
	border-bottom: 1px solid var(--border-hair);
	transition: opacity var(--motion-fast);
}

.task-list :global(li:last-child .task-row) { border-bottom: none; }

.task-row.is-done .task-body {
	text-decoration: line-through;
	color: var(--text-placeholder);
}

.task-check {
	flex-shrink: 0;
	width: 18px;
	height: 18px;
	border: 1.5px solid var(--border-default);
	border-radius: 4px;
	background: transparent;
	cursor: pointer;
	display: grid;
	place-items: center;
	color: #fff;
	transition: background var(--motion-fast), border-color var(--motion-fast);
}

.task-row.is-done .task-check {
	background: var(--accent);
	border-color: var(--accent);
}

.task-check:hover:not(.task-row.is-done *) {
	border-color: var(--accent);
}

.task-body {
	flex: 1;
	font-size: 13.5px;
	color: var(--text-primary);
	line-height: 1.5;
}

.task-delete {
	flex-shrink: 0;
	display: grid;
	place-items: center;
	width: 26px;
	height: 26px;
	border: 1px solid transparent;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-placeholder);
	cursor: pointer;
	opacity: 0;
	transition: opacity var(--motion-fast), background var(--motion-fast), color var(--motion-fast);
}

.task-row:hover .task-delete { opacity: 1; }

.task-delete:hover {
	background: rgba(248, 113, 113, 0.1);
	color: var(--red, #f87171);
}

/* ── Add task form ── */
.add-task-form {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	padding: 8px 4px;
	border-top: 1px solid var(--border-hair);
}

.add-task-form :global(.add-icon) {
	flex-shrink: 0;
	color: var(--text-placeholder);
}

.add-input {
	flex: 1;
	border: none;
	background: transparent;
	color: var(--text-primary);
	font-size: 13.5px;
	font-family: inherit;
	outline: none;
}

.add-input::placeholder { color: var(--text-placeholder); }

.add-input:disabled { opacity: 0.5; }

/* ── Shared buttons ── */
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

.btn-ghost:hover {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

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

.btn-primary:hover {
	background: color-mix(in oklab, var(--accent) 85%, #fff);
}
</style>
