<script lang="ts">
import { goto } from '$app/navigation';
import { tick } from 'svelte';
import { Plus, Settings, PanelLeftClose, MoreHorizontal, Pencil, Sparkles, Archive, Trash2, ChevronDown } from '@lucide/svelte';
import { session, type ThinkingMode } from '$lib/features/streaming/session.svelte';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '$lib/ui/dropdown-menu';
import type { Chat, Settings as AppSettings } from '$lib/shared/types';

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

// ── Model picker ─────────────────────────────────────────────
const activeModel = $derived.by(() => {
	const chat = session.chats.find((c) => c.id === currentChatId);
	return chat?.resolvedModel ?? chat?.model ?? settings.llm.model;
});

let modelPickerOpen = $state(false);

function toggleModelPicker(): void {
	if (session.availableModels.length === 0) return;
	modelPickerOpen = !modelPickerOpen;
}

function selectModel(name: string): void {
	modelPickerOpen = false;
	if (currentChatId && name !== activeModel) {
		void session.changeModel(currentChatId, name);
	}
}

// ── Thinking mode dropdown ────────────────────────────────────
const thinkingOptions: { value: ThinkingMode; label: string; description: string }[] = [
	{ value: 'off',      label: 'Off',      description: 'Reasoning fully disabled' },
	{ value: 'auto',     label: 'Auto',     description: 'Reason only when needed' },
	{ value: 'light',    label: 'Light',    description: 'Think briefly, respond directly' },
	{ value: 'normal',   label: 'Normal',   description: 'Default reasoning depth' },
	{ value: 'extended', label: 'Extended', description: 'Reason thoroughly on everything' },
];

let thinkingPickerOpen = $state(false);

function toggleThinkingPicker(): void {
	thinkingPickerOpen = !thinkingPickerOpen;
}

function selectThinkingMode(mode: ThinkingMode): void {
	thinkingPickerOpen = false;
	session.thinkingMode = mode;
}

const activeThinkingLabel = $derived(
	thinkingOptions.find((o) => o.value === session.thinkingMode)?.label ?? 'Normal',
);

const visibleChats = $derived(session.chats.filter((c) => !c.archived));

let renamingFor = $state<string | null>(null);
let renameDraft = $state('');
let renameInput: HTMLInputElement | undefined = $state();

