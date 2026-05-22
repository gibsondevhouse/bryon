<script lang="ts">
import { goto } from '$app/navigation';
import { tick } from 'svelte';
import DOMPurify from 'dompurify';
import { Search, X } from '@lucide/svelte';
import { fmtDate } from '$lib/utils';
import { Dialog, DialogContent, DialogTitle } from '$lib/ui/dialog';

type SearchResult = {
	id: string;
	chatId: string;
	chatTitle: string;
	role: 'user' | 'assistant' | 'system';
	snippet: string;
	createdAt: number;
};

let {
	open = $bindable(false),
}: {
	open?: boolean;
} = $props();

let query = $state('');
let results = $state<SearchResult[]>([]);
let loading = $state(false);
let activeIndex = $state(0);
let inputEl: HTMLInputElement | undefined = $state();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastSeq = 0;

$effect(() => {
	if (!open) return;
	query = '';
	results = [];
	activeIndex = 0;
	void tick().then(() => inputEl?.focus());
});

$effect(() => {
	const normalized = query.trim();
	if (debounceTimer) clearTimeout(debounceTimer);

	if (!normalized) {
		results = [];
		loading = false;
		return;
	}

	loading = true;
	const seq = ++lastSeq;

	debounceTimer = setTimeout(async () => {
		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}&limit=30`);
			if (!response.ok) {
				if (seq === lastSeq) {
					results = [];
					loading = false;
				}
				return;
			}

			const body = (await response.json()) as { results: SearchResult[] };
			if (seq === lastSeq) {
				results = body.results;
				activeIndex = 0;
				loading = false;
			}
		} catch {
			if (seq === lastSeq) {
				results = [];
				loading = false;
			}
		}
	}, 200);
});

function close(): void {
	open = false;
}

function jumpTo(result: SearchResult): void {
	close();
	void goto(`/chats/${result.chatId}#msg-${result.id}`);
}

function onKey(e: KeyboardEvent): void {
	if (e.key === 'Escape') {
		e.preventDefault();
		close();
		return;
	}
	if (e.key === 'ArrowDown') {
		e.preventDefault();
		if (results.length > 0) activeIndex = (activeIndex + 1) % results.length;
		return;
	}
	if (e.key === 'ArrowUp') {
		e.preventDefault();
		if (results.length > 0) activeIndex = (activeIndex - 1 + results.length) % results.length;
		return;
	}
	if (e.key === 'Enter') {
		e.preventDefault();
		const result = results[activeIndex];
		if (result) jumpTo(result);
	}
}

const formatDate = fmtDate;

function sanitizeSnippet(html: string): string {
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: ['mark'],
		ALLOWED_ATTR: [],
	});
}
</script>

<Dialog bind:open>
	<DialogContent
		showCloseButton={false}
		class="search-dialog max-w-[min(100%,640px)] p-0"
		aria-labelledby="message-search-title"
	>
		<DialogTitle id="message-search-title" class="sr-only">Search messages</DialogTitle>

		<div class="search-row">
			<Search size={16} />
			<input
				bind:this={inputEl}
				bind:value={query}
				onkeydown={onKey}
				placeholder="Search messages..."
				role="combobox"
				aria-autocomplete="list"
				aria-expanded={results.length > 0}
				aria-controls="search-results"
				aria-haspopup="listbox"
				aria-activedescendant={results.length > 0 ? `result-${activeIndex}` : undefined}
				autocomplete="off"
				spellcheck="false"
			/>
			<button class="close-btn" type="button" onclick={close} aria-label="Close">
				<X size={16} />
			</button>
		</div>

		<div class="results" id="search-results" role="listbox">
			<div class="sr-only" aria-live="polite">
				{#if loading}
					Searching…
				{:else if query && results.length === 0}
					No matches found
				{:else if results.length > 0}
					{results.length} results found
				{/if}
			</div>

			{#if loading}
				<div class="status">Searching…</div>
			{:else if !query.trim()}
				<div class="status">Type to search messages</div>
			{:else if results.length === 0}
				<div class="status">No matches found</div>
			{:else}
				<ul role="presentation">
					{#each results as result, i}
						<li role="presentation">
							<button
								id="result-{i}"
								type="button"
								class="row"
								role="option"
								aria-selected={i === activeIndex}
								class:active={i === activeIndex}
								onmouseenter={() => (activeIndex = i)}
								onclick={() => jumpTo(result)}
							>
								<div class="row-head">
									<span class="chat-title">{result.chatTitle}</span>
									<span class="meta">{result.role} · {formatDate(result.createdAt)}</span>
								</div>
								<div class="snippet">{@html sanitizeSnippet(result.snippet)}</div>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</DialogContent>
</Dialog>

<style>
.search-row {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
	padding: var(--sp-3) var(--sp-4);
	border-bottom: 1px solid var(--border-subtle);
	color: var(--text-muted);
}

.search-row input {
	flex: 1;
	border: none;
	background: transparent;
	color: var(--text-primary);
	font-size: 14px;
	outline: none;
}

.search-row input::placeholder {
	color: var(--text-placeholder);
}

.close-btn {
	display: grid;
	place-items: center;
	width: 24px;
	height: 24px;
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	transition:
		background var(--motion-fast),
		color var(--motion-fast);
}

.close-btn:hover {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}

.results {
	max-height: min(70vh, 560px);
	overflow: auto;
}

.status {
	padding: var(--sp-6) var(--sp-4);
	color: var(--text-muted);
	font-size: 13px;
	text-align: center;
}

ul {
	list-style: none;
	margin: 0;
	padding: var(--sp-1);
}

.row {
	display: block;
	width: 100%;
	padding: var(--sp-2) var(--sp-3);
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-primary);
	text-align: left;
	cursor: pointer;
}

.row.active {
	background: var(--bg-surface-hover);
}

.row-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-3);
	margin-bottom: 2px;
}

.chat-title {
	font-size: 12.5px;
	font-weight: 600;
	color: var(--text-primary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.meta {
	flex-shrink: 0;
	font-size: 11px;
	color: var(--text-muted);
	text-transform: capitalize;
}

.snippet {
	font-size: 13px;
	color: var(--text-secondary);
	line-height: 1.5;
	overflow: hidden;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
}

.snippet :global(mark) {
	background: var(--accent-soft);
	color: var(--accent-text);
	padding: 0 2px;
	border-radius: 3px;
}
</style>
