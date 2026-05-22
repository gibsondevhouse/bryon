<script lang="ts">
import { goto } from '$app/navigation';
import { ArrowUp, Paperclip, Globe, ArrowUpRight, MessageSquare, Folder, ListTodo, Activity } from '@lucide/svelte';
import { session } from '$lib/features/streaming/session.svelte';
import type { PlanStatus } from '$lib/shared/types';
import type { Action } from 'svelte/action';

let { data } = $props();

const recentChats = $derived(data.chats.slice(0, 5));
const recentPlans = $derived((data.plans ?? []).filter((p) => !p.archivedAt).slice(0, 4));
const recentProjects = $derived((data.projects ?? []).filter((p) => !p.archivedAt).slice(0, 4));
const online = $derived(data.ollamaReachable ?? session.ollamaReachable);

let mode = $state<'chat' | 'web'>('chat');
let value = $state('');
let textarea = $state<HTMLTextAreaElement | null>(null);

const canSend = $derived(value.trim().length > 0);

async function startNewChat(): Promise<void> {
	session.draftWebSearch = mode === 'web';
	const id = await session.createChat();
	if (id) goto(`/chats/${id}`);
}

async function submit(): Promise<void> {
	const content = value.trim();
	if (!content) return;
	const id = await session.createChat();
	if (!id) return;
	session.draft = content;
	session.draftWebSearch = mode === 'web';
	goto(`/chats/${id}`);
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

function formatDate(value: number): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(new Date(value));
}

function statusLabel(status: PlanStatus): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

// Cursor-tracking "light-leak" — a sensor detecting your cursor.
const spotlight: Action<HTMLElement> = (node) => {
	function move(e: MouseEvent): void {
		const r = node.getBoundingClientRect();
		node.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
		node.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
	}
	node.addEventListener('mousemove', move);
	return {
		destroy() {
			node.removeEventListener('mousemove', move);
		},
	};
};
</script>

<svelte:head>
	<title>Bryon</title>
</svelte:head>

