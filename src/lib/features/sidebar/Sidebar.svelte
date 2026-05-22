<script lang="ts">
import { goto, invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import { tick } from 'svelte';
import {
	Plus, Settings, PanelLeftClose, MoreHorizontal, Pencil, Sparkles,
	Archive, Trash2, ChevronDown, Folder, MoveRight, FolderSearch, House,
	Map as MapIcon, ListChecks, ClipboardCheck, RefreshCw,
} from '@lucide/svelte';
import { fmtMonthYear } from '$lib/utils';
import { session, type ThinkingMode } from '$lib/features/streaming/session.svelte';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '$lib/ui/dropdown-menu';
import type { Chat, Plan, Project, Settings as AppSettings } from '$lib/shared/types';

let {
	settings,
	currentChatId = null,
	ollamaReachable = true,
	onToggle,
}: {
	settings: AppSettings;
	currentChatId?: string | null;
	ollamaReachable?: boolean;
	onToggle?: () => void;
} = $props();

const visibleChats = $derived(session.chats.filter((c) => !c.archived));
const visibleProjects = $derived(session.projects.filter((project) => !project.archivedAt));
const visiblePlans = $derived(session.plans.filter((p) => !p.archivedAt));
const globalChats = $derived(visibleChats.filter((chat) => !chat.projectId));

let opsOpen = $state(true);
let workspaceOpen = $state(true);
let chatsOpen = $state(false);

let renamingFor = $state<string | null>(null);
let renameDraft = $state('');
let renameInput: HTMLInputElement | undefined = $state();

const currentPath = $derived(page.url.pathname);

async function createNewChat(projectId: string | null = null): Promise<void> {
	const id = await session.createChat(projectId);
	if (id) goto(`/chats/${id}`);
}

function startRename(chat: Chat): void {
	renamingFor = chat.id;
	renameDraft = chat.title;
	void tick().then(() => {
		renameInput?.focus();
		renameInput?.select();
	});
}

async function commitRename(chat: Chat): Promise<void> {
	const next = renameDraft.trim();
	const current = renamingFor;
	renamingFor = null;
	if (!next || next === chat.title || current !== chat.id) return;
	try {
		const res = await fetch(`/api/chats/${chat.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: next }),
		});
		if (res.ok) {
			session.chats = session.chats.map((c) => (c.id === chat.id ? { ...c, title: next } : c));
		}
	} catch {
		// silent
	}
}

function cancelRename(): void {
	renamingFor = null;
}

let aiRenamingFor = $state<string | null>(null);

async function aiRename(chat: Chat): Promise<void> {
	if (aiRenamingFor) return;
	aiRenamingFor = chat.id;
	try {
		const res = await fetch(`/api/chats/${chat.id}/title`, { method: 'POST' });
		if (res.ok) {
			const body = await res.json();
			const updated: Chat | undefined = body?.chat;
			if (updated?.id) {
				session.chats = session.chats.map((c) => (c.id === updated.id ? updated : c));
			}
		}
	} catch {
		// silent
	} finally {
		aiRenamingFor = null;
	}
}

async function archiveChat(chat: Chat): Promise<void> {
	try {
		const res = await fetch(`/api/chats/${chat.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ archived: true }),
		});
		if (res.ok) {
			session.chats = session.chats.filter((c) => c.id !== chat.id);
			if (chat.id === currentChatId) goto('/');
		}
	} catch {
		// silent
	}
}

async function moveChat(chat: Chat, projectId: string | null): Promise<void> {
	await session.moveChat(chat.id, projectId);
	if (chat.id === currentChatId) {
		await invalidateAll();
	}
}

async function deleteChat(chat: Chat): Promise<void> {
	const ok = confirm(`Delete "${chat.title}"? This cannot be undone.`);
	if (!ok) return;
	try {
		const res = await fetch(`/api/chats/${chat.id}`, { method: 'DELETE' });
		if (res.ok || res.status === 204) {
			session.chats = session.chats.filter((c) => c.id !== chat.id);
			if (chat.id === currentChatId) goto('/');
		}
	} catch {
		// silent
	}
}

function onRenameKey(e: KeyboardEvent, chat: Chat): void {
	if (e.key === 'Enter') {
		e.preventDefault();
		void commitRename(chat);
	} else if (e.key === 'Escape') {
		e.preventDefault();
		cancelRename();
	}
}

