<script lang="ts">
import { invalidateAll } from '$app/navigation';
import { untrack } from 'svelte';
import { CheckCircle2, FileWarning, GitCompare, RefreshCw, ShieldAlert } from '@lucide/svelte';

type Checkpoint = {
	id: string;
	description: string;
	path: string;
	createdAt: number;
};

type Finding = {
	id: string;
	severity: 'info' | 'warning' | 'error';
	code: string;
	message: string;
	path: string | null;
	createdAt: number;
};

type ChangedFile = {
	path: string;
	kind: string;
	status: 'missing' | 'changed' | 'current';
};

type RoutingLog = {
	id: string;
	taskType: string;
	tier: number;
	model: string;
	remote: boolean;
	privacyDecision: string;
	tokensIn: number | null;
	tokensOut: number | null;
	errorCode: string | null;
	createdAt: number;
};

let { data } = $props();

let checkpoints = $state<Checkpoint[]>(untrack(() => data.checkpoints));
let findings = $state<Finding[]>(untrack(() => data.findings));
let changedFiles = $state<ChangedFile[]>(untrack(() => data.changedFiles));
let routingLogs = $state<RoutingLog[]>(untrack(() => data.routingLogs));
let description = $state('Manual checkpoint');
let busy = $state(false);
let errorMessage = $state<string | null>(null);

const staleCount = $derived(changedFiles.filter((file) => file.status !== 'current').length);
const remoteCount = $derived(routingLogs.filter((log) => log.remote).length);

async function syncWorkspace(): Promise<void> {
	await postAction('/api/workspace-sync/sync', { description: description.trim() || 'Workspace sync' });
}

async function createCheckpoint(): Promise<void> {
	await postAction('/api/workspace-sync/checkpoints', {
		description: description.trim() || 'Manual checkpoint',
	});
}

async function runAudit(): Promise<void> {
	await postAction('/api/workspace-sync/audit', {});
}

async function postAction(url: string, body: Record<string, unknown>): Promise<void> {
	if (busy) return;
	busy = true;
	errorMessage = null;
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		if (!res.ok) throw new Error(await readApiError(res));
		await refreshData();
	} catch (error) {
		errorMessage = error instanceof Error ? error.message : String(error);
	} finally {
		busy = false;
	}
}

async function refreshData(): Promise<void> {
	await invalidateAll();
	const [checkpointRes, auditRes, routeRes] = await Promise.all([
		fetch('/api/workspace-sync/checkpoints?limit=20'),
		fetch('/api/workspace-sync/audit'),
		fetch('/api/workspace-sync/routing-logs?limit=50'),
	]);
	if (checkpointRes.ok) checkpoints = ((await checkpointRes.json()) as { checkpoints: Checkpoint[] }).checkpoints;
	if (auditRes.ok) {
		const auditBody = (await auditRes.json()) as {
			findings: Finding[];
			changedFiles: ChangedFile[];
		};
		findings = auditBody.findings;
		changedFiles = auditBody.changedFiles;
	}
	if (routeRes.ok) routingLogs = ((await routeRes.json()) as { logs: RoutingLog[] }).logs;
}

function shortPath(path: string | null): string {
	if (!path) return 'n/a';
	const parts = path.split(/[\\/]/);
	return parts.length > 4 ? `.../${parts.slice(-4).join('/')}` : path;
}

function formatDate(value: number): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(new Date(value));
}

async function readApiError(res: Response): Promise<string> {
	try {
		const body = await res.json();
		return body.error?.message ?? res.statusText;
	} catch {
		return res.statusText;
	}
}
</script>

<svelte:head>
	<title>Workspace Sync - Bryon</title>
</svelte:head>

