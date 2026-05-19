<script lang="ts">
import { goto } from '$app/navigation';
import { ArrowRight, MessageSquarePlus, Settings2 } from '@lucide/svelte';
import { Button } from '$lib/ui/button';
import { session } from '$lib/features/streaming/session.svelte';

let { data } = $props();

const recentChats = $derived(data.chats.slice(0, 8));

const suggestedPrompts: Array<{ title: string; prompt: string }> = [
	{
		title: 'Explain',
		prompt: 'Explain SQLite WAL mode in plain language with one example.',
	},
	{
		title: 'Draft',
		prompt: 'Draft a concise release note for a desktop app update.',
	},
	{
		title: 'Debug',
		prompt: 'Give me a checklist for debugging a silent Node.js process exit.',
	},
	{
		title: 'Plan',
		prompt: 'Plan a one-week implementation roadmap for a local AI chat app.',
	},
];

async function startNewChat(): Promise<void> {
	const id = await session.createChat();
	if (id) goto(`/chats/${id}`);
}

async function startFromPrompt(prompt: string): Promise<void> {
	const id = await session.createChat();
	if (!id) return;
	session.draft = prompt;
	goto(`/chats/${id}`);
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
	<title>Bryon — Start</title>
</svelte:head>

<div class="home-shell">
	<section class="panel" data-testid="home-prompts-panel">
		<div class="panel-header">
			<div>
				<p class="kicker">Start</p>
				<h1>Open a conversation</h1>
				<p class="lead">Everything stays local on this machine.</p>
			</div>
		</div>

		<div class="actions">
			<Button size="lg" onclick={startNewChat} data-testid="start-new-chat">
				<MessageSquarePlus size={16} />
				<span>New chat</span>
			</Button>
			<Button href="/settings" size="lg" variant="outline">
				<Settings2 size={16} />
				<span>Settings</span>
			</Button>
		</div>
	</section>

	<section class="panel" data-testid="home-runtime-panel">
		<div class="panel-header">
			<div>
				<p class="kicker">Prompts</p>
				<h2>Quick starts</h2>
			</div>
		</div>
		<div class="prompt-grid">
			{#each suggestedPrompts as item (item.title)}
				<button
					type="button"
					class="prompt-btn"
					onclick={() => startFromPrompt(item.prompt)}
					data-testid="suggested-prompt"
				>
					<strong>{item.title}</strong>
					<span>{item.prompt}</span>
				</button>
			{/each}
		</div>
	</section>

	<section class="panel" data-testid="home-recent-panel">
		<div class="panel-header">
			<div>
				<p class="kicker">Runtime</p>
				<h2>Environment</h2>
			</div>
		</div>
		<div class="meta-grid">
			<div class="meta-row">
				<span>Model</span>
				<code>{data.settings.llm.model}</code>
			</div>
			<div class="meta-row">
				<span>Ollama URL</span>
				<code>{data.settings.llm.base_url}</code>
			</div>
			<div class="meta-row">
				<span>Data dir</span>
				<code>{data.settings.app.data_dir}</code>
			</div>
		</div>
	</section>

	<section class="panel">
		<div class="panel-header">
			<div>
				<p class="kicker">Chats</p>
				<h2>{recentChats.length ? 'Recent conversations' : 'No conversations yet'}</h2>
			</div>
		</div>

		{#if recentChats.length}
			<div class="recent-list">
				{#each recentChats as chat (chat.id)}
					<a href={`/chats/${chat.id}`} class="recent-row">
						<div>
							<strong>{chat.title}</strong>
							<span>{chat.model ?? 'inherited'} · {formatDate(chat.updatedAt)}</span>
						</div>
						<ArrowRight size={16} aria-hidden="true" />
					</a>
				{/each}
			</div>
		{:else}
			<p class="empty">No saved chats yet.</p>
		{/if}
	</section>
</div>

<style>
.home-shell {
	display: grid;
	width: min(900px, 100%);
	gap: var(--sp-4);
}

.panel {
	border: 1px solid var(--border-default);
	border-radius: var(--radius-lg);
	background: var(--bg-surface);
	padding: var(--sp-4);
}

.panel-header {
	margin-bottom: var(--sp-3);
}

.kicker {
	margin: 0;
	font-size: 11px;
	font-weight: 700;
	color: var(--text-muted);
	text-transform: uppercase;
	letter-spacing: 0.07em;
}

h1,
h2,
p {
	margin: 0;
}

h1 {
	margin-top: 4px;
	font-size: clamp(24px, 3vw, 30px);
	line-height: 1.2;
}

h2 {
	margin-top: 4px;
	font-size: 18px;
	line-height: 1.25;
}

.lead {
	margin-top: var(--sp-2);
	font-size: 14px;
	color: var(--text-secondary);
}

.actions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--sp-3);
}

.prompt-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--sp-2);
}

.prompt-btn {
	display: grid;
	gap: 4px;
	padding: var(--sp-3);
	border: 1px solid var(--border-default);
	border-radius: var(--radius-md);
	background: transparent;
	color: var(--text-primary);
	text-align: left;
	cursor: pointer;
	transition:
		background var(--motion-fast),
		border-color var(--motion-fast);
}

.prompt-btn strong {
	font-size: 13px;
}

.prompt-btn span {
	font-size: 12.5px;
	line-height: 1.4;
	color: var(--text-secondary);
}

.prompt-btn:hover {
	background: var(--bg-surface-hover);
	border-color: var(--border-strong);
}

.meta-grid {
	display: grid;
	gap: var(--sp-2);
}

.meta-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-3);
	font-size: 13px;
	color: var(--text-secondary);
}

.meta-row code {
	font-size: 12px;
	border: 1px solid var(--border-subtle);
	border-radius: 6px;
	padding: 2px 6px;
	color: var(--text-secondary);
	background: var(--bg-input);
	max-width: 70%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.recent-list {
	display: grid;
	gap: var(--sp-2);
}

.recent-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-3);
	padding: var(--sp-3);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
	text-decoration: none;
	color: var(--text-primary);
	transition:
		background var(--motion-fast),
		border-color var(--motion-fast);
}

.recent-row:hover {
	background: var(--bg-surface-hover);
	border-color: var(--border-default);
}

.recent-row div {
	display: grid;
	gap: 2px;
	min-width: 0;
}

.recent-row strong {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.recent-row span {
	font-size: 12px;
	color: var(--text-muted);
}

.empty {
	font-size: 13px;
	color: var(--text-muted);
}

@media (max-width: 720px) {
	.prompt-grid {
		grid-template-columns: 1fr;
	}
}
</style>