<div class="canvas">
	<div class="mesh" aria-hidden="true"></div>

	<div class="bento-grid">
		<!-- Composer — the anchor -->
		<section class="bento composer-tile glass" style:--idx={0} use:spotlight>
			<header class="tile-brand">
				<h1>Bryon</h1>
				<p class="sub">Local · {data.settings.llm.model}</p>
			</header>

			<div class="composer-stack">
				<div class="mode-track" role="tablist" aria-label="Mode" style:--idx={mode === 'web' ? 1 : 0}>
					<span class="mode-indicator" aria-hidden="true"></span>
					<button
						type="button"
						role="tab"
						aria-selected={mode === 'chat'}
						class="mode-tab"
						class:active={mode === 'chat'}
						onclick={() => (mode = 'chat')}
					>
						Chat
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={mode === 'web'}
						class="mode-tab"
						class:active={mode === 'web'}
						onclick={() => (mode = 'web')}
					>
						Web
					</button>
				</div>

				<form class="composer" onsubmit={(e) => { e.preventDefault(); void submit(); }}>
					<textarea
						bind:this={textarea}
						bind:value
						oninput={autosize}
						onkeydown={onKeydown}
						placeholder="Ask anything"
						rows="1"
						aria-label="Message"
					></textarea>

					<div class="composer-row">
						<div class="sub-pills">
							<button type="button" class="sub-pill" aria-label="Attach" disabled>
								<Paperclip size={15} aria-hidden="true" />
								<span>Attach</span>
							</button>
							<button
								type="button"
								class="sub-pill"
								class:on={mode === 'web'}
								aria-pressed={mode === 'web'}
								onclick={() => (mode = mode === 'web' ? 'chat' : 'web')}
							>
								<Globe size={15} aria-hidden="true" />
								<span>Web</span>
							</button>
						</div>

						<button
							type="submit"
							class="send"
							class:ready={canSend}
							aria-label="Send"
							data-testid="start-new-chat"
							onclick={(e) => {
								if (!canSend) {
									e.preventDefault();
									void startNewChat();
								}
							}}
						>
							<ArrowUp size={16} aria-hidden="true" />
						</button>
					</div>
				</form>
			</div>
		</section>

		<!-- Runtime / status -->
		<section class="bento runtime-tile glass" style:--idx={1} use:spotlight data-testid="home-runtime-panel">
			<header class="tile-head">
				<span class="tile-title"><Activity size={14} aria-hidden="true" /> Runtime</span>
			</header>

			<div class="status-line">
				<span class="heartbeat" class:offline={!online}></span>
				<span>{online ? 'System online' : 'Ollama offline'}</span>
			</div>

			<dl class="runtime-meta">
				<div><dt>Model</dt><dd>{data.settings.llm.model}</dd></div>
				<div><dt>Ollama</dt><dd>{data.settings.llm.base_url}</dd></div>
				<div><dt>Data</dt><dd>{data.settings.app.data_dir}</dd></div>
			</dl>
		</section>

		<!-- Recent conversations -->
		<section class="bento list-tile recents-tile glass" style:--idx={2} use:spotlight data-testid="home-recent-panel">
			<header class="tile-head">
				<span class="tile-title"><MessageSquare size={14} aria-hidden="true" /> Recent</span>
			</header>

			{#if recentChats.length}
				<ul class="list">
					{#each recentChats as chat (chat.id)}
						<li>
							<a href={`/chats/${chat.id}`}>
								<span class="row-name">{chat.title}</span>
								<span class="row-meta">{formatDate(chat.updatedAt)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">No conversations yet.</p>
			{/if}
		</section>

		<!-- Planning -->
		<section class="bento list-tile plans-tile glass" style:--idx={3} use:spotlight>
			<header class="tile-head">
				<a class="tile-title link" href="/planning">
					<ListTodo size={14} aria-hidden="true" /> Planning
					<ArrowUpRight size={13} class="head-arrow" aria-hidden="true" />
				</a>
			</header>

			{#if recentPlans.length}
				<ul class="list">
					{#each recentPlans as plan (plan.id)}
						<li>
							<a href={`/planning/${plan.id}`}>
								<span class="row-name">{plan.name}</span>
								<span class="chip {plan.status}">{statusLabel(plan.status)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">No plans yet.</p>
			{/if}
		</section>

		<!-- Projects -->
		<section class="bento list-tile projects-tile glass" style:--idx={4} use:spotlight>
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
							<a href={`/projects/${project.id}`}>
								<span class="row-name">{project.name}</span>
								<span class="chip {project.status}">{statusLabel(project.status)}</span>
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

/* Imperceptible animated mesh backdrop */
.mesh {
	position: absolute;
	inset: -8%;
	z-index: 0;
	pointer-events: none;
	background:
		radial-gradient(40% 50% at 18% 22%, var(--mesh-1), transparent 60%),
		radial-gradient(38% 46% at 82% 28%, var(--mesh-2), transparent 60%),
		radial-gradient(48% 56% at 50% 90%, var(--mesh-3), transparent 62%);
	filter: blur(40px);
	animation: bryon-mesh-drift 34s ease-in-out infinite;
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
		"composer composer composer composer runtime  runtime"
		"composer composer composer composer recents  recents"
		"plans    plans    plans    projects projects projects";
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
	transition:
		transform var(--spring),
		box-shadow var(--spring),
		border-color var(--spring);
}

/* Light-leak that follows the cursor */
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

.bento > * {
	position: relative;
	z-index: 1;
}

.bento:hover {
	transform: translateY(-3px);
	border-color: var(--glass-border-hover);
	box-shadow: var(--glow-accent), var(--glow-soft);
}

.bento:hover::before {
	opacity: 1;
}

.composer-tile  { grid-area: composer; justify-content: space-between; min-height: 280px; }
.runtime-tile   { grid-area: runtime; }
.recents-tile   { grid-area: recents; }
.plans-tile     { grid-area: plans; }
.projects-tile  { grid-area: projects; }

/* ── Composer tile ── */
.tile-brand {
	display: flex;
	flex-direction: column;
	gap: var(--sp-1);
}

.tile-brand h1 {
	margin: 0;
	font-size: clamp(30px, 4vw, 40px);
	font-weight: 600;
	letter-spacing: -0.03em;
	color: #ffffff;
	line-height: 1;
}

.tile-brand .sub {
	margin: 0;
	font-size: 12.5px;
	color: var(--text-muted);
	letter-spacing: 0.01em;
}

.composer-stack {
	display: flex;
	flex-direction: column;
	gap: var(--sp-3);
}

/* Segmented pill */
.mode-track {
	position: relative;
	display: inline-flex;
	align-self: flex-start;
	padding: 4px;
	background: var(--surface-tint);
	border: 1px solid var(--border-hair);
	border-radius: 999px;
	isolation: isolate;
}

.mode-indicator {
	position: absolute;
	top: 4px;
	bottom: 4px;
	left: 4px;
	width: calc(50% - 4px);
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.08);
	transform: translateX(calc(var(--idx, 0) * 100%));
	transition: transform var(--spring);
	z-index: 0;
}

.mode-tab {
	position: relative;
	z-index: 1;
	min-width: 84px;
	padding: 7px 18px;
	border: 0;
	background: transparent;
	color: var(--text-muted);
	font: inherit;
	font-size: 13px;
	font-weight: 500;
	letter-spacing: 0.01em;
	cursor: pointer;
	border-radius: 999px;
	transition: color var(--spring);
}

.mode-tab.active {
	color: #ffffff;
}

.mode-tab:focus-visible {
	outline: none;
	box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18);
}

.composer {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
	padding: 12px 14px 10px;
	background: var(--bg-input);
	border: 1px solid var(--border-hair);
	border-radius: var(--radius-input);
	transition:
		border-color var(--spring),
		box-shadow var(--spring),
		background-color var(--spring);
}

.composer:focus-within {
	border-color: var(--accent-soft);
	background: rgba(255, 255, 255, 0.04);
	box-shadow: var(--halo);
}

.composer textarea {
	width: 100%;
	max-height: 220px;
	min-height: 28px;
	resize: none;
	border: 0;
	background: transparent;
	color: #ffffff;
	font: inherit;
	font-size: 15px;
	line-height: 1.5;
	outline: none;
	padding: 4px 2px;
}

.composer textarea::placeholder {
	color: var(--text-placeholder);
}

.composer-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-2);
}

.sub-pills {
	display: inline-flex;
	gap: 4px;
}

.sub-pill {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 5px 10px;
	border: 0;
	background: transparent;
	color: var(--text-muted);
	font: inherit;
	font-size: 12.5px;
	border-radius: 999px;
	cursor: pointer;
	transition:
		color var(--motion-fast),
		background-color var(--motion-fast);
}

.sub-pill:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.04);
	color: var(--text-secondary);
}