<div class="sync-page">
	<header class="page-header">
		<div>
			<p class="eyebrow">.bryon workspace</p>
			<h1>Workspace Sync</h1>
			<p class="sub">{data.bryonRoot}</p>
		</div>
		<div class="actions">
			<input bind:value={description} aria-label="Checkpoint description" />
			<button type="button" onclick={createCheckpoint} disabled={busy}>Checkpoint</button>
			<button type="button" onclick={syncWorkspace} disabled={busy}>
				<RefreshCw size={15} /> Sync
			</button>
			<button type="button" class="ghost" onclick={runAudit} disabled={busy}>Audit</button>
		</div>
	</header>

	{#if errorMessage}
		<p class="error">{errorMessage}</p>
	{/if}

	<section class="summary">
		<div>
			<GitCompare size={18} />
			<strong>{staleCount}</strong>
			<span>changed files</span>
		</div>
		<div>
			<FileWarning size={18} />
			<strong>{findings.length}</strong>
			<span>active findings</span>
		</div>
		<div>
			<ShieldAlert size={18} />
			<strong>{remoteCount}</strong>
			<span>remote routes</span>
		</div>
	</section>

	<div class="grid">
		<section class="panel">
			<div class="panel-head">
				<h2>Changed Files</h2>
				<span>{changedFiles.length}</span>
			</div>
			<ul class="rows">
				{#each changedFiles as file}
					<li class:ok={file.status === 'current'}>
						<span>{file.kind}</span>
						<strong>{file.status}</strong>
						<code>{shortPath(file.path)}</code>
					</li>
				{:else}
					<li class="empty">No expected files yet.</li>
				{/each}
			</ul>
		</section>

		<section class="panel">
			<div class="panel-head">
				<h2>Audit Findings</h2>
				<span>{findings.length}</span>
			</div>
			<ul class="rows">
				{#each findings as finding (finding.id)}
					<li>
						<span>{finding.severity}</span>
						<strong>{finding.code}</strong>
						<code>{shortPath(finding.path)}</code>
						<p>{finding.message}</p>
					</li>
				{:else}
					<li class="empty">
						<CheckCircle2 size={15} /> No active findings.
					</li>
				{/each}
			</ul>
		</section>

		<section class="panel">
			<div class="panel-head">
				<h2>Checkpoints</h2>
				<span>{checkpoints.length}</span>
			</div>
			<ul class="rows">
				{#each checkpoints as checkpoint (checkpoint.id)}
					<li>
						<strong>{checkpoint.description}</strong>
						<span>{formatDate(checkpoint.createdAt)}</span>
						<code>{shortPath(checkpoint.path)}</code>
					</li>
				{:else}
					<li class="empty">No checkpoints yet.</li>
				{/each}
			</ul>
		</section>

		<section class="panel">
			<div class="panel-head">
				<h2>Routing Logs</h2>
				<span>{routingLogs.length}</span>
			</div>
			<ul class="rows">
				{#each routingLogs as log (log.id)}
					<li>
						<strong>{log.taskType}</strong>
						<span>Tier {log.tier} - {log.remote ? 'remote' : 'local'}</span>
						<code>{log.model}</code>
						<p>{log.privacyDecision}{log.errorCode ? ` - ${log.errorCode}` : ''}</p>
					</li>
				{:else}
					<li class="empty">No routing logs yet.</li>
				{/each}
			</ul>
		</section>
	</div>
</div>

<style>
.sync-page {
	display: flex;
	flex-direction: column;
	gap: var(--sp-5);
	width: 100%;
	max-width: 1240px;
	margin: 0 auto;
	padding: var(--sp-6);
}

.page-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: var(--sp-5);
	padding-bottom: var(--sp-5);
	border-bottom: 1px solid var(--border-subtle);
}

h1,
h2,
p {
	margin: 0;
}

h1 {
	font-size: 26px;
}

h2 {
	font-size: 15px;
}

.eyebrow {
	margin-bottom: 3px;
	color: var(--accent-text);
	font-size: 12px;
	font-weight: 700;
	text-transform: uppercase;
}

.sub,
.rows span,
.rows p,
.empty {
	color: var(--text-muted);
	font-size: 12px;
}

.actions {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
}

input {
	min-height: 36px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	color: var(--text-primary);
	padding: 7px 10px;
	font: inherit;
}

button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	min-height: 36px;
	border: 0;
	border-radius: var(--radius-sm);
	background: var(--accent);
	color: var(--primary-foreground);
	padding: 0 12px;
	font: inherit;
	font-weight: 700;
	cursor: pointer;
}

button:disabled {
	opacity: 0.55;
	cursor: not-allowed;
}

.ghost {
	border: 1px solid var(--border-subtle);
	background: var(--bg-surface);
	color: var(--text-secondary);
}

.summary {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: var(--sp-3);
}

.summary div {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	min-height: 54px;
	padding: 0 var(--sp-4);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
	background: var(--bg-surface);
}

.summary strong {
	font-size: 20px;
}

.summary span {
	color: var(--text-muted);
	font-size: 13px;
}

.grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--sp-4);
}

.panel {
	min-height: 320px;
	padding: var(--sp-4);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
	background: var(--bg-surface);
}

.panel-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: var(--sp-3);
}

.rows {
	display: grid;
	gap: var(--sp-2);
	margin: 0;
	padding: 0;
	list-style: none;
}

.rows li {
	display: grid;
	gap: 4px;
	padding: var(--sp-3);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
}

.rows li.ok {
	opacity: 0.7;
}

code {
	overflow: hidden;
	color: var(--text-secondary);
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.error {
	color: var(--red, #f87171);
}

@media (max-width: 900px) {
	.page-header,
	.actions {
		flex-direction: column;
		align-items: stretch;
	}

	.summary,
	.grid {
		grid-template-columns: 1fr;
	}
}
</style>
