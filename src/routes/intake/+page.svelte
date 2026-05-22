<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { FolderSearch, X, RefreshCw, Check, AlertCircle, Loader, FolderOpen } from '@lucide/svelte';
	import type { IntakeScan, IntakeScanFileKind, Project } from '$lib/shared/types';

	let { data } = $props();

	// ── State ─────────────────────────────────────────────────────────────────
	let scans = $state<IntakeScan[]>(untrack(() => data.scans));
	let folderPath = $state('');
	let submitting = $state(false);
	let inputError = $state<string | null>(null);

	// ── Polling ───────────────────────────────────────────────────────────────
	const POLL_MS = 1500;
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	const hasActive = $derived(scans.some((s) => s.status === 'queued' || s.status === 'running'));

	$effect(() => {
		if (hasActive) {
			startPolling();
		} else {
			stopPolling();
		}
	});

	onDestroy(() => stopPolling());

	function startPolling(): void {
		if (pollTimer) return;
		pollTimer = setInterval(() => void pollScans(), POLL_MS);
	}

	function stopPolling(): void {
		if (!pollTimer) return;
		clearInterval(pollTimer);
		pollTimer = null;
	}

	async function pollScans(): Promise<void> {
		try {
			const res = await fetch('/api/intake/scans?includeCompleted=true');
			if (res.ok) {
				const body = await res.json();
				scans = body.scans as IntakeScan[];
			}
		} catch {
			// silent — will retry next interval
		}
	}

	// ── Submit new scan ───────────────────────────────────────────────────────
	async function startScan(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		const path = folderPath.trim();
		if (!path || submitting) return;

		submitting  = true;
		inputError  = null;

		try {
			const res = await fetch('/api/intake/scans', {
				method:  'POST',
				headers: { 'Content-Type': 'application/json' },
				body:    JSON.stringify({ folderPath: path }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
				inputError = body.error?.message ?? `Server error (${res.status})`;
				return;
			}

			const body = await res.json() as { scan: IntakeScan };
			scans = [body.scan, ...scans];
			folderPath = '';
		} catch (err) {
			inputError = err instanceof Error ? err.message : 'Network error';
		} finally {
			submitting = false;
		}
	}

	// ── Cancel ────────────────────────────────────────────────────────────────
	async function cancelScan(id: string): Promise<void> {
		try {
			const res = await fetch(`/api/intake/scans/${id}`, { method: 'DELETE' });
			if (res.ok) {
				const body = await res.json() as { scan: IntakeScan };
				scans = scans.map((s) => (s.id === id ? body.scan : s));
			}
		} catch {
			// silent
		}
	}

	// ── Hard delete ───────────────────────────────────────────────────────────
	async function removeScan(id: string): Promise<void> {
		try {
			const res = await fetch(`/api/intake/scans/${id}?delete=true`, { method: 'DELETE' });
			if (res.ok || res.status === 204) {
				scans = scans.filter((s) => s.id !== id);
			}
		} catch {
			// silent
		}
	}

	// ── Organise action → create project ─────────────────────────────────────
	let organising = $state<string | null>(null);

	async function organise(scan: IntakeScan): Promise<void> {
		if (organising) return;
		organising = scan.id;
		try {
			const parts = scan.folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
			const name = parts[parts.length - 1] ?? 'Imported folder';
			const res = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, description: `Imported from ${scan.folderPath}` }),
			});
			if (!res.ok) return;
			const { project } = await res.json() as { project: Project };
			await goto(`/projects/${project.id}`);
		} finally {
			organising = null;
		}
	}

	// ── Helpers ───────────────────────────────────────────────────────────────
	function phaseLabel(scan: IntakeScan): string {
		if (scan.status === 'cancelled') return 'Cancelled';
		if (scan.status === 'failed')    return 'Failed';
		if (scan.status === 'completed') return `Done — ${scan.filesFound} files`;
		if (scan.phase === 'enumerating') return `Enumerating… ${scan.filesFound} files`;
		if (scan.phase === 'classifying') return `Classifying ${scan.filesClassified}/${scan.filesFound}`;
		return 'Queued';
	}

	function progress(scan: IntakeScan): number {
		if (scan.status === 'completed') return 100;
		if (scan.status === 'cancelled' || scan.status === 'failed') return 0;
		if (scan.phase === 'enumerating') return 10;
		if (scan.phase === 'classifying' && scan.filesFound > 0) {
			return Math.round(10 + (scan.filesClassified / scan.filesFound) * 85);
		}
		return 0;
	}

	function shortPath(p: string): string {
		const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
		if (parts.length <= 3) return p;
		return `…/${parts.slice(-2).join('/')}`;
	}

	function kindCounts(scan: IntakeScan): { kind: IntakeScanFileKind; count: number }[] {
		if (!scan.result) return [];
		const map = new Map<IntakeScanFileKind, number>();
		for (const f of scan.result) {
			map.set(f.kind, (map.get(f.kind) ?? 0) + 1);
		}
		return [...map.entries()]
			.map(([kind, count]) => ({ kind, count }))
			.sort((a, b) => b.count - a.count);
	}
