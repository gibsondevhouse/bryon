<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		ArrowLeft, Plus, Upload, Trash2, Brain, MessageSquare,
		FileText, File, Image, ToggleLeft, ToggleRight, Loader, MapIcon,
	} from '@lucide/svelte';
	import type { Chat, MemoryEntry, Plan, Project, ProjectFile } from '$lib/shared/types';

	let { data } = $props();

	let project  = $state<Project>(data.project);
	let chats    = $state<Chat[]>(data.chats);
	let files    = $state<ProjectFile[]>(data.files);
	let memory   = $state<MemoryEntry[]>(data.memory);
	const plans  = data.plans as Plan[];

	// ── Tabs ──────────────────────────────────────────────────────────────────
	type Tab = 'chats' | 'files' | 'memory';
	let activeTab = $state<Tab>('chats');

	// ── Project rename ────────────────────────────────────────────────────────
	let editingName = $state(false);
	let nameDraft   = $state(project.name);
	let nameInput: HTMLInputElement | undefined = $state();

	function startRename(): void {
		nameDraft   = project.name;
		editingName = true;
		setTimeout(() => { nameInput?.focus(); nameInput?.select(); }, 30);
	}

	async function commitRename(): Promise<void> {
		editingName = false;
		const next = nameDraft.trim();
		if (!next || next === project.name) return;
		const res = await fetch(`/api/projects/${project.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: next }),
		});
		if (res.ok) {
			const body = await res.json() as { project: Project };
			project = body.project;
		}
	}

	// ── Status cycling ────────────────────────────────────────────────────────
	const STATUS_ORDER: Project['status'][] = ['ideation', 'definition', 'execution', 'maintenance'];

	async function cycleStatus(): Promise<void> {
		const next = STATUS_ORDER[(STATUS_ORDER.indexOf(project.status) + 1) % STATUS_ORDER.length];
		const res = await fetch(`/api/projects/${project.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: next }),
		});
		if (res.ok) {
			const body = await res.json() as { project: Project };
			project = body.project;
		}
	}

	// ── Archive project ───────────────────────────────────────────────────────
	async function archiveProject(): Promise<void> {
		const ok = confirm(`Archive "${project.name}"? Its chats stay intact.`);
		if (!ok) return;
		const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
		if (res.ok) goto('/projects');
	}

	// ── Chats tab ─────────────────────────────────────────────────────────────
	async function newChat(): Promise<void> {
		const res = await fetch('/api/chats', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'New chat', projectId: project.id }),
		});
		if (res.ok) {
			const body = await res.json() as { chat: Chat };
			goto(`/chats/${body.chat.id}`);
		}
	}

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	// ── Files tab ─────────────────────────────────────────────────────────────
	let uploading   = $state(false);
	let uploadError = $state<string | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();

	async function uploadFiles(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const selected = input.files;
		if (!selected || selected.length === 0) return;

		uploading   = true;
		uploadError = null;

		const form = new FormData();
		for (const file of selected) form.append('files', file);

		try {
			const res = await fetch(`/api/projects/${project.id}/files`, {
				method: 'POST',
				body: form,
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
				uploadError = body.error?.message ?? `Upload failed (${res.status})`;
				return;
			}
			const body = await res.json() as { files: ProjectFile[] };
			files = [...body.files, ...files];
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Network error';
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	async function archiveFile(file: ProjectFile): Promise<void> {
		const res = await fetch(`/api/projects/${project.id}/files/${file.id}`, { method: 'DELETE' });
		if (res.ok) files = files.filter((f) => f.id !== file.id);
	}

	function fileIcon(file: ProjectFile) {
		if (file.kind === 'image') return Image;
		if (file.mime.includes('text') || file.name.endsWith('.md')) return FileText;
		return File;
	}

	function formatBytes(n: number): string {
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / 1024 / 1024).toFixed(1)} MB`;
	}

	// ── Memory tab ────────────────────────────────────────────────────────────
	let memoryDraft = $state('');
	let memoryKind  = $state<'remember' | 'never_suggest'>('remember');
	let addingMemory = $state(false);

	async function addMemory(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		const body = memoryDraft.trim();
		if (!body || addingMemory) return;
		addingMemory = true;
		try {
			const res = await fetch('/api/memory', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					scope: 'project',
					projectId: project.id,
					kind: memoryKind,
					body,
				}),
			});
			if (res.ok) {
				const { entry } = await res.json() as { entry: MemoryEntry };
				memory = [entry, ...memory];
				memoryDraft = '';
			}
		} finally {
			addingMemory = false;
		}
	}

	async function toggleMemory(entry: MemoryEntry): Promise<void> {
		const res = await fetch(`/api/memory/${entry.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ enabled: !entry.enabled }),
		});
		if (res.ok) {
			const { entry: updated } = await res.json() as { entry: MemoryEntry };
			memory = memory.map((m) => (m.id === entry.id ? updated : m));
		}
	}

	async function deleteMemory(entry: MemoryEntry): Promise<void> {
		const res = await fetch(`/api/memory/${entry.id}`, { method: 'DELETE' });
		if (res.ok) memory = memory.filter((m) => m.id !== entry.id);
	}

	const STATUS_LABELS: Record<Project['status'], string> = {
		ideation:    'Ideation',
		definition:  'Definition',
		execution:   'Execution',
		maintenance: 'Maintenance',
	};
