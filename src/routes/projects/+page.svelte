<script lang="ts">
	import { goto } from '$app/navigation';
	import { Plus, Folder, Archive, MessageSquare } from '@lucide/svelte';
	import { session } from '$lib/features/streaming/session.svelte';
	import type { Project } from '$lib/shared/types';

	let { data } = $props();

	let projects = $state<Project[]>(data.projects);
	let chatCounts = $state<Record<string, number>>(data.chatCounts);

	// ── Create ────────────────────────────────────────────────────────────────
	let creating = $state(false);
	let showCreateForm = $state(false);
	let newName = $state('');
	let newDesc = $state('');
	let nameInput: HTMLInputElement | undefined = $state();

	function openCreate(): void {
		newName = '';
		newDesc = '';
		showCreateForm = true;
		setTimeout(() => nameInput?.focus(), 40);
	}

	function cancelCreate(): void {
		showCreateForm = false;
	}

	async function submitCreate(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		const name = newName.trim();
		if (!name || creating) return;
		creating = true;
		try {
			const res = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, description: newDesc.trim() || null }),
			});
			if (!res.ok) return;
			const { project } = await res.json() as { project: Project };
			projects = [project, ...projects];
			session.projects = [project, ...session.projects];
			showCreateForm = false;
			goto(`/projects/${project.id}`);
		} finally {
			creating = false;
		}
	}

	// ── Archive ───────────────────────────────────────────────────────────────
	async function archiveProject(project: Project): Promise<void> {
		const ok = confirm(`Archive "${project.name}"? Its chats stay intact.`);
		if (!ok) return;
		const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
		if (res.ok) {
			projects = projects.filter((p) => p.id !== project.id);
			await session.archiveProject(project.id);
		}
	}

	// ── Helpers ───────────────────────────────────────────────────────────────
	const STATUS_LABELS: Record<Project['status'], string> = {
		ideation:    'Ideation',
		definition:  'Definition',
		execution:   'Execution',
		maintenance: 'Maintenance',
	};

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<div class="shell">
	<header class="page-header">
		<h1 class="page-title">Projects</h1>
		<button class="new-btn" type="button" onclick={openCreate}>
			<Plus size={13} strokeWidth={2.5} />
			<span>New Project</span>
		</button>
	</header>

	<!-- ── Create form ──────────────────────────────────────────────────────── -->
	{#if showCreateForm}
		<form class="create-form" onsubmit={submitCreate}>
			<div class="create-fields">
				<input
					bind:this={nameInput}
					class="create-input"
					type="text"
					placeholder="Project name"
					bind:value={newName}
					required
					autocomplete="off"
				/>
				<input
					class="create-input"
					type="text"
					placeholder="Description (optional)"
					bind:value={newDesc}
					autocomplete="off"
				/>
			</div>
			<div class="create-actions">
				<button type="button" class="btn-ghost" onclick={cancelCreate}>Cancel</button>
				<button type="submit" class="btn-primary" disabled={!newName.trim() || creating}>
					{creating ? 'Creating…' : 'Create'}
				</button>
			</div>
		</form>
	{/if}

	<!-- ── Project grid ──────────────────────────────────────────────────────── -->
	{#if projects.length === 0 && !showCreateForm}
		<div class="empty-state">
			<Folder size={36} class="empty-icon" />
			<p class="empty-title">No projects yet</p>
			<p class="empty-sub">Projects keep chats, files, and memory together in one place.</p>
			<button class="btn-primary" type="button" onclick={openCreate}>
				<Plus size={13} />
				<span>New Project</span>
			</button>
		</div>
	{:else}
		<ul class="grid" role="list">
			{#each projects as project (project.id)}
				<li class="card">
					<a class="card-link" href="/projects/{project.id}" aria-label={project.name}>
						<div class="card-top">
							<Folder size={16} class="card-icon" />
							<span class="status-badge status-{project.status}">
								{STATUS_LABELS[project.status]}
							</span>
						</div>
						<h2 class="card-name">{project.name}</h2>
						{#if project.description}
							<p class="card-desc">{project.description}</p>
						{/if}
						<div class="card-meta">
							<span class="meta-item">
								<MessageSquare size={11} />
								{chatCounts[project.id] ?? 0} chat{(chatCounts[project.id] ?? 0) === 1 ? '' : 's'}
							</span>
							<span class="meta-sep">·</span>
							<span class="meta-item">{formatDate(project.updatedAt)}</span>
						</div>
					</a>
					<button
						class="archive-btn"
						type="button"
						title="Archive project"
						aria-label="Archive {project.name}"
						onclick={(e) => { e.preventDefault(); void archiveProject(project); }}
					>
						<Archive size={13} />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
.shell {
	display: flex;
	flex-direction: column;
	min-height: 100%;
	max-width: 900px;
	margin: 0 auto;
	width: 100%;
	gap: var(--sp-6);
}

/* ── Header ── */
.page-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-bottom: var(--sp-5);
	border-bottom: 1px solid var(--border-subtle);
}

.page-title {
	font-size: 22px;
	font-weight: 700;
	color: var(--text-primary);
	letter-spacing: -0.01em;
}

.new-btn {
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
	transition: background var(--motion-fast), border-color var(--motion-fast), color var(--motion-fast);
}

.new-btn:hover {
	background: var(--bg-surface);
	border-color: var(--border-strong);
	color: var(--text-primary);
}

/* ── Create form ── */
.create-form {
	display: flex;
	flex-direction: column;
	gap: var(--sp-3);
	padding: var(--sp-4) var(--sp-5);
	background: var(--bg-surface);
	border: 1px solid var(--border-default);
	border-radius: var(--radius-md);
}

.create-fields {
	display: flex;
	gap: var(--sp-3);
}

.create-input {
	flex: 1;
	padding: 8px 12px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	color: var(--text-primary);
	font-size: 13.5px;
	font-family: inherit;
	outline: none;
	transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}

.create-input::placeholder {
	color: var(--text-placeholder);
}

.create-input:focus {
	border-color: var(--accent);
	box-shadow: 0 0 0 3px rgba(77, 107, 254, 0.14);
}

.create-actions {
	display: flex;
	justify-content: flex-end;
	gap: var(--sp-2);
}

/* ── Empty state ── */
.empty-state {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: var(--sp-3);
	padding: var(--sp-8) var(--sp-6);
	text-align: center;
}

.empty-state :global(.empty-icon) {
	color: var(--text-placeholder);
	opacity: 0.5;
}

.empty-title {
	font-size: 16px;
	font-weight: 600;
	color: var(--text-muted);
}

.empty-sub {
	font-size: 13.5px;
	color: var(--text-placeholder);
	max-width: 320px;
	line-height: 1.55;
}

/* ── Grid ── */
.grid {
	list-style: none;
	margin: 0;
	padding: 0;
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
	gap: var(--sp-4);
}

/* ── Card ── */
.card {
	position: relative;
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
	background: var(--bg-surface);
	transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}

.card:hover {
	border-color: var(--border-default);
	box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
}

.card-link {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
	padding: var(--sp-4) var(--sp-5);
	text-decoration: none;
	color: inherit;
}

.card-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: var(--sp-1);
}

.card-top :global(.card-icon) {
	color: var(--text-muted);
}

.status-badge {
	font-size: 10px;
	font-weight: 600;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	padding: 2px 7px;
	border-radius: 99px;
	border: 1px solid var(--border-subtle);
	color: var(--text-placeholder);
}

.status-badge.status-execution {
	border-color: rgba(77, 107, 254, 0.35);
	color: var(--accent);
}

.status-badge.status-maintenance {
	border-color: rgba(52, 211, 153, 0.35);
	color: var(--green, #34d399);
}

.card-name {
	font-size: 15px;
	font-weight: 600;
	color: var(--text-primary);
	line-height: 1.3;
	margin: 0;
}

.card-desc {
	font-size: 12.5px;
	color: var(--text-muted);
	line-height: 1.5;
	margin: 0;
	overflow: hidden;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

.card-meta {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	margin-top: var(--sp-2);
	padding-top: var(--sp-2);
	border-top: 1px solid var(--border-hair);
}

.meta-item {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 11.5px;
	color: var(--text-placeholder);
}

.meta-sep {
	color: var(--border-default);
	font-size: 11px;
}

/* ── Archive button ── */
.archive-btn {
	position: absolute;
	top: var(--sp-3);
	right: var(--sp-3);
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
	transition: opacity var(--motion-fast), background var(--motion-fast), color var(--motion-fast), border-color var(--motion-fast);
}

.card:hover .archive-btn {
	opacity: 1;
}

.archive-btn:hover {
	background: var(--bg-surface-hover);
	border-color: var(--border-default);
	color: var(--text-muted);
}

/* ── Buttons ── */
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
	display: inline-flex;
	align-items: center;
	gap: 6px;
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

.btn-primary:hover:not(:disabled) {
	background: color-mix(in oklab, var(--accent) 85%, #fff);
}

.btn-primary:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}
</style>
