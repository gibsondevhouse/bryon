<script lang="ts">
	import { Plus, Trash2, ChevronUp, ChevronDown } from '@lucide/svelte';
	import type { PlanCard, PlanCardSeries } from '$lib/shared/types';
	import { seriesLabel } from '$lib/features/doctrine/labels';
	import { Button } from '$lib/ui/button';
	import * as Dialog from '$lib/ui/dialog';

	const ALL_SERIES: PlanCardSeries[] = [
		'100',
		'200',
		'300',
		'400',
		'500',
		'600',
		'700',
		'800',
		'900',
		'1000',
	];

	let { planId }: { planId: string } = $props();

	let cards = $state<PlanCard[]>([]);
	let loading = $state(true);
	let fetchError = $state<string | null>(null);

	// Cards grouped by series, sorted by sortOrder then createdAt, excluding archived
	const bySeriesMap = $derived.by(() => {
		const map = new Map<PlanCardSeries, PlanCard[]>();
		for (const s of ALL_SERIES) map.set(s, []);
		for (const c of cards) {
			if (c.archivedAt !== null) continue;
			const list = map.get(c.series) ?? [];
			map.set(c.series, [...list, c]);
		}
		for (const [s, list] of map) {
			map.set(
				s,
				[...list].sort((a, b) => {
					const ao = a.sortOrder ?? Number.POSITIVE_INFINITY;
					const bo = b.sortOrder ?? Number.POSITIVE_INFINITY;
					if (ao !== bo) return ao - bo;
					return a.createdAt - b.createdAt;
				}),
			);
		}
		return map;
	});

	const totalCards = $derived(cards.filter((c) => c.archivedAt === null).length);

	// ── Initial load ─────────────────────────────────────────────────────────
	$effect(() => {
		void loadCards();
	});

	async function loadCards(): Promise<void> {
		loading = true;
		fetchError = null;
		try {
			const r = await fetch(`/api/plans/${planId}/cards`);
			if (!r.ok) throw new Error('fetch failed');
			const body = (await r.json()) as { cards: PlanCard[] };
			cards = body.cards;
		} catch {
			fetchError = 'Could not load plan cards.';
		} finally {
			loading = false;
		}
	}

	// ── Add card ─────────────────────────────────────────────────────────────
	let addingSeries = $state<PlanCardSeries | null>(null);
	let addTitle = $state('');
	let addBody = $state('');
	let addBusy = $state(false);
	let addTitleInput = $state<HTMLInputElement | undefined>(undefined);

	function beginAdd(series: PlanCardSeries): void {
		addingSeries = series;
		addTitle = '';
		addBody = '';
		setTimeout(() => addTitleInput?.focus(), 20);
	}

	function cancelAdd(): void {
		addingSeries = null;
	}

	async function commitAdd(): Promise<void> {
		const title = addTitle.trim();
		const series = addingSeries;
		if (!title || !series || addBusy) return;
		addBusy = true;
		try {
			const r = await fetch(`/api/plans/${planId}/cards`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					series,
					title,
					body: addBody.trim() || undefined,
				}),
			});
			if (r.ok) {
				const body = (await r.json()) as { card: PlanCard };
				cards = [...cards, body.card];
				addingSeries = null;
			}
		} finally {
			addBusy = false;
		}
	}

	// ── Edit card ────────────────────────────────────────────────────────────
	let editId = $state<string | null>(null);
	let editTitle = $state('');
	let editBody = $state('');
	let editBusy = $state(false);

	function beginEdit(card: PlanCard): void {
		editId = card.id;
		editTitle = card.title;
		editBody = card.body ?? '';
	}

	function cancelEdit(): void {
		editId = null;
	}

	async function commitEdit(): Promise<void> {
		if (!editId || editBusy) return;
		const title = editTitle.trim();
		if (!title) {
			cancelEdit();
			return;
		}
		editBusy = true;
		const id = editId;
		const prev = cards.find((c) => c.id === id);
		// Optimistic update
		cards = cards.map((c) =>
			c.id === id
				? { ...c, title, body: editBody.trim() || null }
				: c,
		);
		editId = null;
		try {
			const r = await fetch(`/api/plans/${planId}/cards/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title, body: editBody.trim() || null }),
			});
			if (r.ok) {
				const data = (await r.json()) as { card: PlanCard };
				cards = cards.map((c) => (c.id === id ? data.card : c));
			} else if (prev) {
				// Rollback on failure
				cards = cards.map((c) => (c.id === id ? prev : c));
			}
		} catch {
			if (prev) cards = cards.map((c) => (c.id === id ? prev : c));
		} finally {
			editBusy = false;
		}
	}

	// ── Context weight ────────────────────────────────────────────────────────
	type ContextWeight = PlanCard['contextWeight'];
	const WEIGHT_CYCLE: ContextWeight[] = ['always', 'conditional', 'never'];

	async function cycleContextWeight(card: PlanCard): Promise<void> {
		const nextIdx = (WEIGHT_CYCLE.indexOf(card.contextWeight) + 1) % 3;
		const nextWeight = WEIGHT_CYCLE[nextIdx];
		const prev = card.contextWeight;
		// Optimistic
		cards = cards.map((c) =>
			c.id === card.id ? { ...c, contextWeight: nextWeight } : c,
		);
		try {
			await fetch(`/api/plans/${planId}/cards/${card.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contextWeight: nextWeight }),
			});
		} catch {
			// Rollback
			cards = cards.map((c) =>
				c.id === card.id ? { ...c, contextWeight: prev } : c,
			);
		}
	}

	// ── Move card (reorder) ───────────────────────────────────────────────────
	function moveCard(card: PlanCard, direction: 'up' | 'down'): void {
		const seriesCards = bySeriesMap.get(card.series) ?? [];
		const idx = seriesCards.findIndex((c) => c.id === card.id);
		if (direction === 'up' && idx <= 0) return;
		if (direction === 'down' && idx >= seriesCards.length - 1) return;
		const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
		const other = seriesCards[swapIdx];
		const newSortA = swapIdx;
		const newSortB = idx;
		// Optimistic
		cards = cards.map((c) => {
			if (c.id === card.id) return { ...c, sortOrder: newSortA };
			if (c.id === other.id) return { ...c, sortOrder: newSortB };
			return c;
		});
		void patchSortOrder(card.id, newSortA);
		void patchSortOrder(other.id, newSortB);
	}

	async function patchSortOrder(cardId: string, sortOrder: number): Promise<void> {
		await fetch(`/api/plans/${planId}/cards/${cardId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sortOrder }),
		});
	}

	// ── Delete ────────────────────────────────────────────────────────────────
	let deleteTarget = $state<PlanCard | null>(null);
	let deleteOpen = $state(false);
	let deleteBusy = $state(false);
	let deleteError = $state<string | null>(null);

	function beginDelete(card: PlanCard): void {
		deleteTarget = card;
		deleteError = null;
		deleteOpen = true;
	}

	async function confirmDelete(): Promise<void> {
		if (!deleteTarget || deleteBusy) return;
		deleteBusy = true;
		deleteError = null;
		const id = deleteTarget.id;
		try {
			const r = await fetch(`/api/plans/${planId}/cards/${id}`, {
				method: 'DELETE',
			});
			if (r.ok) {
				cards = cards.map((c) =>
					c.id === id ? { ...c, archivedAt: Date.now() } : c,
				);
				deleteOpen = false;
				deleteTarget = null;
			} else if (r.status === 409) {
				deleteError =
					'This card is referenced by other plan objects and cannot be deleted.';
			} else {
				deleteError = 'Could not delete the card. Please try again.';
			}
		} catch {
			deleteError = 'Could not delete the card. Please try again.';
		} finally {
			deleteBusy = false;
		}
	}
</script>

{#if loading}
	<div class="board-loading" aria-busy="true" aria-label="Loading plan cards">
		{#each ALL_SERIES as _s (_s)}
			<div class="col-skeleton">
				<div class="col-skeleton-header"></div>
				<div class="col-skeleton-card"></div>
				<div class="col-skeleton-card short"></div>
			</div>
		{/each}
	</div>
{:else if fetchError}
	<div class="board-error" role="alert">
		<p>{fetchError}</p>
		<button class="retry-btn" onclick={() => void loadCards()}>Try again</button>
	</div>
{:else}
	{#if totalCards === 0}
		<div class="board-empty-banner">
			The 10-series card board is empty. Add cards to each series to build your
			plan's doctrine knowledge base.
		</div>
	{/if}
	<div class="board" role="region" aria-label="10-series plan card board">
		{#each ALL_SERIES as series (series)}
			{@const seriesCards = bySeriesMap.get(series) ?? []}
			<div class="col">
				<div class="col-header">
					<span class="col-label">{seriesLabel(series)}</span>
					{#if seriesCards.length > 0}
						<span class="col-count">{seriesCards.length}</span>
					{/if}
				</div>

				<div class="col-cards">
					{#each seriesCards as card (card.id)}
						{#if editId === card.id}
							<!-- Edit mode -->
							<div class="card card-editing">
								<input
									class="card-edit-title"
									bind:value={editTitle}
									placeholder="Card title"
									aria-label="Card title"
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											void commitEdit();
										}
										if (e.key === 'Escape') cancelEdit();
									}}
								/>
								<textarea
									class="card-edit-body"
									bind:value={editBody}
									rows={3}
									placeholder="Body (optional)"
									aria-label="Card body"
									onkeydown={(e) => {
										if (e.key === 'Escape') cancelEdit();
									}}
								></textarea>
								<div class="card-edit-actions">
									<button
										class="card-save-btn"
										onclick={() => void commitEdit()}
										disabled={!editTitle.trim() || editBusy}
									>
										{editBusy ? 'Saving…' : 'Save'}
									</button>
									<button class="card-cancel-btn" onclick={cancelEdit}>
										Cancel
									</button>
								</div>
							</div>
						{:else}
							<!-- View mode -->
							<article class="card">
								<button
									class="card-body-trigger"
									onclick={() => beginEdit(card)}
									aria-label="Edit card: {card.title}"
								>
									<p class="card-title">{card.title}</p>
									{#if card.body}
										<p class="card-body-text">{card.body}</p>
									{/if}
								</button>
								<div class="card-footer">
									<button
										class="weight-badge weight-{card.contextWeight}"
										onclick={() => void cycleContextWeight(card)}
										title="Context weight: {card.contextWeight}. Click to cycle."
										aria-label="Context weight: {card.contextWeight}"
									>
										{card.contextWeight}
									</button>
									<div class="card-controls">
										<button
											class="ctrl-btn"
											onclick={() => moveCard(card, 'up')}
											disabled={seriesCards.findIndex(
												(c) => c.id === card.id,
											) === 0}
											aria-label="Move card up"
										>
											<ChevronUp size={12} />
										</button>
										<button
											class="ctrl-btn"
											onclick={() => moveCard(card, 'down')}
											disabled={seriesCards.findIndex(
												(c) => c.id === card.id,
											) >=
												seriesCards.length - 1}
											aria-label="Move card down"
										>
											<ChevronDown size={12} />
										</button>
										<button
											class="ctrl-btn ctrl-delete"
											onclick={() => beginDelete(card)}
											aria-label="Delete card: {card.title}"
										>
											<Trash2 size={12} />
										</button>
									</div>
								</div>
							</article>
						{/if}
					{/each}
				</div>

				<!-- Add card form or button -->
				{#if addingSeries === series}
					<div class="add-form">
						<input
							bind:this={addTitleInput}
							class="add-title-input"
							placeholder="Card title (required)"
							bind:value={addTitle}
							aria-label="New card title"
							onkeydown={(e) => {
								if (e.key === 'Enter') void commitAdd();
								if (e.key === 'Escape') cancelAdd();
							}}
						/>
						<textarea
							class="add-body-input"
							placeholder="Body (optional)"
							bind:value={addBody}
							rows={2}
							aria-label="New card body"
							onkeydown={(e) => {
								if (e.key === 'Escape') cancelAdd();
							}}
						></textarea>
						<div class="add-actions">
							<button
								class="add-confirm-btn"
								onclick={() => void commitAdd()}
								disabled={!addTitle.trim() || addBusy}
							>
								{addBusy ? 'Adding…' : 'Add card'}
							</button>
							<button class="add-cancel-btn" onclick={cancelAdd}>Cancel</button>
						</div>
					</div>
				{:else}
					<button
						class="add-card-btn"
						onclick={() => beginAdd(series)}
						aria-label="Add card to {seriesLabel(series)}"
					>
						<Plus size={13} />
						<span>
							{seriesCards.length === 0 ? 'Add first card' : 'Add card'}
						</span>
					</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<!-- Delete confirmation dialog -->
<Dialog.Root bind:open={deleteOpen}>
	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>Delete card?</Dialog.Title>
				<Dialog.Description>
					"{deleteTarget?.title}" will be permanently removed from this plan.
					This action cannot be undone.
				</Dialog.Description>
			</Dialog.Header>

			{#if deleteError}
				<p class="delete-error" role="alert">{deleteError}</p>
			{/if}

			<Dialog.Footer>
				<Button
					variant="outline"
					onclick={() => {
						deleteOpen = false;
					}}
					disabled={deleteBusy}
				>
					Cancel
				</Button>
				<Button
					variant="destructive"
					onclick={() => void confirmDelete()}
					disabled={deleteBusy}
				>
					{deleteBusy ? 'Deleting…' : 'Delete card'}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	/* ── Board ── */
	.board {
		display: flex;
		gap: var(--sp-3);
		overflow-x: auto;
		padding-bottom: var(--sp-4);
		padding-top: var(--sp-1);
		scrollbar-width: thin;
		scrollbar-color: var(--border-default) transparent;
	}

	/* ── Column ── */
	.col {
		flex-shrink: 0;
		width: 228px;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.col-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--sp-1);
	}

	.col-label {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.col-count {
		font-size: 11px;
		color: var(--text-placeholder);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		padding: 0 6px;
		min-width: 20px;
		text-align: center;
	}

	/* ── Card view mode ── */
	.card {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: border-color var(--motion-fast);
	}

	.card:hover {
		border-color: var(--border-default);
	}

	.card-body-trigger {
		display: block;
		width: 100%;
		text-align: left;
		padding: var(--sp-3);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background var(--motion-fast);
	}

	.card-body-trigger:hover {
		background: var(--surface-tint-hover);
	}

	.card-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
		line-height: 1.4;
	}

	.card-body-text {
		font-size: 12px;
		color: var(--text-secondary);
		margin: var(--sp-1) 0 0;
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sp-2) var(--sp-3);
		border-top: 1px solid var(--border-hair);
	}

	/* ── Context weight badge ── */
	.weight-badge {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: var(--radius-full);
		border: 1px solid transparent;
		cursor: pointer;
		transition: opacity var(--motion-fast);
	}

	.weight-badge:hover {
		opacity: 0.75;
	}

	.weight-always {
		background: rgba(52, 211, 153, 0.12);
		color: var(--green);
		border-color: rgba(52, 211, 153, 0.25);
	}

	.weight-conditional {
		background: rgba(251, 191, 36, 0.1);
		color: var(--amber);
		border-color: rgba(251, 191, 36, 0.2);
	}

	.weight-never {
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-placeholder);
		border-color: var(--border-subtle);
	}

	/* ── Card controls ── */
	.card-controls {
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity var(--motion-fast);
	}

	.card:hover .card-controls {
		opacity: 1;
	}

	.ctrl-btn {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-placeholder);
		cursor: pointer;
		transition:
			background var(--motion-fast),
			color var(--motion-fast);
	}

	.ctrl-btn:hover {
		background: var(--bg-surface-hover);
		color: var(--text-muted);
	}

	.ctrl-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.ctrl-delete:hover {
		color: var(--red);
	}

	/* ── Card edit mode ── */
	.card-editing {
		padding: var(--sp-3);
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.card-edit-title {
		width: 100%;
		padding: 5px 8px;
		border: 1px solid var(--accent);
		border-radius: var(--radius-sm);
		background: var(--bg-base);
		color: var(--text-primary);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
		outline: none;
		box-sizing: border-box;
	}

	.card-edit-body {
		width: 100%;
		padding: 5px 8px;
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		background: var(--bg-base);
		color: var(--text-primary);
		font: inherit;
		font-size: 12px;
		line-height: 1.5;
		resize: vertical;
		outline: none;
		box-sizing: border-box;
	}

	.card-edit-body:focus {
		border-color: var(--accent);
	}

	.card-edit-actions {
		display: flex;
		gap: var(--sp-2);
	}

	.card-save-btn,
	.card-cancel-btn {
		padding: 4px 10px;
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
		transition: background var(--motion-fast);
	}

	.card-save-btn {
		background: var(--accent);
		color: white;
		border: none;
	}

	.card-save-btn:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.card-save-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.card-cancel-btn {
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--border-default);
	}

	.card-cancel-btn:hover {
		background: var(--bg-surface-hover);
		color: var(--text-primary);
	}

	/* ── Add card button ── */
	.add-card-btn {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		width: 100%;
		padding: 8px var(--sp-3);
		border: 1px dashed var(--border-hair);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-placeholder);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
		text-align: left;
		transition:
			border-color var(--motion-fast),
			color var(--motion-fast);
	}

	.add-card-btn:hover {
		border-color: var(--border-default);
		color: var(--text-muted);
	}

	/* ── Add form ── */
	.add-form {
		background: var(--bg-surface);
		border: 1px solid var(--accent);
		border-radius: var(--radius-md);
		padding: var(--sp-3);
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.add-title-input,
	.add-body-input {
		width: 100%;
		padding: 5px 8px;
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		background: var(--bg-base);
		color: var(--text-primary);
		font: inherit;
		font-size: 13px;
		outline: none;
		box-sizing: border-box;
	}

	.add-title-input:focus,
	.add-body-input:focus {
		border-color: var(--accent);
	}

	.add-body-input {
		font-size: 12px;
		line-height: 1.5;
		resize: none;
	}

	.add-actions {
		display: flex;
		gap: var(--sp-2);
	}

	.add-confirm-btn,
	.add-cancel-btn {
		padding: 4px 10px;
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
		transition: background var(--motion-fast);
	}

	.add-confirm-btn {
		background: var(--accent);
		color: white;
		border: none;
	}

	.add-confirm-btn:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.add-confirm-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.add-cancel-btn {
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--border-default);
	}

	.add-cancel-btn:hover {
		background: var(--bg-surface-hover);
		color: var(--text-primary);
	}

	/* ── Loading skeleton ── */
	.board-loading {
		display: flex;
		gap: var(--sp-3);
		overflow: hidden;
	}

	.col-skeleton {
		flex-shrink: 0;
		width: 228px;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.col-skeleton-header {
		height: 14px;
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		width: 65%;
		animation: pulse 1.6s ease-in-out infinite;
	}

	.col-skeleton-card {
		height: 68px;
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		animation: pulse 1.6s ease-in-out infinite;
	}

	.col-skeleton-card.short {
		height: 48px;
		animation-delay: 0.2s;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 0.85;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.col-skeleton-header,
		.col-skeleton-card {
			animation: none;
			opacity: 0.6;
		}
	}

	/* ── Error state ── */
	.board-error {
		padding: var(--sp-4);
		border: 1px dashed var(--border-default);
		border-radius: var(--radius-md);
		color: var(--text-muted);
		font-size: 13px;
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.board-error p {
		margin: 0;
	}

	.retry-btn {
		align-self: flex-start;
		padding: 5px 12px;
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-secondary);
		font: inherit;
		font-size: 12.5px;
		cursor: pointer;
		transition: background var(--motion-fast);
	}

	.retry-btn:hover {
		background: var(--bg-surface-hover);
	}

	/* ── Empty banner ── */
	.board-empty-banner {
		padding: var(--sp-3) var(--sp-4);
		border: 1px dashed var(--border-hair);
		border-radius: var(--radius-md);
		color: var(--text-muted);
		font-size: 13px;
		margin-bottom: var(--sp-3);
		line-height: 1.5;
	}

	/* ── Delete error ── */
	.delete-error {
		font-size: 12.5px;
		color: var(--red);
		margin: 0;
		padding: var(--sp-2) var(--sp-3);
		background: rgba(239, 68, 68, 0.08);
		border-radius: var(--radius-sm);
	}
</style>