</script>

<div class="shell">
	<!-- ── Breadcrumb + header ────────────────────────────────────────────── -->
	<header class="page-header">
		<nav class="breadcrumb" aria-label="Breadcrumb">
			<a class="breadcrumb-link" href="/projects">
				<ArrowLeft size={13} />
				<span>Projects</span>
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
					aria-label="Rename project"
				/>
			{:else}
				<button class="project-name-btn" type="button" onclick={startRename} title="Click to rename">
					{project.name}
				</button>
			{/if}
		</nav>

		<div class="header-right">
			<button
				class="status-badge status-{project.status}"
				type="button"
				onclick={cycleStatus}
				title="Click to advance status"
			>
				{STATUS_LABELS[project.status]}
			</button>
			<button class="danger-btn" type="button" onclick={archiveProject} title="Archive project">
				<Trash2 size={13} />
				<span>Archive</span>
			</button>
		</div>
	</header>

	{#if project.description}
		<p class="project-desc">{project.description}</p>
	{/if}

	{#if plans.length > 0}
		<div class="linked-plans">
			<MapIcon size={12} class="linked-plans-icon" />
			<span class="linked-plans-label">Plans</span>
			{#each plans as plan (plan.id)}
				<a class="plan-chip plan-chip-{plan.status}" href="/planning/{plan.id}">
					{plan.name}
				</a>
			{/each}
		</div>
	{/if}

	<!-- ── Tab bar ───────────────────────────────────────────────────────── -->
	<div class="tabs" role="tablist" aria-label="Project sections">
		<button
			class="tab"
			class:active={activeTab === 'chats'}
			role="tab"
			aria-selected={activeTab === 'chats'}
			type="button"
			onclick={() => (activeTab = 'chats')}
		>
			<MessageSquare size={13} />
			Chats
			<span class="tab-count">{chats.length}</span>
		</button>
		<button
			class="tab"
			class:active={activeTab === 'files'}
			role="tab"
			aria-selected={activeTab === 'files'}
			type="button"
			onclick={() => (activeTab = 'files')}
		>
			<FileText size={13} />
			Files
			<span class="tab-count">{files.length}</span>
		</button>
		<button
			class="tab"
			class:active={activeTab === 'memory'}
			role="tab"
			aria-selected={activeTab === 'memory'}
			type="button"
			onclick={() => (activeTab = 'memory')}
		>
			<Brain size={13} />
			Memory
			<span class="tab-count">{memory.length}</span>
		</button>
	</div>

	<!-- ── Tab panels ────────────────────────────────────────────────────── -->

	<!-- Chats -->
	{#if activeTab === 'chats'}
		<div class="tab-panel" role="tabpanel">
			<div class="panel-toolbar">
				<button class="btn-primary" type="button" onclick={newChat}>
					<Plus size={12} />
					<span>New Chat</span>
				</button>
			</div>

			{#if chats.length === 0}
				<div class="empty-panel">
					<MessageSquare size={28} class="empty-icon" />
					<p>No chats in this project yet.</p>
				</div>
			{:else}
				<ul class="chat-list" role="list">
					{#each chats as chat (chat.id)}
						<li>
							<a class="chat-row" href="/chats/{chat.id}">
								<span class="chat-title">{chat.title}</span>
								<span class="chat-date">{formatDate(chat.updatedAt)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	<!-- Files -->
	{#if activeTab === 'files'}
		<div class="tab-panel" role="tabpanel">
			<div class="panel-toolbar">
				<input
					bind:this={fileInput}
					type="file"
					multiple
					class="file-input-hidden"
					onchange={uploadFiles}
					accept=".pdf,.txt,.md,.html,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.webp,.gif"
				/>
				<button
					class="btn-primary"
					type="button"
					disabled={uploading}
					onclick={() => fileInput?.click()}
				>
					{#if uploading}
						<Loader size={12} class="spin" />
						<span>Uploading…</span>
					{:else}
						<Upload size={12} />
						<span>Upload Files</span>
					{/if}
				</button>
			</div>

			{#if uploadError}
				<p class="error-msg">{uploadError}</p>
			{/if}

			{#if files.length === 0}
				<div class="empty-panel">
					<FileText size={28} class="empty-icon" />
					<p>No files uploaded yet. Files are extracted and made available as context in chats.</p>
				</div>
			{:else}
				<ul class="file-list" role="list">
					{#each files as file (file.id)}
						{@const FileIcon = fileIcon(file)}
						<li class="file-row">
							<FileIcon size={15} class="file-icon" />
							<div class="file-info">
								<span class="file-name">{file.name}</span>
								<span class="file-meta">{formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}</span>
							</div>
							<button
								class="icon-btn danger"
								type="button"
								title="Remove file"
								aria-label="Remove {file.name}"
								onclick={() => archiveFile(file)}
							>
								<Trash2 size={13} />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	<!-- Memory -->
	{#if activeTab === 'memory'}
		<div class="tab-panel" role="tabpanel">
			<form class="memory-form" onsubmit={addMemory}>
				<div class="memory-kind-row">
					<label class="kind-option">
						<input type="radio" bind:group={memoryKind} value="remember" />
						<span>Remember</span>
					</label>
					<label class="kind-option">
						<input type="radio" bind:group={memoryKind} value="never_suggest" />
						<span>Never suggest</span>
					</label>
				</div>
				<div class="memory-input-row">
					<input
						class="memory-input"
						type="text"
						placeholder={memoryKind === 'remember'
							? 'e.g. Always use TypeScript strict mode'
							: 'e.g. Never suggest class components'}
						bind:value={memoryDraft}
						autocomplete="off"
					/>
					<button
						class="btn-primary"
						type="submit"
						disabled={!memoryDraft.trim() || addingMemory}
					>
						{addingMemory ? 'Adding…' : 'Add'}
					</button>
				</div>
			</form>

			{#if memory.length === 0}
				<div class="empty-panel">
					<Brain size={28} class="empty-icon" />
					<p>No project-scoped memory yet. Add things Bryon should remember or never suggest for this project.</p>
				</div>
			{:else}
				<ul class="memory-list" role="list">
					{#each memory as entry (entry.id)}
						<li class="memory-row" class:disabled={!entry.enabled}>
							<div class="memory-body">
								<span class="memory-kind memory-kind-{entry.kind}">
									{entry.kind === 'remember' ? 'Remember' : 'Never suggest'}
								</span>
								<p class="memory-text">{entry.body}</p>
							</div>
							<div class="memory-actions">
								<button
									class="icon-btn"
									type="button"
									title={entry.enabled ? 'Disable' : 'Enable'}
									aria-label={entry.enabled ? 'Disable memory' : 'Enable memory'}
									onclick={() => toggleMemory(entry)}
								>
									{#if entry.enabled}
										<ToggleRight size={16} class="toggle-on" />
									{:else}
										<ToggleLeft size={16} class="toggle-off" />
									{/if}
								</button>
								<button
									class="icon-btn danger"
									type="button"
									title="Delete"
									aria-label="Delete memory entry"
									onclick={() => deleteMemory(entry)}
								>
									<Trash2 size={13} />
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

<style>
.shell {
	display: flex;
	flex-direction: column;
	min-height: 100%;
	max-width: 820px;
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
	transition: color var(--motion-fast);
	flex-shrink: 0;
}

.breadcrumb-link:hover {
	color: var(--text-primary);
}

.breadcrumb-sep {
	color: var(--text-placeholder);
	font-size: 13px;
}

.project-name-btn {
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

.project-name-btn:hover {
	color: var(--accent);
}

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
	transition: border-color var(--motion-fast), color var(--motion-fast);
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

.project-desc {
	font-size: 13.5px;
	color: var(--text-muted);
	line-height: 1.55;
	margin: 0;
	margin-top: calc(-1 * var(--sp-2));
}

/* ── Linked plans ── */
.linked-plans {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	flex-wrap: wrap;
	margin-top: calc(-1 * var(--sp-2));
}

.linked-plans :global(.linked-plans-icon) {
	color: var(--text-placeholder);
	flex-shrink: 0;
}

.linked-plans-label {
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--text-placeholder);
	margin-right: var(--sp-1);
}

.plan-chip {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 2px 9px;
	border: 1px solid var(--border-subtle);
	border-radius: 99px;
	font-size: 11.5px;
	font-weight: 500;
	color: var(--text-muted);
	background: var(--bg-base);
	text-decoration: none;
	transition: border-color var(--motion-fast), color var(--motion-fast);
}

.plan-chip:hover {
	border-color: var(--border-default);
	color: var(--text-primary);
}

.plan-chip-execution {
	border-color: rgba(77, 107, 254, 0.3);
	color: var(--accent);
}

.plan-chip-maintenance {
	border-color: rgba(52, 211, 153, 0.3);
	color: var(--green, #34d399);
}

/* ── Tabs ── */
.tabs {
	display: flex;
	gap: 2px;
	border-bottom: 1px solid var(--border-subtle);
	padding-bottom: 0;
}

.tab {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 8px 14px;
	border: none;
	border-bottom: 2px solid transparent;
	margin-bottom: -1px;
	background: transparent;
	color: var(--text-muted);
	font-size: 13px;
	font-weight: 500;
	font-family: inherit;
	cursor: pointer;
	transition: color var(--motion-fast), border-color var(--motion-fast);
}

.tab.active {
	color: var(--text-primary);
	border-bottom-color: var(--accent);
}

.tab:hover:not(.active) {
	color: var(--text-secondary);
}

.tab-count {
	font-size: 11px;
	font-weight: 600;
	min-width: 18px;
	height: 18px;
	display: grid;
	place-items: center;
	border-radius: 4px;
	background: var(--bg-surface);
	color: var(--text-placeholder);
	padding: 0 4px;
}

/* ── Tab panel ── */
.tab-panel {
	display: flex;
	flex-direction: column;
	gap: var(--sp-4);
	flex: 1;
}

.panel-toolbar {
	display: flex;
	align-items: center;
	justify-content: flex-end;
}

.empty-panel {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: var(--sp-3);
	padding: var(--sp-8) var(--sp-4);
	text-align: center;
	color: var(--text-placeholder);
	font-size: 13.5px;
	line-height: 1.55;
	max-width: 380px;
	margin: 0 auto;
}

.empty-panel :global(.empty-icon) {
	opacity: 0.4;
}

/* ── Chat list ── */
.chat-list {
	list-style: none;
	margin: 0;
	padding: 0;
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
	overflow: hidden;
}

.chat-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-4);
	padding: 13px 16px;
	text-decoration: none;
	color: var(--text-secondary);
	border-bottom: 1px solid var(--border-hair);
	transition: background var(--motion-fast), color var(--motion-fast);
}

.chat-list li:last-child .chat-row {
	border-bottom: none;
}

.chat-row:hover {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

.chat-title {
	font-size: 13.5px;
	font-weight: 500;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.chat-date {
	flex-shrink: 0;
	font-size: 11.5px;
	color: var(--text-placeholder);
}

/* ── Files ── */
.file-input-hidden {
	display: none;
}

.error-msg {
	font-size: 12px;
	color: var(--red, #f87171);
	background: rgba(248, 113, 113, 0.07);
	border: 1px solid rgba(248, 113, 113, 0.15);
	border-radius: var(--radius-sm);
	padding: var(--sp-2) var(--sp-3);
}

.file-list {
	list-style: none;
	margin: 0;
	padding: 0;
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
	overflow: hidden;
}

.file-row {
	display: flex;
	align-items: center;
	gap: var(--sp-3);
	padding: 11px 14px;
	border-bottom: 1px solid var(--border-hair);
}

.file-list li:last-child .file-row {
	border-bottom: none;
}

.file-row :global(.file-icon) {
	flex-shrink: 0;
	color: var(--text-muted);
}

.file-info {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.file-name {
	font-size: 13.5px;
	font-weight: 500;
	color: var(--text-primary);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.file-meta {
	font-size: 11.5px;
	color: var(--text-placeholder);
}

/* ── Memory ── */
.memory-form {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
	padding: var(--sp-4);
	background: var(--bg-surface);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
}

.memory-kind-row {
	display: flex;
	gap: var(--sp-4);
}

.kind-option {
	display: inline-flex;
	align-items: center;
	gap: var(--sp-2);
	font-size: 12.5px;
	color: var(--text-secondary);
	cursor: pointer;
}

.kind-option input {
	accent-color: var(--accent);
}

.memory-input-row {
	display: flex;
	gap: var(--sp-2);
}

.memory-input {
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

.memory-input::placeholder {
	color: var(--text-placeholder);
}

.memory-input:focus {
	border-color: var(--accent);
	box-shadow: 0 0 0 3px rgba(77, 107, 254, 0.14);
}

.memory-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
}

.memory-row {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: var(--sp-4);
	padding: var(--sp-3) var(--sp-4);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
	background: var(--bg-surface);
	transition: opacity var(--motion-fast);
}

.memory-row.disabled {
	opacity: 0.45;
}

.memory-body {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: var(--sp-1);
}

.memory-kind {
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.07em;
	text-transform: uppercase;
}

.memory-kind-remember      { color: var(--accent); }
.memory-kind-never_suggest { color: var(--red, #f87171); }

.memory-text {
	margin: 0;
	font-size: 13.5px;
	color: var(--text-secondary);
	line-height: 1.5;
}

.memory-actions {
	display: flex;
	align-items: center;
	gap: var(--sp-1);
	flex-shrink: 0;
}

/* ── Shared icon button ── */
.icon-btn {
	display: grid;
	place-items: center;
	width: 28px;
	height: 28px;
	border: 1px solid transparent;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	transition: background var(--motion-fast), color var(--motion-fast), border-color var(--motion-fast);
}

.icon-btn:hover {
	background: var(--bg-surface-hover);
	border-color: var(--border-default);
	color: var(--text-primary);
}

.icon-btn.danger:hover {
	background: rgba(248, 113, 113, 0.1);
	border-color: rgba(248, 113, 113, 0.25);
	color: var(--red, #f87171);
}

:global(.toggle-on)  { color: var(--accent); }
:global(.toggle-off) { color: var(--text-placeholder); }

/* ── Shared buttons ── */
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

:global(.spin) {
	animation: spin 1s linear infinite;
}

@keyframes spin {
	to { transform: rotate(360deg); }
}
</style>
