<script lang="ts">
import { goto } from '$app/navigation';
import { ArrowUp, Paperclip, Globe } from '@lucide/svelte';
import { session } from '$lib/features/streaming/session.svelte';

let { data } = $props();

const recentChats = $derived(data.chats.slice(0, 6));

let mode = $state<'chat' | 'web'>('chat');
let value = $state('');
let textarea = $state<HTMLTextAreaElement | null>(null);

const canSend = $derived(value.trim().length > 0);

async function startNewChat(): Promise<void> {
	const id = await session.createChat();
	if (id) goto(`/chats/${id}`);
}

async function submit(): Promise<void> {
	const content = value.trim();
	if (!content) return;
	const id = await session.createChat();
	if (!id) return;
	session.draft = content;
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
</script>

<svelte:head>
	<title>Bryon</title>
</svelte:head>

<div class="canvas">
	<section class="hero">
		<header class="brand">
			<h1>Bryon</h1>
			<p class="status">Local · {data.settings.llm.model}</p>
		</header>

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
					disabled={!canSend}
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
	</section>

	<section class="quiet" data-testid="home-runtime-panel">
		<dl class="meta">
			<div><dt>Model</dt><dd>{data.settings.llm.model}</dd></div>
			<div><dt>Ollama</dt><dd>{data.settings.llm.base_url}</dd></div>
			<div><dt>Data</dt><dd>{data.settings.app.data_dir}</dd></div>
		</dl>
	</section>

	{#if recentChats.length}
		<section class="quiet" data-testid="home-recent-panel">
			<p class="quiet-label">Recent</p>
			<ul class="recent">
				{#each recentChats as chat (chat.id)}
					<li>
						<a href={`/chats/${chat.id}`}>
							<span class="recent-title">{chat.title}</span>
							<span class="recent-time">{formatDate(chat.updatedAt)}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<section class="quiet" data-testid="home-recent-panel" aria-hidden="true"></section>
	{/if}
</div>

<style>
.canvas {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 100%;
	gap: var(--sp-8);
	padding: var(--sp-6) var(--sp-4);
}

.hero {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--sp-5);
	width: min(640px, 100%);
}

.brand {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--sp-1);
	text-align: center;
}

.brand h1 {
	margin: 0;
	font-size: clamp(34px, 5vw, 44px);
	font-weight: 600;
	letter-spacing: -0.02em;
	color: #ffffff;
	line-height: 1;
}

.brand .status {
	margin: 0;
	font-size: 12.5px;
	color: var(--text-muted);
	letter-spacing: 0.01em;
}

/* ── Segmented pill ── */
.mode-track {
	position: relative;
	display: inline-flex;
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
	transition: transform var(--motion-luxury);
	z-index: 0;
}

.mode-tab {
	position: relative;
	z-index: 1;
	min-width: 88px;
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
	transition: color var(--motion-luxury);
}

.mode-tab.active {
	color: #ffffff;
}

.mode-tab:focus-visible {
	outline: none;
	box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18);
}

/* ── Composer ── */
.composer {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
	padding: 12px 14px 10px;
	background: var(--surface-tint);
	border: 1px solid var(--border-hair);
	border-radius: var(--radius-input);
	transition:
		border-color var(--motion-luxury),
		background-color var(--motion-luxury);
}

.composer:focus-within {
	border-color: rgba(255, 255, 255, 0.14);
	background: rgba(255, 255, 255, 0.045);
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
		color var(--motion-luxury),
		background-color var(--motion-luxury);
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
	background: rgba(255, 255, 255, 0.06);
	color: #ffffff;
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
		background-color var(--motion-luxury),
		opacity var(--motion-luxury);
}

.send:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.16);
}

.send:disabled {
	opacity: 0.45;
	cursor: default;
}

/* ── Quiet meta + recents ── */
.quiet {
	width: min(640px, 100%);
}

.quiet-label {
	margin: 0 0 var(--sp-2);
	font-size: 11px;
	font-weight: 500;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--text-muted);
}

.meta {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: var(--sp-3);
	margin: 0;
}

.meta div {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.meta dt {
	font-size: 11px;
	font-weight: 500;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: var(--text-muted);
}

.meta dd {
	margin: 0;
	font-size: 12.5px;
	color: var(--text-secondary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.recent {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
}

.recent li + li {
	border-top: 1px solid var(--border-hair);
}

.recent a {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-3);
	padding: 10px 2px;
	color: var(--text-secondary);
	text-decoration: none;
	transition: color var(--motion-luxury);
}

.recent a:hover {
	color: #ffffff;
}

.recent-title {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 13.5px;
}

.recent-time {
	flex: none;
	font-size: 11.5px;
	color: var(--text-muted);
}

@media (max-width: 560px) {
	.meta {
		grid-template-columns: 1fr;
	}
}
</style>
