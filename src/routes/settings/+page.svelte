<script lang="ts">
import { untrack } from 'svelte';
import { ArrowLeft, Save, CheckCircle2, XCircle, Globe, Brain, Eye } from '@lucide/svelte';
import { Button } from '$lib/ui/button';
import { Input } from '$lib/ui/input';

let { data } = $props();

const initial = untrack(() => data.settings);
let model = $state(initial.llm.model);
let visionModel = $state(initial.llm.vision_model);
let temperature = $state(initial.llm.params.temperature);
let topP = $state(initial.llm.params.top_p);
let topK = $state(initial.llm.params.top_k);
let numCtx = $state(initial.llm.params.num_ctx);
let numPredict = $state(initial.llm.params.num_predict);
let repeatPenalty = $state(initial.llm.params.repeat_penalty);
let webEnabled = $state(initial.web_search.enabled);
let searxngUrl = $state(initial.web_search.searxng_url);
let webMaxResults = $state(initial.web_search.max_results);
let memoryEnabled = $state(initial.memory.enabled);
let remember = $state(initial.memory.remember);
let neverSuggest = $state(initial.memory.never_suggest);
let saving = $state(false);
let saved = $state(false);
let saveError = $state<string | null>(null);

type ConnectionState =
	| { kind: 'idle' }
	| { kind: 'testing' }
	| { kind: 'ok'; missing: string[] }
	| { kind: 'fail'; message: string };
let connection = $state<ConnectionState>({ kind: 'idle' });

async function saveSettings(): Promise<void> {
	saving = true;
	saved = false;
	saveError = null;
	try {
		const response = await fetch('/api/settings', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				llm: {
					model,
					vision_model: visionModel,
					params: {
						temperature: Number(temperature),
						top_p: Number(topP),
						top_k: Number(topK),
						repeat_penalty: Number(repeatPenalty),
						num_ctx: Number(numCtx),
						num_predict: Number(numPredict),
					},
				},
				web_search: {
					enabled: webEnabled,
					searxng_url: searxngUrl.trim(),
					max_results: Number(webMaxResults),
				},
				memory: {
					enabled: memoryEnabled,
					remember,
					never_suggest: neverSuggest,
				},
			}),
		});
		if (!response.ok) {
			const body = await response.json().catch(() => null);
			throw new Error(body?.error?.message ?? `Save failed (HTTP ${response.status}).`);
		}
		saved = true;
		setTimeout(() => {
			saved = false;
		}, 2500);
	} catch (error) {
		saveError = (error as Error).message || 'Save failed.';
	} finally {
		saving = false;
	}
}

async function testConnection(): Promise<void> {
	connection = { kind: 'testing' };
	try {
		const response = await fetch('/api/health');
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const body = (await response.json()) as {
			ollama?: boolean;
			models?: { missing?: Array<{ model: string; pullCommand: string }> };
		};
		if (!body.ollama) {
			connection = { kind: 'fail', message: 'Ollama is not reachable. Start `ollama serve`.' };
			return;
		}
		const missing = body.models?.missing?.map((entry) => entry.pullCommand) ?? [];
		connection = { kind: 'ok', missing };
	} catch (error) {
		connection = { kind: 'fail', message: (error as Error).message || 'Connection check failed.' };
	}
}
</script>

<svelte:head>
	<title>Settings — Bryon</title>
</svelte:head>

