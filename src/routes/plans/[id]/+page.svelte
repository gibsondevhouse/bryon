<script lang="ts">
import { ArrowLeft, AlertTriangle, Plus, Trash2 } from '@lucide/svelte';
import { session } from '$lib/features/streaming/session.svelte';
import { fmtDate } from '$lib/utils';
import DoctrineStatusBadge from '$lib/features/doctrine/DoctrineStatusBadge.svelte';
import ReadinessChecklist from '$lib/features/doctrine/ReadinessChecklist.svelte';
import { evaluatePlanReadiness } from '$lib/features/doctrine/readiness';
import { planLifecycleLabel } from '$lib/features/doctrine/labels';
import type { Plan, Task } from '$lib/shared/types';

let { data } = $props();

let plan = $state<Plan>(data.plan);
let tasks = $state<Task[]>(data.tasks);

let editingName = $state(false);
let nameValue = $state(plan.name);
let nameInput: HTMLInputElement | undefined = $state();

let missionGap = $state('');
let missionContext = $state('');
let intentPurpose = $state('');
let intentEndState = $state('');
let intentKeyTasks = $state<string[]>([]);
let intentConstraints = $state<string[]>([]);

const readiness = $derived(evaluatePlanReadiness(
	{
		lifecycle: null,
		missionNeed: { gap: missionGap || null, context: missionContext || null, priority: null, source: null },
		commandersIntent: { purpose: intentPurpose || null, keyTasks: intentKeyTasks.filter(Boolean), endState: intentEndState || null, constraints: intentConstraints.filter(Boolean) },
		lineOfEffort: [],
		oplan: { missionStatement: null, executionTimeline: [], taskOrganization: [], sustainment: [], annexes: [], references: [] },
	},
	[],
));

function doctrineLifecycle(status: string): string {
	const map: Record<string, string> = {
		ideation: 'proposed',
		definition: 'drafting',
		execution: 'active',
		maintenance: 'archived',
		drafting: 'drafting',
		active: 'active',
	};
	return map[status] ?? 'proposed';
}

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
		// silent
	}
}