.sub-pill:disabled {
	opacity: 0.45;
	cursor: not-allowed;
}

.sub-pill.on {
	background: var(--accent-soft);
	color: var(--accent-text);
}

.send {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 30px;
	height: 30px;
	border: 0;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.08);
	color: #ffffff;
	cursor: pointer;
	transition:
		background-color var(--spring),
		box-shadow var(--spring),
		transform var(--spring);
}

.send:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.16);
}

.send.ready {
	background: var(--accent);
}

.send.ready:hover {
	background: var(--accent-hover);
	box-shadow: var(--glow-accent);
	transform: translateY(-1px);
}

/* ── Tile headers ── */
.tile-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.tile-title {
	display: inline-flex;
	align-items: center;
	gap: 7px;
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--text-muted);
	text-decoration: none;
	transition: color var(--motion-fast);
}

.tile-title :global(svg) {
	color: var(--text-muted);
	transition: color var(--motion-fast);
}

a.tile-title:hover {
	color: var(--text-primary);
}

a.tile-title:hover :global(svg) {
	color: var(--accent-text);
}

.tile-title :global(.head-arrow) {
	opacity: 0;
	transform: translate(-3px, 3px);
	transition: opacity var(--spring), transform var(--spring);
}

a.tile-title:hover :global(.head-arrow) {
	opacity: 1;
	transform: translate(0, 0);
}

/* ── Runtime tile ── */
.status-line {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	font-size: 13px;
	color: var(--text-secondary);
}

.runtime-meta {
	display: flex;
	flex-direction: column;
	gap: var(--sp-3);
	margin: 0;
	margin-top: auto;
}

.runtime-meta div {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.runtime-meta dt {
	font-size: 10.5px;
	font-weight: 500;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: var(--text-muted);
}

.runtime-meta dd {
	margin: 0;
	font-size: 12.5px;
	color: var(--text-secondary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/* ── List tiles ── */
.list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
}

.list li + li {
	border-top: 1px solid var(--border-hair);
}

.list a {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-3);
	padding: 9px 4px;
	color: var(--text-secondary);
	text-decoration: none;
	transition: color var(--motion-fast), padding-left var(--motion-fast);
}

.list a:hover {
	color: #ffffff;
	padding-left: 8px;
}

.row-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 13.5px;
}

.row-meta {
	flex: none;
	font-size: 11.5px;
	color: var(--text-muted);
}

.empty {
	margin: auto 0;
	padding: var(--sp-4) 0;
	font-size: 13px;
	color: var(--text-muted);
}

/* ── Status chips ── */
.chip {
	flex: none;
	font-size: 10px;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	font-weight: 600;
	padding: 2px 8px;
	border-radius: 999px;
	color: var(--text-muted);
	background: rgba(255, 255, 255, 0.06);
}

.chip.definition {
	color: var(--accent-text);
	background: var(--accent-soft);
}

.chip.execution {
	color: #6ee7b7;
	background: rgba(52, 211, 153, 0.14);
}

.chip.maintenance {
	color: #fcd34d;
	background: rgba(251, 191, 36, 0.14);
}

/* ── Responsive ── */
@media (max-width: 900px) {
	.bento-grid {
		grid-template-columns: repeat(2, 1fr);
		grid-template-areas:
			"composer composer"
			"runtime  recents"
			"plans    projects";
	}
}

@media (max-width: 600px) {
	.bento-grid {
		grid-template-columns: 1fr;
		grid-template-areas:
			"composer"
			"runtime"
			"recents"
			"plans"
			"projects";
	}

	.composer-tile {
		min-height: 0;
	}
}
</style>