async function createNewChat(): Promise<void> {
	const id = await session.createChat();
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
	return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

type Group = { label: string; items: Chat[] };

const grouped = $derived.by((): Group[] => {
	const map = new Map<string, Chat[]>();
	for (const c of visibleChats) {
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
</script>

<svelte:window onclick={(e) => {
	const target = e.target as HTMLElement;
	if (modelPickerOpen && !target?.closest('.model-picker-wrap')) modelPickerOpen = false;
	if (thinkingPickerOpen && !target?.closest('.thinking-picker-wrap')) thinkingPickerOpen = false;
}} />

<nav class="sidebar">
	<!-- Header: model picker + thinking picker + close -->
	<div class="header">
		<!-- Model picker -->
		<div class="model-picker-wrap">
			<button
				class="picker-btn"
				class:has-options={session.availableModels.length > 0}
				onclick={toggleModelPicker}
				aria-haspopup="listbox"
				aria-expanded={modelPickerOpen}
				title={session.availableModels.length > 0 ? 'Change model' : undefined}
			>
				<span class="picker-label">{activeModel}</span>
				{#if session.availableModels.length > 0}
					<ChevronDown size={11} />
				{/if}
			</button>

			{#if modelPickerOpen}
				<div class="picker-menu" role="listbox" aria-label="Select model">
					{#each session.availableModels as m (m)}
						<button
							class="menu-item"
							class:active={m === activeModel}
							role="option"
							aria-selected={m === activeModel}
							onclick={() => selectModel(m)}
						>
							{m}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Thinking picker -->
		<div class="thinking-picker-wrap">
			<button
				class="picker-btn has-options"
				onclick={toggleThinkingPicker}
				aria-haspopup="listbox"
				aria-expanded={thinkingPickerOpen}
				title="Change thinking depth"
			>
				<span class="picker-label">{activeThinkingLabel}</span>
				<ChevronDown size={11} />
			</button>

			{#if thinkingPickerOpen}
				<div class="picker-menu picker-menu--right" role="listbox" aria-label="Select thinking depth">
					{#each thinkingOptions as opt (opt.value)}
						<button
							class="menu-item"
							class:active={session.thinkingMode === opt.value}
							role="option"
							aria-selected={session.thinkingMode === opt.value}
							onclick={() => selectThinkingMode(opt.value)}
							title={opt.description}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Close sidebar -->
		{#if onToggle}
			<button class="toggle-btn" onclick={onToggle} title="Close sidebar" aria-label="Close sidebar">
				<PanelLeftClose size={18} />
			</button>
		{/if}
	</div>

	<!-- New chat -->
	<button class="new-chat" onclick={createNewChat}>
		<Plus size={16} strokeWidth={2.5} />
		<span>New chat</span>
	</button>

	<!-- Thread list -->
	<div class="threads">
		{#if session.chats.length === 0 && !session.currentChatId}
			<div class="skeletons">
				{#each Array(6) as _}
					<div class="skeleton-row">
						<div class="skeleton-line"></div>
						<div class="skeleton-line short"></div>
					</div>
				{/each}
			</div>
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
			<div class="empty-hint">No conversations yet</div>
		{/each}
	</div>

	<!-- Footer -->
	<div class="footer">
		<div class="status-row">
			<span class="dot" class:online={ollamaReachable} class:offline={!ollamaReachable}></span>
			<span class="status-text">{ollamaReachable ? 'Ollama connected' : 'Ollama offline'}</span>
		</div>
		<a class="footer-link" href="/settings">
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

/* ── Header ── */
.header {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	padding: var(--sp-2) var(--sp-2) var(--sp-3);
	flex-shrink: 0;
}

/* Shared picker button — used by both model and thinking pickers */
.model-picker-wrap,
.thinking-picker-wrap {
	position: relative;
}

.model-picker-wrap {
	flex: 1;
	min-width: 0;
}

.picker-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	width: 100%;
	padding: 5px var(--sp-2);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-primary);
	font-size: 13px;
	font-weight: 500;
	font-family: inherit;
	cursor: default;
	white-space: nowrap;
	overflow: hidden;
	transition: background var(--motion-fast), border-color var(--motion-fast);
}

.picker-btn.has-options {
	cursor: pointer;
}

.picker-btn.has-options:hover {
	background: var(--bg-surface-hover);
	border-color: var(--border-default);
}

.picker-label {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	text-align: left;
}

.picker-menu {
	position: absolute;
	top: calc(100% + 4px);
	left: 0;
	min-width: 100%;
	max-height: 260px;
	overflow-y: auto;
	background: var(--bg-surface);
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	box-shadow: var(--shadow-md);
	z-index: 100;
	padding: 4px;
}

/* Thinking menu opens to the right edge so it doesn't clip */
.picker-menu--right {
	left: auto;
	right: 0;
}

.menu-item {
	display: block;
	width: 100%;
	text-align: left;
	padding: 6px 10px;
	border: none;
	border-radius: 4px;
	background: transparent;
	font-size: 12px;
	font-family: inherit;
	color: var(--text-primary);
	cursor: pointer;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.menu-item:hover {
	background: var(--bg-surface-hover);
}

.menu-item.active {
	color: var(--accent-text);
	font-weight: 600;
}

/* Sidebar toggle */
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
	transition:
		color var(--motion-fast),
		background var(--motion-fast);
}

.toggle-btn:hover {
	color: var(--text-primary);
	background: var(--bg-surface-hover);
}

/* ── New chat ── */
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
	transition:
		color var(--motion-fast),
		background var(--motion-fast),
		border-color var(--motion-fast);
}

.new-chat:hover {
	border-color: var(--border-strong);
	background: var(--bg-surface);
	color: var(--text-primary);
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
	transition:
		background var(--motion-fast),
		color var(--motion-fast);
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
.row.active .thread {
	background: var(--bg-surface);
	color: var(--text-primary);
}
.row.active .thread:hover {
	background: var(--bg-surface-hover);
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
	transition:
		opacity var(--motion-fast),
		background var(--motion-fast),
		color var(--motion-fast);
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
	to {
		transform: rotate(360deg);
	}
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
	padding: var(--sp-8) var(--sp-2);
	color: var(--text-muted);
	font-size: 13px;
	text-align: center;
}

.skeletons {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
	padding: var(--sp-2);
}

.skeleton-row {
	display: flex;
	flex-direction: column;
	gap: 6px;
	padding: var(--sp-2);
}

.skeleton-line {
	height: 12px;
	background: var(--bg-surface-hover);
	border-radius: 4px;
	animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.skeleton-line.short {
	width: 60%;
}

@keyframes pulse {
	0%, 100% { opacity: 1; }
	50% { opacity: .5; }
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

.status-row {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	padding: var(--sp-2);
	color: var(--text-muted);
	font-size: 12px;
}

.dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	flex-shrink: 0;
}
.dot.online { background: var(--green); }
.dot.offline { background: var(--amber); }

.status-text {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 12px;
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
	transition:
		color var(--motion-fast),
		background var(--motion-fast);
}

.footer-link:hover {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}
</style>