function relativeGroup(ts: number): string {
	const now = new Date();
	const d = new Date(ts);
	const diffMs = now.getTime() - d.getTime();
	const diffDays = Math.floor(diffMs / 86_400_000);

	if (d.toDateString() === now.toDateString()) return 'Today';

	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

	if (diffDays <= 7) return 'Previous 7 days';
	if (diffDays <= 30) return 'Previous 30 days';
	return fmtMonthYear(d);
}

type Group = { label: string; items: Chat[] };

const grouped = $derived.by((): Group[] => {
	const map = new Map<string, Chat[]>();
	for (const c of globalChats) {
		const label = relativeGroup(c.updatedAt);
		let bucket = map.get(label);
		if (!bucket) {
			bucket = [];
			map.set(label, bucket);
		}
		bucket.push(c);
	}
	return [...map.entries()].map(([label, items]) => ({ label, items }));
});

function isActive(href: string): boolean {
	if (href === '/') return currentPath === '/';
	return currentPath.startsWith(href);
}
</script>

<svelte:window onclick={(e) => {
	const target = e.target as HTMLElement;
	void target;
}} />

<nav class="sidebar">
	<div class="header">
		{#if onToggle}
			<button class="toggle-btn" onclick={onToggle} title="Close sidebar" aria-label="Close sidebar">
				<PanelLeftClose size={18} />
			</button>
		{/if}
	</div>

	<!-- New chat -->
	<button class="new-chat" onclick={() => createNewChat()}>
		<Plus size={16} strokeWidth={2.5} />
		<span>New chat</span>
	</button>

	<!-- Command Center -->
	<a class="nav-link" href="/" class:active={isActive('/')} aria-label="Command Center">
		<House size={15} />
		<span>Command Center</span>
		{#if !ollamaReachable}
			<span class="status-dot offline" title="Ollama offline"></span>
		{/if}
	</a>

	<div class="threads">
		<!-- Operations section -->
		<div class="section-head">
			<span class="section-label">Operations</span>
			<button class="section-chevron-btn" onclick={() => (opsOpen = !opsOpen)} aria-label={opsOpen ? 'Collapse operations' : 'Expand operations'}>
				<ChevronDown size={12} class={!opsOpen ? 'section-chevron-collapsed' : ''} />
			</button>
		</div>
		{#if opsOpen}
			<a class="nav-link" href="/intake" class:active={isActive('/intake')}>
				<FolderSearch size={15} />
				<span>Intake</span>
			</a>
			<a class="nav-link" href="/plans" class:active={isActive('/plans')}>
				<MapIcon size={15} />
				<span>Plans</span>
				{#if visiblePlans.length > 0}
					<span class="count-badge">{visiblePlans.length}</span>
				{/if}
			</a>
			<a class="nav-link" href="/execution" class:active={isActive('/execution')}>
				<ListChecks size={15} />
				<span>Execution</span>
			</a>
			<a class="nav-link" href="/review" class:active={isActive('/review')}>
				<ClipboardCheck size={15} />
				<span>Review</span>
			</a>

			<!-- Active plans inline -->
			{#if visiblePlans.length > 0}
				<div class="plan-list">
					{#each visiblePlans.slice(0, 8) as plan (plan.id)}
						<a class="plan-row" href="/plans/{plan.id}" title={plan.name} class:active={currentPath === `/plans/${plan.id}`}>
							<span class="plan-row-name">{plan.name}</span>
						</a>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Workspace section -->
		<div class="section-head">
			<span class="section-label">Workspace</span>
			<button class="section-chevron-btn" onclick={() => (workspaceOpen = !workspaceOpen)} aria-label={workspaceOpen ? 'Collapse workspace' : 'Expand workspace'}>
				<ChevronDown size={12} class={!workspaceOpen ? 'section-chevron-collapsed' : ''} />
			</button>
		</div>
		{#if workspaceOpen}
			<a class="nav-link" href="/workspace-sync" class:active={isActive('/workspace-sync')}>
				<RefreshCw size={15} />
				<span>Workspace Sync</span>
			</a>
			<a class="nav-link" href="/projects" class:active={isActive('/projects')}>
				<Folder size={15} />
				<span>Projects</span>
			</a>
		{/if}

		<!-- Chats section -->
		<div class="section-head">
			<span class="section-label">Chats</span>
			<button class="section-chevron-btn" onclick={() => (chatsOpen = !chatsOpen)} aria-label={chatsOpen ? 'Collapse chats' : 'Expand chats'}>
				<ChevronDown size={12} class={!chatsOpen ? 'section-chevron-collapsed' : ''} />
			</button>
		</div>
		{#if chatsOpen}
			{#if session.chats.length === 0 && !session.currentChatId}
				<div class="empty-hint">No chats yet</div>
			{/if}
			{#each grouped as group (group.label)}
				<div class="group-label">{group.label}</div>
				{#each group.items as chat (chat.id)}
					<div class="row" class:active={chat.id === currentChatId}>
						{#if renamingFor === chat.id}
							<input
								bind:this={renameInput}
								class="rename-input"
								bind:value={renameDraft}
								onkeydown={(e) => onRenameKey(e, chat)}
								onblur={() => commitRename(chat)}
								aria-label="Rename chat"
							/>
						{:else}
							<a
								class="thread"
								href={`/chats/${chat.id}`}
								title={chat.title}
								aria-current={chat.id === currentChatId ? 'page' : undefined}
							>
								<span class="thread-title">{chat.title}</span>
							</a>
							<DropdownMenu>
								<DropdownMenuTrigger aria-label="Chat actions">
									<MoreHorizontal size={14} />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onSelect={() => startRename(chat)}>
										<Pencil size={13} />
										<span>Rename manually</span>
									</DropdownMenuItem>
									<DropdownMenuItem
										disabled={aiRenamingFor === chat.id}
										onSelect={() => aiRename(chat)}
									>
										<Sparkles size={13} class={aiRenamingFor === chat.id ? 'spin' : ''} />
										<span>Rename with AI</span>
									</DropdownMenuItem>
									<DropdownMenuSub>
										<DropdownMenuSubTrigger>
											<MoveRight size={13} />
											<span>Move to</span>
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent>
											<DropdownMenuItem
												disabled={!chat.projectId}
												onSelect={() => moveChat(chat, null)}
											>
												<span>Global</span>
											</DropdownMenuItem>
											{#each visibleProjects as project (project.id)}
												<DropdownMenuItem onSelect={() => moveChat(chat, project.id)}>
													<span>{project.name}</span>
												</DropdownMenuItem>
											{/each}
										</DropdownMenuSubContent>
									</DropdownMenuSub>
									<DropdownMenuSeparator />
									<DropdownMenuItem onSelect={() => archiveChat(chat)}>
										<Archive size={13} />
										<span>Archive</span>
									</DropdownMenuItem>
									<DropdownMenuItem variant="destructive" onSelect={() => deleteChat(chat)}>
										<Trash2 size={13} />
										<span>Delete</span>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						{/if}
					</div>
				{/each}
			{:else}
				{#if session.chats.length > 0}
					<div class="empty-hint">No global chats</div>
				{/if}
			{/each}
		{/if}
	</div>

	<!-- Footer -->
	<div class="footer">
		<a class="footer-link" href="/settings" class:active={isActive('/settings')}>
			<Settings size={15} />
			<span>Settings</span>
		</a>
	</div>
</nav>

<style>
.sidebar {
	display: flex;
	flex-direction: column;
	height: 100%;
	padding: var(--sp-3);
	min-width: var(--sidebar-w);
}

.header {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--sp-2);
	padding: var(--sp-2) var(--sp-2) var(--sp-3);
	flex-shrink: 0;
}

.toggle-btn {
	flex-shrink: 0;
	display: grid;
	place-items: center;
	width: 30px;
	height: 30px;
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	transition: color var(--motion-fast), background var(--motion-fast);
}

.toggle-btn:hover {
	color: var(--text-primary);
	background: var(--bg-surface-hover);
}

.new-chat {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--sp-2);
	height: 38px;
	margin-bottom: var(--sp-3);
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-secondary);
	font-size: 13.5px;
	font-weight: 500;
	cursor: pointer;
	transition: color var(--motion-fast), background var(--motion-fast), border-color var(--motion-fast);
}

.new-chat:hover {
	border-color: var(--border-strong);
	background: var(--bg-surface);
	color: var(--text-primary);
}

/* ── Nav links ── */
.nav-link {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	padding: 7px var(--sp-2);
	border-radius: var(--radius-sm);
	color: var(--text-muted);
	font-size: 13px;
	font-weight: 500;
	text-decoration: none;
	transition: color var(--motion-fast), background var(--motion-fast);
}

.nav-link:hover {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

.nav-link.active {
	color: var(--text-primary);
	background: var(--accent-soft);
}

.count-badge {
	margin-left: auto;
	font-size: 10px;
	font-weight: 700;
	color: var(--text-muted);
	background: rgba(255, 255, 255, 0.06);
	padding: 1px 6px;
	border-radius: 999px;
}

.status-dot {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	margin-left: auto;
	flex-shrink: 0;
}

.status-dot.offline {
	background: #f87171;
	box-shadow: 0 0 6px rgba(248, 113, 113, 0.5);
}

/* ── Threads ── */
.threads {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 1px;
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--sp-3) var(--sp-2) var(--sp-1);
	color: var(--text-muted);
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.04em;
	text-transform: uppercase;
}

.section-label {
	flex: 1;
	min-width: 0;
}

.section-chevron-btn {
	flex-shrink: 0;
	display: grid;
	place-items: center;
	width: 24px;
	height: 24px;
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	transition: color var(--motion-fast), background var(--motion-fast);
}

.section-chevron-btn:hover {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

.section-chevron-btn :global(svg) {
	transition: transform var(--motion-fast);
}

.section-chevron-btn :global(svg.section-chevron-collapsed) {
	transform: rotate(-90deg);
}

/* ── Plan rows ── */
.plan-list {
	display: flex;
	flex-direction: column;
	gap: 1px;
	padding-left: var(--sp-2);
}

.plan-row {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 4px var(--sp-3);
	border-radius: var(--radius-sm);
	color: var(--text-secondary);
	text-decoration: none;
	font-size: 12.5px;
	transition: background var(--motion-fast), color var(--motion-fast);
	min-width: 0;
}

.plan-row:hover {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

.plan-row.active {
	color: var(--text-primary);
	background: var(--accent-soft);
}

.plan-row-name {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/* ── Chat rows ── */
.group-label {
	padding: var(--sp-3) var(--sp-2) var(--sp-1);
	color: var(--text-muted);
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.02em;
}

.thread {
	flex: 1;
	display: block;
	padding: var(--sp-2) var(--sp-2);
	border-radius: var(--radius-sm);
	color: var(--text-secondary);
	font-size: 13px;
	text-decoration: none;
	transition: background var(--motion-fast), color var(--motion-fast);
	min-width: 0;
}

.thread:hover {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

.row {
	position: relative;
	display: flex;
	align-items: center;
	gap: 2px;
	border-radius: var(--radius-sm);
}

.row.active {
	background: var(--accent-soft);
	border-radius: var(--radius-sm);
}

.row.active .thread {
	color: var(--text-primary);
}

.row.active .thread:hover {
	background: transparent;
}

.row.active::before {
	content: '';
	position: absolute;
	left: 0;
	top: 0;
	bottom: 0;
	width: 2px;
	border-radius: 1px;
	background: var(--accent);
}

.row :global([data-slot='dropdown-menu-trigger']) {
	flex-shrink: 0;
	display: grid;
	place-items: center;
	width: 24px;
	height: 24px;
	margin-right: 2px;
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	opacity: 0;
	transition: opacity var(--motion-fast), background var(--motion-fast), color var(--motion-fast);
}

.row:hover :global([data-slot='dropdown-menu-trigger']),
.row :global([data-slot='dropdown-menu-trigger'][data-state='open']),
.row :global([data-slot='dropdown-menu-trigger']:focus-visible) {
	opacity: 1;
}

.row :global([data-slot='dropdown-menu-trigger']:hover) {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

.row :global([data-slot='dropdown-menu-content']) {
	min-width: 176px;
}

.row :global([data-slot='dropdown-menu-content'] .spin) {
	animation: bryon-spin 900ms linear infinite;
}

@keyframes bryon-spin {
	to { transform: rotate(360deg); }
}

.rename-input {
	flex: 1;
	padding: 6px var(--sp-2);
	border: 1px solid var(--accent);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	color: var(--text-primary);
	font-size: 13px;
	font-family: inherit;
	outline: none;
}

.thread-title {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.empty-hint {
	padding: var(--sp-4) var(--sp-2);
	color: var(--text-muted);
	font-size: 13px;
	text-align: center;
}

/* ── Footer ── */
.footer {
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding-top: var(--sp-3);
	border-top: 1px solid var(--border-subtle);
	margin-top: var(--sp-2);
}

.footer-link {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	padding: var(--sp-2);
	border-radius: var(--radius-sm);
	color: var(--text-muted);
	font-size: 13px;
	text-decoration: none;
	transition: color var(--motion-fast), background var(--motion-fast);
}

.footer-link:hover {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

.footer-link.active {
	color: var(--text-primary);
	background: var(--accent-soft);
}
</style>
