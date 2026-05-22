<script lang="ts">
import { untrack } from 'svelte';
import { goto } from '$app/navigation';
import { ListChecks } from '@lucide/svelte';
import { fmtDate } from '$lib/utils';
import DoctrineStatusBadge from '$lib/features/doctrine/DoctrineStatusBadge.svelte';
import type { Task, TaskStatus, Plan } from '$lib/shared/types';

let { data } = $props();

type ExecutionColumn = { id: TaskStatus; label: string };

const COLUMNS: ExecutionColumn[] = [
	{ id: 'planned',     label: 'Not Started' },
	{ id: 'in_progress', label: 'In Progress' },
	{ id: 'blocked',     label: 'Blocked' },
	{ id: 'completed',   label: 'Done' },
];

let tasks = $state<Task[]>(untrack(() => data.tasks));
let plans = $state<Plan[]>(untrack(() => data.plans));

const planMap = $derived(new Map(plans.map((p) => [p.id, p])));

let draggingId = $state<string | null>(null);
let dragOverColumn = $state<string | null>(null);

function columnTasks(col: ExecutionColumn): Task[] {
	return tasks.filter((t) => t.status === col.id);
}

function planNameFor(task: Task): string {
	return planMap.get(task.planId)?.name ?? 'Unknown Plan';
}

function onDragStart(e: DragEvent, task: Task): void {
	draggingId = task.id;
	e.dataTransfer?.setData('text/plain', task.id);
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

async function onColumnDrop(e: DragEvent, colId: TaskStatus): Promise<void> {
	e.preventDefault();
	const id = e.dataTransfer?.getData('text/plain');
	if (!id) return;
	const task = tasks.find((t) => t.id === id);
	if (!task || task.status === colId) {
		draggingId = null;
		dragOverColumn = null;
		return;
	}

	const prevStatus = task.status;
	tasks = tasks.map((t) => (t.id === id ? { ...t, status: colId } : t));
	draggingId = null;
	dragOverColumn = null;

	try {
		const res = await fetch(`/api/plans/${task.planId}/tasks/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: colId }),
		});
		if (!res.ok) {
			tasks = tasks.map((t) => (t.id === id ? { ...t, status: prevStatus } : t));
		}
	} catch {
		tasks = tasks.map((t) => (t.id === id ? { ...t, status: prevStatus } : t));
	}
}

let justDragged = $state(false);

function onDragStartWrapped(e: DragEvent, task: Task): void {
	justDragged = false;
	onDragStart(e, task);
}

function onDragEndWrapped(): void {
	justDragged = true;
	onDragEnd();
	setTimeout(() => { justDragged = false; }, 150);
}

function onCardClick(task: Task): void {
	if (justDragged) return;
	goto(`/plans/${task.planId}`);
}

const totalTasks   = $derived(tasks.length);
const doneTasks    = $derived(tasks.filter((t) => t.status === 'completed').length);
const blockedTasks = $derived(tasks.filter((t) => t.status === 'blocked').length);
</script>

<svelte:head>
	<title>Execution — Bryon</title>
</svelte:head>

<div class="shell">
	<header class="board-header">
		<div class="header-left">
			<ListChecks size={18} strokeWidth={2} class="header-icon" />
			<h1 class="board-title">Execution</h1>
		</div>
		<div class="header-stats">
			{#if totalTasks > 0}
				<span class="stat">{doneTasks}/{totalTasks} done</span>
				{#if blockedTasks > 0}
					<span class="stat stat-blocked">{blockedTasks} blocked</span>
				{/if}
			{:else}
				<span class="stat">No tasks</span>
			{/if}
		</div>
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
					<span class="col-count">{columnTasks(col).length}</span>
				</div>

				<div class="col-body">
					{#each columnTasks(col) as task (task.id)}
						<div
							class="task-card"
							class:is-dragging={draggingId === task.id}
							draggable="true"
							role="button"
							tabindex="0"
							ondragstart={(e) => onDragStartWrapped(e, task)}
							ondragend={onDragEndWrapped}
							onclick={() => onCardClick(task)}
							onkeydown={(e) => e.key === 'Enter' && onCardClick(task)}
						>
							<span class="task-title">{task.title || task.body || 'Untitled task'}</span>
							<div class="card-meta">
								<span class="task-plan">{planNameFor(task)}</span>
								<DoctrineStatusBadge kind="task" status={task.status} />
							</div>
							{#if task.dueDate}
								<span class="task-due">Due {task.dueDate}</span>
							{/if}
						</div>
					{:else}
						<div class="col-empty">No tasks</div>
					{/each}
				</div>
			</div>
		{/each}
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

.board-header {
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

.board-title {
	font-size: var(--font-size-heading);
	font-weight: 700;
	color: var(--text-primary);
	letter-spacing: -0.01em;
}

.header-stats {
	display: flex;
	align-items: center;
	gap: var(--sp-3);
}

.stat {
	font-size: 12px;
	font-weight: 500;
	color: var(--text-muted);
}

.stat-blocked {
	color: #fca5a5;
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

.task-card {
	display: flex;
	flex-direction: column;
	gap: 6px;
	padding: 12px 14px;
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
	background: var(--bg-surface);
	cursor: grab;
	user-select: none;
	transition: transform 230ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 230ms cubic-bezier(0.215, 0.61, 0.355, 1), border-color var(--motion-fast), opacity var(--motion-fast);
}

.task-card:hover {
	transform: translateY(-2px);
	border-color: var(--border-default);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.32), 0 1px 3px rgba(0, 0, 0, 0.18);
}

.task-card:active { cursor: grabbing; }
.task-card.is-dragging { opacity: 0.4; transform: scale(0.98); box-shadow: none; }

.task-title {
	font-size: 13px;
	font-weight: 500;
	color: var(--text-primary);
	line-height: 1.45;
}

.card-meta {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	flex-wrap: wrap;
}

.task-plan {
	font-size: 11px;
	color: var(--text-placeholder);
	max-width: 140px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.task-due {
	font-size: 10.5px;
	color: var(--text-placeholder);
}

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
</style>
