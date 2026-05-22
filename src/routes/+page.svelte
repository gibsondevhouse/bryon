<script lang="ts">
import { goto } from '$app/navigation';
import {
	ArrowUp,
	Paperclip,
	Globe,
	ArrowUpRight,
	MessageSquare,
	Map as MapIcon,
	ListChecks,
	ClipboardCheck,
	Activity,
	ExternalLink,
	Square,
	AlertTriangle,
	Folder,
} from '@lucide/svelte';
import { session } from '$lib/features/streaming/session.svelte';
import { fmtDateTime, fmtDate } from '$lib/utils';
import DoctrineStatusBadge from '$lib/features/doctrine/DoctrineStatusBadge.svelte';
import type { Plan, PlanStatus, Task } from '$lib/shared/types';
import type { Action } from 'svelte/action';

let { data } = $props();

const online = $derived(data.ollamaReachable ?? session.ollamaReachable);

const allPlans = $derived((data.plans ?? []).filter((p: Plan) => !p.archivedAt));

function lifecycleFor(status: PlanStatus): string {
	const m: Record<string, string> = {
		ideation: 'proposed', definition: 'drafting', drafting: 'drafting',
		execution: 'active', active: 'active', maintenance: 'archived',
	};
	return m[status] ?? 'proposed';
}

const activePlans = $derived(allPlans.filter((p: Plan) => ['execution', 'active'].includes(p.status)));
const draftingPlans = $derived(allPlans.filter((p: Plan) => ['definition', 'drafting'].includes(p.status)));
const proposedPlans = $derived(allPlans.filter((p: Plan) => p.status === 'ideation'));

const allTasks = $derived((data.tasks ?? []) as Task[]);
const tasksByStatus = $derived({
	planned: allTasks.filter((t: Task) => t.status === 'planned').length,
	in_progress: allTasks.filter((t: Task) => t.status === 'in_progress').length,
	blocked: allTasks.filter((t: Task) => t.status === 'blocked').length,
	completed: allTasks.filter((t: Task) => t.status === 'completed').length,
});
const totalActive = $derived(tasksByStatus.planned + tasksByStatus.in_progress + tasksByStatus.blocked);

const recentChats = $derived(data.chats.slice(0, 4));
const recentProjects = $derived((data.projects ?? []).filter((p: { archivedAt?: number | null }) => !p.archivedAt).slice(0, 3));

let mode = $state<'chat' | 'web'>('chat');
let value = $state('');
let textarea = $state<HTMLTextAreaElement | null>(null);
let msgsEl = $state<HTMLDivElement | null>(null);
let chatId = $state<string | null>(null);

const canSend = $derived(value.trim().length > 0);
const inlineMessages = $derived(chatId ? session.messages.filter((m) => m.role !== 'system') : []);
const isStreaming = $derived(session.streaming && session.currentChatId === chatId);
const isConnecting = $derived(isStreaming && !session.streamingContent);
const hasInlineChat = $derived(inlineMessages.length > 0 || isStreaming);

$effect(() => {
	void session.streamingContent;
	void session.messages.length;
	if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
});

async function submit(): Promise<void> {
	const content = value.trim();
	if (!content) return;
	value = '';
	if (textarea) textarea.style.height = 'auto';

	if (!chatId) {
		const id = await session.createChat();
		if (!id) return;
		chatId = id;
		session.hydrate({ currentChatId: id, messages: [] });
	}

	void session.send(chatId, content, { webSearch: mode === 'web' });
}

function onKeydown(e: KeyboardEvent): void {
	if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
		e.preventDefault();
		void submit();
	}
}

function autosize(): void {
	if (!textarea) return;
	textarea.style.height = 'auto';
	textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
}

const spotlight: Action<HTMLElement> = (node) => {
	function move(e: MouseEvent): void {
		const r = node.getBoundingClientRect();
		node.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
		node.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
	}
	node.addEventListener('mousemove', move);
	return { destroy() { node.removeEventListener('mousemove', move); } };
};
</script>

<svelte:head>
	<title>Command Center — Bryon</title>
</svelte:head>