</script>

<div class="shell">
	<header class="page-header">
		<div class="header-left">
			<FolderSearch size={20} class="header-icon" />
			<h1 class="page-title">Folder Intake</h1>
		</div>
		<p class="page-desc">Scan a local folder to enumerate and classify its files before organising.</p>
	</header>

	<!-- ── New scan form ──────────────────────────────────────────────────── -->
	<section class="scan-form-section">
		<form class="scan-form" onsubmit={startScan}>
			<div class="input-row">
				<div class="path-wrap" class:has-error={!!inputError}>
					<FolderOpen size={15} class="path-icon" />
					<input
						class="path-input"
						type="text"
						placeholder="/Users/you/Projects/my-folder"
						bind:value={folderPath}
						autocomplete="off"
						spellcheck="false"
						disabled={submitting}
					/>
				</div>
				<button class="scan-btn" type="submit" disabled={!folderPath.trim() || submitting}>
					{#if submitting}
						<Loader size={13} class="spin" />
						<span>Starting…</span>
					{:else}
						<FolderSearch size={13} />
						<span>Scan</span>
					{/if}
				</button>
			</div>
			{#if inputError}
				<p class="input-error">{inputError}</p>
			{/if}
		</form>
	</section>

	<!-- ── Scan list ─────────────────────────────────────────────────────── -->
	{#if scans.length === 0}
		<div class="empty-state">
			<FolderSearch size={32} class="empty-icon" />
			<p class="empty-title">No scans yet</p>
			<p class="empty-sub">Enter a folder path above to get started.</p>
		</div>
	{:else}
		<ul class="scan-list" role="list">
			{#each scans as scan (scan.id)}
				<li class="scan-card" class:is-active={scan.status === 'running' || scan.status === 'queued'}>
					<div class="scan-top">
						<div class="scan-meta">
							<span class="scan-status-icon">
								{#if scan.status === 'completed'}
									<Check size={14} class="icon-ok" />
								{:else if scan.status === 'failed'}
									<AlertCircle size={14} class="icon-err" />
								{:else if scan.status === 'cancelled'}
									<X size={14} class="icon-muted" />
								{:else}
									<Loader size={14} class="spin icon-active" />
								{/if}
							</span>
							<span class="scan-path" title={scan.folderPath}>{shortPath(scan.folderPath)}</span>
						</div>
						<div class="scan-actions">
							{#if scan.status === 'queued' || scan.status === 'running'}
								<button
									class="action-btn cancel-btn"
									type="button"
									onclick={() => cancelScan(scan.id)}
									title="Cancel scan"
									aria-label="Cancel scan"
								>
									<X size={13} />
								</button>
							{:else}
								<button
									class="action-btn remove-btn"
									type="button"
									onclick={() => removeScan(scan.id)}
									title="Remove"
									aria-label="Remove scan"
								>
									<X size={13} />
								</button>
							{/if}
						</div>
					</div>

					<div class="scan-phase-row">
						<span class="phase-label">{phaseLabel(scan)}</span>
						{#if scan.status === 'running' || scan.status === 'queued'}
							<span class="phase-pct">{progress(scan)}%</span>
						{/if}
					</div>

					{#if scan.status === 'running' || scan.status === 'queued'}
						<div class="progress-track" role="progressbar" aria-valuenow={progress(scan)} aria-valuemin={0} aria-valuemax={100}>
							<div class="progress-fill" style="width: {progress(scan)}%"></div>
						</div>
					{/if}

					{#if scan.status === 'failed' && scan.errorMessage}
						<p class="error-msg">{scan.errorMessage}</p>
					{/if}

					{#if scan.status === 'completed' && scan.result}
						<div class="kind-chips">
							{#each kindCounts(scan) as { kind, count } (kind)}
								<span class="kind-chip kind-{kind}">{count} {kind}</span>
							{/each}
						</div>

						<div class="organise-row">
							<button
								class="organise-btn"
								type="button"
								disabled={organising === scan.id}
								onclick={() => void organise(scan)}
							>
								{#if organising === scan.id}
									<Loader size={12} class="spin" />
									<span>Creating…</span>
								{:else}
									<RefreshCw size={12} />
									<span>Organise</span>
								{/if}
							</button>
						</div>
					{/if}
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
	max-width: 680px;
	margin: 0 auto;
	width: 100%;
	gap: var(--sp-6);
}

/* ── Header ── */
.page-header {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
}

.header-left {
	display: flex;
	align-items: center;
	gap: var(--sp-3);
}

.header-left :global(.header-icon) {
	color: var(--text-muted);
}

.page-title {
	font-size: 22px;
	font-weight: 700;
	color: var(--text-primary);
	letter-spacing: -0.01em;
}

.page-desc {
	font-size: 13.5px;
	color: var(--text-muted);
	line-height: 1.5;
}

/* ── Scan form ── */
.scan-form-section {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
}

.scan-form {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
}

.input-row {
	display: flex;
	gap: var(--sp-2);
}

.path-wrap {
	flex: 1;
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	padding: 8px 12px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-surface);
	transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}

.path-wrap:focus-within {
	border-color: var(--accent);
	box-shadow: 0 0 0 3px rgba(77, 107, 254, 0.14);
}

.path-wrap.has-error {
	border-color: var(--red, #f87171);
}

.path-wrap :global(.path-icon) {
	color: var(--text-muted);
	flex-shrink: 0;
}

.path-input {
	flex: 1;
	border: none;
	background: transparent;
	color: var(--text-primary);
	font-size: 13.5px;
	font-family: monospace;
	outline: none;
}

.path-input::placeholder {
	color: var(--text-placeholder);
	font-family: inherit;
}

.path-input:disabled {
	opacity: 0.6;
}

.scan-btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 8px 16px;
	border: 1px solid var(--accent);
	border-radius: var(--radius-sm);
	background: var(--accent);
	color: #fff;
	font-size: 13px;
	font-weight: 600;
	font-family: inherit;
	cursor: pointer;
	white-space: nowrap;
	transition: opacity var(--motion-fast), background var(--motion-fast);
}

.scan-btn:hover:not(:disabled) {
	background: color-mix(in oklab, var(--accent) 85%, #fff);
}

.scan-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.input-error {
	font-size: 12px;
	color: var(--red, #f87171);
	padding-left: var(--sp-1);
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
	font-size: 15px;
	font-weight: 600;
	color: var(--text-muted);
}

.empty-sub {
	font-size: 13px;
	color: var(--text-placeholder);
}

/* ── Scan list ── */
.scan-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: var(--sp-3);
}

.scan-card {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
	padding: var(--sp-4) var(--sp-5);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
	background: var(--bg-surface);
	transition: border-color var(--motion-fast);
}

.scan-card.is-active {
	border-color: rgba(77, 107, 254, 0.3);
}

.scan-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-3);
}

.scan-meta {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	min-width: 0;
}

.scan-status-icon {
	flex-shrink: 0;
}

.scan-status-icon :global(.icon-ok) {
	color: var(--green, #34d399);
}

.scan-status-icon :global(.icon-err) {
	color: var(--red, #f87171);
}

.scan-status-icon :global(.icon-muted) {
	color: var(--text-placeholder);
}

.scan-status-icon :global(.icon-active) {
	color: var(--accent);
}

.scan-path {
	font-size: 13px;
	font-family: monospace;
	color: var(--text-primary);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.scan-actions {
	flex-shrink: 0;
}

.action-btn {
	display: grid;
	place-items: center;
	width: 26px;
	height: 26px;
	border: 1px solid transparent;
	border-radius: var(--radius-sm);
	background: transparent;
	cursor: pointer;
	transition: background var(--motion-fast), color var(--motion-fast), border-color var(--motion-fast);
}

.cancel-btn {
	color: var(--text-muted);
}

.cancel-btn:hover {
	background: rgba(248, 113, 113, 0.12);
	border-color: rgba(248, 113, 113, 0.3);
	color: var(--red, #f87171);
}

.remove-btn {
	color: var(--text-placeholder);
}

.remove-btn:hover {
	background: var(--bg-surface-hover);
	border-color: var(--border-default);
	color: var(--text-muted);
}

/* ── Phase ── */
.scan-phase-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.phase-label {
	font-size: 12px;
	color: var(--text-muted);
}

.phase-pct {
	font-size: 11px;
	color: var(--text-placeholder);
	font-variant-numeric: tabular-nums;
}

/* ── Progress bar ── */
.progress-track {
	height: 3px;
	background: var(--border-subtle);
	border-radius: 2px;
	overflow: hidden;
}

.progress-fill {
	height: 100%;
	background: var(--accent);
	border-radius: 2px;
	transition: width 600ms ease;
}

/* ── Error message ── */
.error-msg {
	font-size: 12px;
	color: var(--red, #f87171);
	background: rgba(248, 113, 113, 0.07);
	border: 1px solid rgba(248, 113, 113, 0.15);
	border-radius: var(--radius-sm);
	padding: var(--sp-2) var(--sp-3);
	line-height: 1.5;
}

/* ── Kind chips ── */
.kind-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
}

.kind-chip {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	padding: 2px 8px;
	border: 1px solid var(--border-subtle);
	border-radius: 99px;
	font-size: 11px;
	font-weight: 500;
	color: var(--text-muted);
	background: var(--bg-base);
}

/* ── Organise button ── */
.organise-row {
	display: flex;
	justify-content: flex-end;
}

.organise-btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 14px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-secondary);
	font-size: 12.5px;
	font-weight: 500;
	font-family: inherit;
	cursor: pointer;
	transition: background var(--motion-fast), color var(--motion-fast), border-color var(--motion-fast);
}

.organise-btn:hover {
	background: var(--bg-surface-hover);
	border-color: var(--border-strong);
	color: var(--text-primary);
}

/* ── Spin animation ── */
:global(.spin) {
	animation: spin 1s linear infinite;
}

@keyframes spin {
	to { transform: rotate(360deg); }
}
</style>