function onNameKey(e: KeyboardEvent): void {
	if (e.key === 'Enter') { e.preventDefault(); void commitName(); }
	else if (e.key === 'Escape') { editingName = false; }
}

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
		<a class="back-link" href="/plans"><ArrowLeft size={16} /> Plans</a>
		<div class="ws-header-main">
			<div class="ws-title-row">
				{#if editingName}
					<input
						bind:this={nameInput}
						class="name-input"
						bind:value={nameValue}
						onkeydown={onNameKey}
						onblur={() => void commitName()}
					/>
				{:else}
					<h1 class="ws-title" ondblclick={startNameEdit}>{plan.name}</h1>
				{/if}
				<DoctrineStatusBadge kind="plan" status={doctrineLifecycle(plan.status)} />
			</div>
			<div class="ws-meta">
				<span>Created {fmtDate(plan.createdAt)}</span>
				{#if plan.summary}
					<span class="meta-sep">|</span>
					<span>{plan.summary}</span>
				{/if}
			</div>
		</div>
	</header>

	<div class="ws-body">
		<!-- Left: Doctrine panels -->
		<div class="ws-main">
			<!-- Strategic Anchor / Mission Need -->
			<section class="panel">
				<h2 class="panel-title">Mission Need</h2>
				<div class="panel-fields">
					<label class="panel-field">
						<span class="field-label">Capability Gap</span>
						<textarea class="field-input" placeholder="What capability gap does this plan address?" bind:value={missionGap} rows="2"></textarea>
					</label>
					<label class="panel-field">
						<span class="field-label">Operational Context</span>
						<textarea class="field-input" placeholder="What is the operational context?" bind:value={missionContext} rows="2"></textarea>
					</label>
				</div>
			</section>

			<!-- Commander's Intent -->
			<section class="panel">
				<h2 class="panel-title">Commander's Intent</h2>
				<div class="panel-fields">
					<label class="panel-field">
						<span class="field-label">Purpose</span>
						<textarea class="field-input" placeholder="What is the purpose of this plan?" bind:value={intentPurpose} rows="2"></textarea>
					</label>
					<label class="panel-field">
						<span class="field-label">End State</span>
						<textarea class="field-input" placeholder="What does success look like?" bind:value={intentEndState} rows="2"></textarea>
					</label>
				</div>
			</section>

			<!-- CONOPS placeholder -->
			<section class="panel">
				<h2 class="panel-title">CONOPS</h2>
				<div class="panel-empty">
					<AlertTriangle size={14} />
					<span>No phases defined. Add CONOPS phases to structure the execution timeline.</span>
				</div>
			</section>

			<!-- OPLAN placeholder -->
			<section class="panel">
				<h2 class="panel-title">OPLAN</h2>
				<div class="panel-empty">
					<AlertTriangle size={14} />
					<span>Define Mission Need and Commander's Intent first, then build the OPLAN.</span>
				</div>
			</section>

			<!-- Tasks (demoted, secondary) -->
			<section class="panel">
				<h2 class="panel-title">Tasks <span class="task-count">{tasks.length}</span></h2>
				<div class="task-add">
					<input
						class="task-input"
						placeholder="Add a task..."
						bind:value={newTaskTitle}
						onkeydown={(e) => e.key === 'Enter' && void addTask()}
					/>
					<button class="task-add-btn" onclick={() => void addTask()} disabled={!newTaskTitle.trim() || addingTask}>
						<Plus size={14} />
					</button>
				</div>
				{#if activeTasks.length > 0}
					<div class="task-list">
						{#each activeTasks as task (task.id)}
							<div class="task-row">
								<input type="checkbox" checked={task.done} onchange={() => void toggleTask(task)} />
								<span class="task-title">{task.title || task.body}</span>
								<button class="task-delete" onclick={() => void deleteTask(task)} aria-label="Delete task">
									<Trash2 size={12} />
								</button>
							</div>
						{/each}
					</div>
				{/if}
				{#if completedTasks.length > 0}
					<details class="completed-section">
						<summary class="completed-summary">{completedTasks.length} completed</summary>
						<div class="task-list">
							{#each completedTasks as task (task.id)}
								<div class="task-row completed">
									<input type="checkbox" checked={task.done} onchange={() => void toggleTask(task)} />
									<span class="task-title">{task.title || task.body}</span>
								</div>
							{/each}
						</div>
					</details>
				{/if}
			</section>
		</div>

		<!-- Right: Readiness sidebar -->
		<aside class="ws-aside">
			<ReadinessChecklist {readiness} />

			<div class="aside-section">
				<h3 class="aside-title">OPORD</h3>
				<p class="aside-empty">No OPORD issued</p>
			</div>

			<div class="aside-section">
				<h3 class="aside-title">FRAGOs</h3>
				<p class="aside-empty">No active FRAGOs</p>
			</div>

			<div class="aside-section">
				<h3 class="aside-title">AAR</h3>
				<p class="aside-empty">No reviews</p>
			</div>
		</aside>
	</div>
</div>

<style>
.workspace {
	max-width: 1200px;
	width: 100%;
	margin: 0 auto;
}

.ws-header {
	display: flex;
	flex-direction: column;
	gap: var(--sp-3);
	margin-bottom: var(--sp-5);
}

.back-link {
	display: inline-flex;
	align-items: center;
	gap: var(--sp-2);
	color: var(--text-muted);
	font-size: 13px;
	text-decoration: none;
	transition: color var(--motion-fast);
}

.back-link:hover { color: var(--text-primary); }

.ws-header-main {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
}

.ws-title-row {
	display: flex;
	align-items: center;
	gap: var(--sp-3);
}

.ws-title {
	margin: 0;
	font-size: 26px;
	font-weight: 700;
	letter-spacing: -0.02em;
	color: var(--text-primary);
	cursor: text;
}

.name-input {
	font-size: 26px;
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
}

.ws-meta {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	font-size: 12.5px;
	color: var(--text-muted);
}

.meta-sep { color: var(--border-default); }

.ws-body {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 280px;
	gap: var(--sp-5);
}

@media (max-width: 900px) {
	.ws-body { grid-template-columns: 1fr; }
}

.ws-main {
	display: flex;
	flex-direction: column;
	gap: var(--sp-4);
}

/* ── Panels ── */
.panel {
	padding: var(--sp-4);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-lg);
	background: var(--bg-surface);
}

.panel-title {
	font-size: 13px;
	font-weight: 700;
	letter-spacing: 0.04em;
	text-transform: uppercase;
	color: var(--text-muted);
	margin: 0 0 var(--sp-3);
}

.panel-fields {
	display: flex;
	flex-direction: column;
	gap: var(--sp-3);
}

.panel-field {
	display: flex;
	flex-direction: column;
	gap: var(--sp-1);
}

.field-label {
	font-size: 12px;
	font-weight: 600;
	color: var(--text-secondary);
}

.field-input {
	padding: 8px 10px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	color: var(--text-primary);
	font: inherit;
	font-size: 13px;
	line-height: 1.5;
	resize: vertical;
	outline: none;
	transition: border-color var(--motion-fast);
}

.field-input:focus { border-color: var(--accent); }
.field-input::placeholder { color: var(--text-placeholder); }

.panel-empty {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	padding: var(--sp-4);
	border: 1px dashed var(--border-hair);
	border-radius: var(--radius-sm);
	color: var(--text-muted);
	font-size: 12.5px;
}

/* ── Tasks ── */
.task-count {
	font-weight: 400;
	color: var(--text-placeholder);
	margin-left: var(--sp-1);
}

.task-add {
	display: flex;
	gap: var(--sp-2);
	margin-bottom: var(--sp-3);
}

.task-input {
	flex: 1;
	padding: 7px 10px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	color: var(--text-primary);
	font: inherit;
	font-size: 13px;
	outline: none;
}

.task-input::placeholder { color: var(--text-placeholder); }
.task-input:focus { border-color: var(--accent); }

.task-add-btn {
	display: grid;
	place-items: center;
	width: 32px;
	height: 32px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	transition: background var(--motion-fast), color var(--motion-fast);
}

.task-add-btn:hover:not(:disabled) { background: var(--bg-surface-hover); color: var(--text-primary); }
.task-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.task-list {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.task-row {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	padding: 5px 4px;
	border-radius: var(--radius-sm);
}

.task-row:hover { background: var(--bg-surface-hover); }

.task-row input[type="checkbox"] {
	accent-color: var(--accent);
	cursor: pointer;
}

.task-title {
	flex: 1;
	font-size: 13px;
	color: var(--text-primary);
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.task-row.completed .task-title {
	text-decoration: line-through;
	color: var(--text-muted);
}

.task-delete {
	display: grid;
	place-items: center;
	width: 20px;
	height: 20px;
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-placeholder);
	cursor: pointer;
	opacity: 0;
	transition: opacity var(--motion-fast), color var(--motion-fast);
}

.task-row:hover .task-delete { opacity: 1; }
.task-delete:hover { color: var(--red, #f87171); }

.completed-section { margin-top: var(--sp-2); }
.completed-summary {
	font-size: 12px;
	color: var(--text-muted);
	cursor: pointer;
	padding: var(--sp-1) 0;
}

/* ── Aside ── */
.ws-aside {
	display: flex;
	flex-direction: column;
	gap: var(--sp-4);
}

.aside-section {
	padding: var(--sp-3);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
	background: var(--bg-surface);
}

.aside-title {
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: var(--text-muted);
	margin: 0 0 var(--sp-2);
}

.aside-empty {
	font-size: 12px;
	color: var(--text-placeholder);
	margin: 0;
}
</style>