<div class="canvas">
	<div class="bento-grid">
		<!-- Composer -->
		<section class="bento composer-tile glass" class:has-chat={hasInlineChat} style:--idx={0} use:spotlight>
			<header class="tile-brand" class:compact={hasInlineChat}>
				{#if !hasInlineChat}
					<h1>Bryon</h1>
					<p class="sub">Command Center · {data.settings.llm.model}</p>
				{:else}
					<span class="brand-compact">Bryon</span>
					{#if chatId}
						<a href="/chats/{chatId}" class="open-chat-link">
							Open in Chat <ExternalLink size={11} aria-hidden="true" />
						</a>
					{/if}
				{/if}
			</header>

			{#if hasInlineChat}
				<div class="inline-msgs" bind:this={msgsEl}>
					{#each inlineMessages as msg (msg.id)}
						{#if msg.role === 'user'}
							<div class="msg msg-user">{msg.content}</div>
						{:else if msg.role === 'assistant'}
							<div class="msg msg-assistant">{msg.content ?? ''}</div>
						{/if}
					{/each}
					{#if isConnecting}
						<div class="msg msg-assistant typing-indicator" aria-label="Bryon is thinking">
							<span></span><span></span><span></span>
						</div>
					{:else if isStreaming && session.streamingContent}
						<div class="msg msg-assistant msg-streaming">{session.streamingContent}</div>
					{/if}
				</div>
			{/if}

			<div class="composer-stack">
				<div class="mode-track" role="tablist" aria-label="Mode" style:--idx={mode === 'web' ? 1 : 0}>
					<span class="mode-indicator" aria-hidden="true"></span>
					<button type="button" role="tab" aria-selected={mode === 'chat'} class="mode-tab" class:active={mode === 'chat'} onclick={() => (mode = 'chat')}>Chat</button>
					<button type="button" role="tab" aria-selected={mode === 'web'} class="mode-tab" class:active={mode === 'web'} onclick={() => (mode = 'web')}>Web</button>
				</div>

				<form class="composer" onsubmit={(e) => { e.preventDefault(); void submit(); }}>
					<textarea bind:this={textarea} bind:value oninput={autosize} onkeydown={onKeydown} placeholder={hasInlineChat ? 'Reply...' : 'Ask anything'} rows="1" aria-label="Message"></textarea>
					<div class="composer-row">
						<div class="sub-pills">
							<button type="button" class="sub-pill" aria-label="Attach" disabled><Paperclip size={15} aria-hidden="true" /><span>Attach</span></button>
							<button type="button" class="sub-pill" class:on={mode === 'web'} aria-pressed={mode === 'web'} onclick={() => (mode = mode === 'web' ? 'chat' : 'web')}><Globe size={15} aria-hidden="true" /><span>Web</span></button>
						</div>
						{#if isStreaming}
							<button type="button" class="send stop" aria-label="Stop generating" onclick={() => session.cancel()}><Square size={12} aria-hidden="true" /></button>
						{:else}
							<button type="submit" class="send" class:ready={canSend} aria-label="Send" data-testid="start-new-chat"><ArrowUp size={16} aria-hidden="true" /></button>
						{/if}
					</div>
				</form>
			</div>
		</section>

		<!-- Operations Overview -->
		<section class="bento ops-tile glass" style:--idx={1} use:spotlight data-testid="home-ops-panel">
			<header class="tile-head">
				<span class="tile-title"><Activity size={14} aria-hidden="true" /> Operations</span>
				<span class="status-dot" class:offline={!online} title={online ? 'Bryon is ready' : 'Ollama offline'}></span>
			</header>

			<div class="ops-stats">
				<div class="ops-stat">
					<span class="stat-value">{activePlans.length}</span>
					<span class="stat-label">Active</span>
				</div>
				<div class="ops-stat">
					<span class="stat-value">{draftingPlans.length}</span>
					<span class="stat-label">Drafting</span>
				</div>
				<div class="ops-stat">
					<span class="stat-value">{proposedPlans.length}</span>
					<span class="stat-label">Proposed</span>
				</div>
				<div class="ops-stat" class:has-blocked={tasksByStatus.blocked > 0}>
					<span class="stat-value">{tasksByStatus.blocked}</span>
					<span class="stat-label">Blocked</span>
				</div>
			</div>

			<nav class="quick-actions">
				<a href="/plans" class="qa-btn"><MapIcon size={15} aria-hidden="true" /><span>Plans</span></a>
				<a href="/execution" class="qa-btn"><ListChecks size={15} aria-hidden="true" /><span>Execution</span></a>
				<a href="/review" class="qa-btn"><ClipboardCheck size={15} aria-hidden="true" /><span>Review</span></a>
				<a href="/settings" class="qa-btn"><Activity size={15} aria-hidden="true" /><span>Settings</span></a>
			</nav>
		</section>

		<!-- Active Plans -->
		<section class="bento list-tile plans-tile glass" style:--idx={2} use:spotlight>
			<header class="tile-head">
				<a class="tile-title link" href="/plans">
					<MapIcon size={14} aria-hidden="true" /> Active Plans
					<ArrowUpRight size={13} class="head-arrow" aria-hidden="true" />
				</a>
			</header>

			{#if activePlans.length || draftingPlans.length}
				<ul class="list">
					{#each [...activePlans, ...draftingPlans].slice(0, 6) as plan (plan.id)}
						<li>
							<a href="/plans/{plan.id}">
								<span class="row-name">{plan.name}</span>
								<DoctrineStatusBadge kind="plan" status={lifecycleFor(plan.status)} />
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">No active plans.</p>
			{/if}
		</section>

		<!-- Execution Summary -->
		<section class="bento list-tile exec-tile glass" style:--idx={3} use:spotlight>
			<header class="tile-head">
				<a class="tile-title link" href="/execution">
					<ListChecks size={14} aria-hidden="true" /> Execution
					<ArrowUpRight size={13} class="head-arrow" aria-hidden="true" />
				</a>
			</header>

			{#if totalActive > 0 || tasksByStatus.completed > 0}
				<div class="exec-bars">
					{#if tasksByStatus.in_progress > 0}
						<div class="exec-row">
							<span class="exec-label">In Progress</span>
							<span class="exec-count accent">{tasksByStatus.in_progress}</span>
						</div>
					{/if}
					{#if tasksByStatus.planned > 0}
						<div class="exec-row">
							<span class="exec-label">Not Started</span>
							<span class="exec-count">{tasksByStatus.planned}</span>
						</div>
					{/if}
					{#if tasksByStatus.blocked > 0}
						<div class="exec-row">
							<span class="exec-label"><AlertTriangle size={11} aria-hidden="true" /> Blocked</span>
							<span class="exec-count danger">{tasksByStatus.blocked}</span>
						</div>
					{/if}
					{#if tasksByStatus.completed > 0}
						<div class="exec-row">
							<span class="exec-label">Completed</span>
							<span class="exec-count success">{tasksByStatus.completed}</span>
						</div>
					{/if}
				</div>
			{:else}
				<p class="empty">No tasks yet.</p>
			{/if}
		</section>

		<!-- Recent Chats -->
		<section class="bento list-tile recents-tile glass" style:--idx={4} use:spotlight data-testid="home-recent-panel">
			<header class="tile-head">
				<span class="tile-title"><MessageSquare size={14} aria-hidden="true" /> Recent</span>
			</header>

			{#if recentChats.length}
				<ul class="list">
					{#each recentChats as chat (chat.id)}
						<li>
							<a href="/chats/{chat.id}">
								<span class="row-name">{chat.title}</span>
								<span class="row-meta">{fmtDateTime(chat.updatedAt)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">No conversations yet.</p>
			{/if}
		</section>

		<!-- Projects -->
		<section class="bento list-tile projects-tile glass" style:--idx={5} use:spotlight>
			<header class="tile-head">
				<a class="tile-title link" href="/projects">
					<Folder size={14} aria-hidden="true" /> Projects
					<ArrowUpRight size={13} class="head-arrow" aria-hidden="true" />
				</a>
			</header>

			{#if recentProjects.length}
				<ul class="list">
					{#each recentProjects as project (project.id)}
						<li>
							<a href="/projects/{project.id}">
								<span class="row-name">{project.name}</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">No projects yet.</p>
			{/if}
		</section>
	</div>
</div>

<style>
.canvas {
	position: relative;
	flex: 1;
	width: 100%;
	display: grid;
	place-items: center;
	padding: var(--sp-6) var(--sp-4);
}

.bento-grid {
	position: relative;
	z-index: 1;
	width: 100%;
	max-width: 1080px;
	display: grid;
	grid-template-columns: repeat(6, 1fr);
	grid-auto-rows: minmax(116px, auto);
	gap: var(--sp-5);
	grid-template-areas:
		"composer  composer  composer  composer  ops      ops"
		"composer  composer  composer  composer  plans    plans"
		"exec      exec      recents  recents   projects projects";
}

/* ── Card base ── */
.bento {
	position: relative;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	gap: var(--sp-4);
	padding: var(--sp-5);
	border-radius: var(--radius-xl);
	background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0) 38%);
	box-shadow: var(--glow-soft);
	animation: bryon-rise var(--spring-slow) both;
	animation-delay: calc(var(--idx, 0) * 80ms);
	transition: transform var(--spring), box-shadow var(--spring), border-color var(--spring);
}

.bento::before {
	content: "";
	position: absolute;
	inset: 0;
	border-radius: inherit;
	background: radial-gradient(260px circle at var(--mx) var(--my), var(--accent-soft), transparent 60%);
	opacity: 0;
	transition: opacity var(--spring);
	pointer-events: none;
}

.bento > * { position: relative; z-index: 1; }

.bento:hover {
	transform: translateY(-3px);
	border-color: var(--glass-border-hover);
	box-shadow: var(--glow-accent), var(--glow-soft);
}

.bento:hover::before { opacity: 1; }

.composer-tile  { grid-area: composer; justify-content: space-between; min-height: 280px; max-height: 540px; }
.composer-tile.has-chat { justify-content: flex-start; gap: var(--sp-3); }
.ops-tile       { grid-area: ops; }
.plans-tile     { grid-area: plans; }
.exec-tile      { grid-area: exec; }
.recents-tile   { grid-area: recents; }
.projects-tile  { grid-area: projects; }

/* ── Brand ── */
.tile-brand { display: flex; flex-direction: column; gap: var(--sp-1); }
.tile-brand.compact { flex-direction: row; align-items: center; justify-content: space-between; gap: var(--sp-3); flex: none; }
.brand-compact { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; color: var(--text-muted); }

.open-chat-link {
	display: inline-flex; align-items: center; gap: 5px;
	font-size: 12px; color: var(--text-muted); text-decoration: none;
	transition: color var(--motion-fast);
}
.open-chat-link:hover { color: var(--accent-text); }

.tile-brand h1 { margin: 0; font-size: clamp(30px, 4vw, 40px); font-weight: 600; letter-spacing: -0.03em; color: #ffffff; line-height: 1; }
.tile-brand .sub { margin: 0; font-size: 12.5px; color: var(--text-muted); letter-spacing: 0.01em; }

/* ── Inline messages ── */
.inline-msgs { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--sp-3); padding: 2px 2px 4px; min-height: 0; scrollbar-width: thin; }
.msg { max-width: 92%; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.msg-user { align-self: flex-end; background: var(--accent-soft); color: var(--text-primary); padding: 8px 13px; border-radius: 16px 16px 4px 16px; }
.msg-assistant { align-self: flex-start; color: var(--text-secondary); }
.msg-streaming { opacity: 0.85; }

.typing-indicator { display: flex; align-items: center; gap: 5px; padding: 4px 2px; }
.typing-indicator span { display: block; width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); animation: typing-bounce 1.2s ease-in-out infinite; }
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-5px); opacity: 1; } }

.send.stop { background: rgba(255, 255, 255, 0.08); color: var(--text-muted); }
.send.stop:hover { background: rgba(255, 80, 80, 0.18); color: #f87171; }

/* ── Composer ── */
.composer-stack { display: flex; flex-direction: column; gap: var(--sp-3); }

.mode-track { position: relative; display: inline-flex; align-self: flex-start; padding: 4px; background: var(--surface-tint); border: 1px solid var(--border-hair); border-radius: 999px; isolation: isolate; }
.mode-indicator { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px); border-radius: 999px; background: rgba(255, 255, 255, 0.08); transform: translateX(calc(var(--idx, 0) * 100%)); transition: transform var(--spring); z-index: 0; }
.mode-tab { position: relative; z-index: 1; min-width: 84px; padding: 7px 18px; border: 0; background: transparent; color: var(--text-muted); font: inherit; font-size: 13px; font-weight: 500; letter-spacing: 0.01em; cursor: pointer; border-radius: 999px; transition: color var(--spring); }
.mode-tab.active { color: #ffffff; }
.mode-tab:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18); }

.composer { width: 100%; display: flex; flex-direction: column; gap: var(--sp-2); padding: 12px 14px 10px; background: var(--bg-input); border: 1px solid var(--border-hair); border-radius: var(--radius-input); transition: border-color var(--spring), box-shadow var(--spring), background-color var(--spring); }
.composer:focus-within { border-color: var(--accent-soft); background: rgba(255, 255, 255, 0.04); box-shadow: var(--halo); }
.composer textarea { width: 100%; max-height: 220px; min-height: 28px; resize: none; border: 0; background: transparent; color: #ffffff; font: inherit; font-size: 15px; line-height: 1.5; outline: none; padding: 4px 2px; }
.composer textarea::placeholder { color: var(--text-placeholder); }
.composer-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); }
.sub-pills { display: inline-flex; gap: 4px; }
.sub-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border: 0; background: transparent; color: var(--text-muted); font: inherit; font-size: 12.5px; border-radius: 999px; cursor: pointer; transition: color var(--motion-fast), background-color var(--motion-fast); }
.sub-pill:hover:not(:disabled) { background: rgba(255, 255, 255, 0.04); color: var(--text-secondary); }
.sub-pill:disabled { opacity: 0.45; cursor: not-allowed; }
.sub-pill.on { background: var(--accent-soft); color: var(--accent-text); }
.send { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 0; border-radius: 999px; background: rgba(255, 255, 255, 0.08); color: #ffffff; cursor: pointer; transition: background-color var(--spring), box-shadow var(--spring), transform var(--spring); }
.send:hover:not(:disabled) { background: rgba(255, 255, 255, 0.16); }
.send.ready { background: var(--accent); }
.send.ready:hover { background: var(--accent-hover); box-shadow: var(--glow-accent); transform: translateY(-1px); }

/* ── Tile headers ── */
.tile-head { display: flex; align-items: center; justify-content: space-between; }
.tile-title { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); text-decoration: none; transition: color var(--motion-fast); }
.tile-title :global(svg) { color: var(--text-muted); transition: color var(--motion-fast); }
a.tile-title:hover { color: var(--text-primary); }
a.tile-title:hover :global(svg) { color: var(--accent-text); }
.tile-title :global(.head-arrow) { opacity: 0; transform: translate(-3px, 3px); transition: opacity var(--spring), transform var(--spring); }
a.tile-title:hover :global(.head-arrow) { opacity: 1; transform: translate(0, 0); }

/* ── Operations tile ── */
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 6px rgba(74, 222, 128, 0.6); flex: none; }
.status-dot.offline { background: #f87171; box-shadow: 0 0 6px rgba(248, 113, 113, 0.5); }

.ops-stats {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: var(--sp-2);
}

.ops-stat {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
	padding: var(--sp-2) var(--sp-1);
	border-radius: var(--radius-sm);
	background: rgba(255, 255, 255, 0.03);
}

.ops-stat.has-blocked .stat-value { color: #fca5a5; }

.stat-value {
	font-size: 20px;
	font-weight: 700;
	color: var(--text-primary);
	line-height: 1;
}

.stat-label {
	font-size: 10px;
	font-weight: 600;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--text-muted);
}

.quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); margin-top: auto; }
.qa-btn { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: var(--radius-md, 12px); background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-hair, rgba(255,255,255,0.06)); color: var(--text-secondary); text-decoration: none; font-size: 13px; font-weight: 500; transition: background var(--motion-fast), color var(--motion-fast), border-color var(--motion-fast); }
.qa-btn:hover { background: rgba(255, 255, 255, 0.08); color: var(--text-primary); border-color: rgba(255, 255, 255, 0.12); }

/* ── Execution summary tile ── */
.exec-bars { display: flex; flex-direction: column; gap: 8px; }
.exec-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: var(--radius-sm); background: rgba(255, 255, 255, 0.03); }
.exec-label { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--text-secondary); }
.exec-count { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.exec-count.accent { color: var(--accent-text); }
.exec-count.danger { color: #fca5a5; }
.exec-count.success { color: #6ee7b7; }

/* ── List tiles ── */
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.list li + li { border-top: 1px solid var(--border-hair); }
.list a { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); padding: 9px 4px; color: var(--text-secondary); text-decoration: none; transition: color var(--motion-fast), padding-left var(--motion-fast); }
.list a:hover { color: #ffffff; padding-left: 8px; }
.row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; }
.row-meta { flex: none; font-size: 11.5px; color: var(--text-muted); }
.empty { margin: auto 0; padding: var(--sp-4) 0; font-size: 13px; color: var(--text-muted); }

/* ── Responsive ── */
@media (max-width: 900px) {
	.bento-grid {
		grid-template-columns: repeat(2, 1fr);
		grid-template-areas:
			"composer  composer"
			"ops       plans"
			"exec      recents"
			"projects  projects";
	}
}

@media (max-width: 600px) {
	.bento-grid {
		grid-template-columns: 1fr;
		grid-template-areas:
			"composer"
			"ops"
			"plans"
			"exec"
			"recents"
			"projects";
	}
	.composer-tile { min-height: 0; }
	.ops-stats { grid-template-columns: repeat(2, 1fr); }
}
</style>