<div class="settings-page">
	<header class="settings-header">
		<a href="/" class="back-link"><ArrowLeft size={16} /> Back</a>
		<div>
			<p class="eyebrow">Bryon v1</p>
			<h1>Rich chat settings</h1>
			<p class="sub">Configure chat, photo vision, explicit web lookup, and manual memory.</p>
		</div>
	</header>

	<section class="card">
		<div class="card-title"><Eye size={18} /> Models</div>
		<label>
			<span>Chat model</span>
			<Input id="model" bind:value={model} placeholder="gemma3:4b" />
		</label>
		<label>
			<span>Vision model for photo uploads</span>
			<Input id="vision-model" bind:value={visionModel} placeholder="gemma4:e4b" />
		</label>
		<div class="grid">
			<label><span>Temperature</span><Input type="number" step="0.1" min="0" max="2" bind:value={temperature} /></label>
			<label><span>Top P</span><Input type="number" step="0.05" min="0" max="1" bind:value={topP} /></label>
			<label><span>Top K</span><Input type="number" min="1" bind:value={topK} /></label>
			<label><span>Context</span><Input type="number" min="1" bind:value={numCtx} /></label>
			<label><span>Max output</span><Input type="number" min="1" bind:value={numPredict} /></label>
			<label><span>Repeat penalty</span><Input type="number" step="0.05" min="0" bind:value={repeatPenalty} /></label>
		</div>
		<Button variant="outline" onclick={testConnection} disabled={connection.kind === 'testing'}>
			{connection.kind === 'testing' ? 'Checking...' : 'Check Ollama models'}
		</Button>
		{#if connection.kind === 'ok'}
			<div class="notice ok"><CheckCircle2 size={15} /> {connection.missing.length === 0 ? 'Chat and vision models are installed.' : `Missing: ${connection.missing.join(', ')}`}</div>
		{:else if connection.kind === 'fail'}
			<div class="notice error"><XCircle size={15} /> {connection.message}</div>
		{/if}
	</section>

	<section class="card">
		<div class="card-title"><Globe size={18} /> Web lookup</div>
		<label class="check-row">
			<input type="checkbox" bind:checked={webEnabled} />
			<span>Allow explicit web lookup from the composer</span>
		</label>
		<label>
			<span>SearXNG URL (optional)</span>
			<Input bind:value={searxngUrl} placeholder="https://search.example.com" />
		</label>
		<p class="hint">When no SearXNG URL is configured, Bryon uses DuckDuckGo Instant Answers as a free limited fallback.</p>
		<label class="short-field">
			<span>Max results</span>
			<Input type="number" min="1" max="10" bind:value={webMaxResults} />
		</label>
	</section>

	<section class="card">
		<div class="card-title"><Brain size={18} /> Manual memory</div>
		<label class="check-row">
			<input type="checkbox" bind:checked={memoryEnabled} />
			<span>Inject these memory rules into every chat</span>
		</label>
		<label>
			<span>Remember</span>
			<textarea bind:value={remember} placeholder="Durable preferences, facts, and standing instructions Bryon should remember."></textarea>
		</label>
		<label>
			<span>Never suggest</span>
			<textarea bind:value={neverSuggest} placeholder="Tools, products, workflows, or advice Bryon should avoid unless explicitly asked."></textarea>
		</label>
	</section>

	<div class="actions">
		<Button onclick={saveSettings} disabled={saving}>
			<Save size={16} /> {saving ? 'Saving...' : 'Save settings'}
		</Button>
		{#if saved}<span class="saved"><CheckCircle2 size={15} /> Saved</span>{/if}
		{#if saveError}<span class="save-error"><XCircle size={15} /> {saveError}</span>{/if}
	</div>
</div>

<style>
.settings-page {
	max-width: 920px;
	width: 100%;
	margin: 0 auto;
	padding: var(--sp-6);
}

.settings-header {
	display: flex;
	flex-direction: column;
	gap: var(--sp-4);
	margin-bottom: var(--sp-6);
}

.back-link {
	display: inline-flex;
	align-items: center;
	gap: var(--sp-2);
	color: var(--text-muted);
	font-size: 13px;
	text-decoration: none;
}

.eyebrow {
	margin: 0 0 var(--sp-1);
	color: var(--accent-text);
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.08em;
	text-transform: uppercase;
}

h1 {
	margin: 0;
	font-size: 30px;
	letter-spacing: -0.03em;
}

.sub {
	margin: var(--sp-2) 0 0;
	color: var(--text-secondary);
}

.card {
	display: flex;
	flex-direction: column;
	gap: var(--sp-4);
	margin-bottom: var(--sp-4);
	padding: var(--sp-5);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-lg);
	background: var(--bg-surface);
}

.card-title {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	font-weight: 700;
	color: var(--text-primary);
}

label {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
	font-size: 13px;
	font-weight: 600;
	color: var(--text-secondary);
}

.grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: var(--sp-3);
}

.check-row {
	flex-direction: row;
	align-items: center;
	font-weight: 500;
}

.short-field {
	max-width: 180px;
}

textarea {
	min-height: 120px;
	resize: vertical;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	padding: var(--sp-3);
	font: inherit;
	line-height: 1.5;
	color: var(--text-primary);
}

.hint {
	margin: 0;
	color: var(--text-muted);
	font-size: 13px;
}

.notice,
.saved,
.save-error {
	display: inline-flex;
	align-items: center;
	gap: var(--sp-2);
	font-size: 13px;
}

.notice.ok,
.saved { color: var(--green); }
.notice.error,
.save-error { color: var(--red); }

.actions {
	display: flex;
	align-items: center;
	gap: var(--sp-3);
	padding: var(--sp-2) 0 var(--sp-8);
}

@media (max-width: 760px) {
	.settings-page { padding: var(--sp-4); }
	.grid { grid-template-columns: 1fr; }
}
</style>
