<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { FolderSearch, X, RefreshCw, Check, AlertCircle, Loader, FolderOpen, MapPin, Plus, Trash2 } from '@lucide/svelte';
	import type { IntakeScan, IntakeScanFileKind, Plan, Project } from '$lib/shared/types';
	import { Button } from '$lib/ui/button';
	import * as Dialog from '$lib/ui/dialog';
	import type { PlanCardSeries } from '$lib/shared/types';

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

	// ── Propose plan ─────────────────────────────────────────────────────────
	type ProposedCard = { series: PlanCardSeries; title: string };

	let proposeOpen = $state(false);
	let proposingScan = $state<IntakeScan | null>(null);
	let proposeName = $state('');
	let proposeGap = $state('');
	let proposeContext = $state('');
	let proposeCards = $state<ProposedCard[]>([]);
	let proposeBusy = $state(false);
	let proposeError = $state<string | null>(null);

	function openPropose(scan: IntakeScan): void {
		proposingScan = scan;
		const parts = scan.folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
		proposeName = parts[parts.length - 1] ?? '';
		proposeGap = '';
		proposeContext = '';
		proposeCards = [{ series: '100', title: `Purpose of ${proposeName}` }];
		proposeError = null;
		proposeOpen = true;
	}

	function addProposeCard(): void {
		proposeCards = [...proposeCards, { series: '300', title: '' }];
	}

	function removeProposeCard(idx: number): void {
		proposeCards = proposeCards.filter((_, i) => i !== idx);
	}

	function setProposeCardSeries(idx: number, series: PlanCardSeries): void {
		proposeCards = proposeCards.map((c, i) => (i === idx ? { ...c, series } : c));
	}

	function setProposeCardTitle(idx: number, title: string): void {
		proposeCards = proposeCards.map((c, i) => (i === idx ? { ...c, title } : c));
	}

	const proposeValid = $derived(
		proposeName.trim().length > 0 &&
		proposeGap.trim().length > 0 &&
		proposeContext.trim().length > 0,
	);

	const SERIES_OPTIONS: { value: PlanCardSeries; label: string }[] = [
		{ value: '100', label: '100 — Purpose' },
		{ value: '200', label: '200 — Context' },
		{ value: '300', label: '300 — Goals' },
		{ value: '400', label: '400 — Rules' },
		{ value: '500', label: '500 — Standards' },
		{ value: '600', label: '600 — Tools & Sources' },
		{ value: '700', label: '700 — Workflows' },
		{ value: '800', label: '800 — Projects' },
		{ value: '900', label: '900 — Actions' },
		{ value: '1000', label: '1000 — Review' },
	];

	async function submitPropose(): Promise<void> {
		if (!proposingScan || !proposeValid || proposeBusy) return;
		proposeBusy = true;
		proposeError = null;
		try {
			const res = await fetch(
				`/api/intake/scans/${proposingScan.id}/propose-plan`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: proposeName.trim(),
						missionNeed: {
							capabilityGap: proposeGap.trim(),
							operationalContext: proposeContext.trim(),
						},
						initialCards: proposeCards
							.filter((c) => c.title.trim())
							.map((c) => ({ series: c.series, title: c.title.trim() })),
					}),
				},
			);
			if (res.status === 201) {
				const body = (await res.json()) as { plan: Plan };
				await goto(`/plans/${body.plan.id}`);
				return;
			}
			const err = await res
				.json()
				.catch(() => ({}) as { error?: { code?: string; message?: string } });
			const errBody = err as { error?: { code?: string; message?: string } };
			if (res.status === 409) {
				proposeError = `A plan named "${proposeName.trim()}" already exists. Choose a different name.`;
			} else if (res.status === 422) {
				proposeError =
					'This scan is not yet complete. Wait for it to finish before creating a plan.';
			} else {
				proposeError =
					errBody.error?.message ?? `Could not create plan (${res.status}).`;
			}
		} catch {
			proposeError = 'Network error. Please try again.';
		} finally {
			proposeBusy = false;
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
							</button>						<button
							class="organise-btn propose-btn"
							type="button"
							onclick={() => openPropose(scan)}
						>
							<MapPin size={12} />
							<span>Create plan</span>
						</button>						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<!-- ── Propose-plan dialog ──────────────────────────────────────────────── -->
<Dialog.Root bind:open={proposeOpen}>
	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content class="propose-dialog-content">
			<Dialog.Header>
				<Dialog.Title>Create plan from scan</Dialog.Title>
				<Dialog.Description>
					Review and edit the pre-filled fields, then confirm to create a new
					doctrine plan.
				</Dialog.Description>
			</Dialog.Header>

			<div class="propose-form">
				<label class="propose-field">
					<span class="propose-label">Plan name <span class="req">*</span></span>
					<input
						class="propose-input"
						type="text"
						bind:value={proposeName}
						placeholder="Enter plan name"
						disabled={proposeBusy}
						required
						aria-required="true"
					/>
				</label>

				<fieldset class="propose-fieldset">
					<legend class="propose-legend">Mission Need</legend>

					<label class="propose-field">
						<span class="propose-label"
							>Capability gap <span class="req">*</span></span
						>
						<textarea
							class="propose-textarea"
							bind:value={proposeGap}
							rows={3}
							placeholder="What capability gap does this plan address?"
							disabled={proposeBusy}
							required
							aria-required="true"
						></textarea>
					</label>

					<label class="propose-field">
						<span class="propose-label"
							>Operational context <span class="req">*</span></span
						>
						<textarea
							class="propose-textarea"
							bind:value={proposeContext}
							rows={3}
							placeholder="What is the operational context?"
							disabled={proposeBusy}
							aria-required="true"
							required
						></textarea>
					</label>
				</fieldset>

				<fieldset class="propose-fieldset">
					<legend class="propose-legend propose-legend-actions">
						<span>Initial cards</span>
						<button
							class="add-card-link"
							type="button"
							onclick={addProposeCard}
							disabled={proposeBusy}
						>
							<Plus size={11} />
							<span>Add card</span>
						</button>
					</legend>

					{#if proposeCards.length === 0}
						<p class="no-cards-note">
							No initial cards. The plan will be created with an empty card
							board.
						</p>
					{:else}
						<ul class="propose-cards-list" role="list">
							{#each proposeCards as card, idx (idx)}
								<li class="propose-card-row">
									<select
										class="propose-series-select"
										value={card.series}
										aria-label="Card series"
										onchange={(e) =>
											setProposeCardSeries(
												idx,
												(e.currentTarget as HTMLSelectElement)
													.value as PlanCardSeries,
											)}
										disabled={proposeBusy}
									>
										{#each SERIES_OPTIONS as opt (opt.value)}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
									<input
										class="propose-card-title-input"
										type="text"
										placeholder="Card title"
										value={card.title}
										oninput={(e) =>
											setProposeCardTitle(
												idx,
												(e.currentTarget as HTMLInputElement).value,
											)}
										disabled={proposeBusy}
										aria-label="Card title"
									/>
									<button
										class="remove-card-btn"
										type="button"
										onclick={() => removeProposeCard(idx)}
										disabled={proposeBusy}
										aria-label="Remove card"
									>
										<Trash2 size={13} />
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</fieldset>

				{#if proposeError}
					<p class="propose-error" role="alert">{proposeError}</p>
				{/if}
			</div>

			<Dialog.Footer>
				<Button
					variant="outline"
					onclick={() => {
						proposeOpen = false;
					}}
					disabled={proposeBusy}
				>
					Discard
				</Button>
				<Button
					onclick={() => void submitPropose()}
					disabled={!proposeValid || proposeBusy}
				>
					{proposeBusy ? 'Creating plan…' : 'Create plan'}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
.shell {
	display: flex;
	flex-direction: column;
	min-height: 100%;
	max-width: 680px;
	margin: 0 auto;
	width: 100%;
	gap: var(--sp-6);
	padding: var(--sp-6);
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
	gap: var(--sp-2);
}

.propose-btn {
	border-color: var(--accent-soft);
	color: var(--accent-text);
}

.propose-btn:hover {
	background: var(--accent-soft);
	border-color: var(--accent);
	color: var(--text-primary);
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

/* ── Propose dialog form ── */
:global(.propose-dialog-content) {
	max-width: 560px !important;
	max-height: 90vh;
	overflow-y: auto;
}

.propose-form {
	display: flex;
	flex-direction: column;
	gap: var(--sp-4);
	padding: 0 0 var(--sp-2);
}

.propose-field {
	display: flex;
	flex-direction: column;
	gap: var(--sp-1);
}

.propose-label {
	font-size: 12px;
	font-weight: 600;
	color: var(--text-secondary);
}

.req {
	color: var(--red);
}

.propose-input,
.propose-textarea {
	padding: 8px 10px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	color: var(--text-primary);
	font: inherit;
	font-size: 13px;
	outline: none;
	transition: border-color var(--motion-fast);
}

.propose-input:focus,
.propose-textarea:focus {
	border-color: var(--accent);
}

.propose-input::placeholder,
.propose-textarea::placeholder {
	color: var(--text-placeholder);
}

.propose-textarea {
	resize: vertical;
	line-height: 1.5;
}

.propose-fieldset {
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-md);
	padding: var(--sp-3);
	display: flex;
	flex-direction: column;
	gap: var(--sp-3);
}

.propose-legend {
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--text-muted);
	padding: 0 var(--sp-1);
}

.propose-legend-actions {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-3);
	width: 100%;
}

.add-card-link {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font: inherit;
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.03em;
	color: var(--accent-text);
	background: transparent;
	border: none;
	cursor: pointer;
	text-transform: none;
	padding: 0;
	transition: color var(--motion-fast);
}

.add-card-link:hover:not(:disabled) {
	color: var(--accent-hover);
}

.add-card-link:disabled {
	opacity: 0.4;
}

.no-cards-note {
	font-size: 12.5px;
	color: var(--text-placeholder);
	margin: 0;
	font-style: italic;
}

.propose-cards-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
}

.propose-card-row {
	display: grid;
	grid-template-columns: 160px 1fr 28px;
	gap: var(--sp-2);
	align-items: center;
}

.propose-series-select {
	padding: 6px 8px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	color: var(--text-primary);
	font: inherit;
	font-size: 12px;
	outline: none;
	cursor: pointer;
	transition: border-color var(--motion-fast);
}

.propose-series-select:focus {
	border-color: var(--accent);
}

.propose-card-title-input {
	padding: 6px 8px;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	color: var(--text-primary);
	font: inherit;
	font-size: 12.5px;
	outline: none;
	transition: border-color var(--motion-fast);
}

.propose-card-title-input:focus {
	border-color: var(--accent);
}

.propose-card-title-input::placeholder {
	color: var(--text-placeholder);
}

.remove-card-btn {
	display: grid;
	place-items: center;
	width: 28px;
	height: 28px;
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-placeholder);
	cursor: pointer;
	transition: color var(--motion-fast), background var(--motion-fast);
}

.remove-card-btn:hover:not(:disabled) {
	color: var(--red);
	background: rgba(239, 68, 68, 0.08);
}

.remove-card-btn:disabled {
	opacity: 0.3;
}

.propose-error {
	font-size: 12.5px;
	color: var(--red);
	margin: 0;
	padding: var(--sp-2) var(--sp-3);
	background: rgba(239, 68, 68, 0.08);
	border-radius: var(--radius-sm);
}
</style>
