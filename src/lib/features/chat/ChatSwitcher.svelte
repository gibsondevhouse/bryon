<script lang="ts">
import { goto } from '$app/navigation';
import { tick } from 'svelte';
import { Search, X } from '@lucide/svelte';
import { Dialog, DialogContent, DialogTitle } from '$lib/ui/dialog';
import type { Chat } from '$lib/shared/types';

let {
	open = $bindable(false),
	chats,
}: {
	open?: boolean;
	chats: Chat[];
} = $props();

let query = $state('');
let activeIndex = $state(0);
let inputEl: HTMLInputElement | undefined = $state();

const filtered = $derived.by(() => {
	const list = chats.filter((c) => !c.archived);
	const normalized = query.trim().toLowerCase();
	if (!normalized) return list.slice(0, 30);
	return list.filter((c) => c.title.toLowerCase().includes(normalized)).slice(0, 30);
});

$effect(() => {
	if (!open) return;
	query = '';
	activeIndex = 0;
	void tick().then(() => inputEl?.focus());
});

$effect(() => {
	if (filtered.length === 0) {
		activeIndex = 0;
		return;
	}
	if (activeIndex >= filtered.length) activeIndex = filtered.length - 1;
	if (activeIndex < 0) activeIndex = 0;
});

function close(): void {
	open = false;
}

function pick(chat: Chat): void {
	close();
	void goto(`/chats/${chat.id}`);
}

function onKey(e: KeyboardEvent): void {
	if (e.key === 'Escape') {
		e.preventDefault();
		close();
		return;
	}
	if (e.key === 'ArrowDown') {
		e.preventDefault();
		if (filtered.length > 0) activeIndex = (activeIndex + 1) % filtered.length;
		return;
	}
	if (e.key === 'ArrowUp') {
		e.preventDefault();
		if (filtered.length > 0) activeIndex = (activeIndex - 1 + filtered.length) % filtered.length;
		return;
	}
	if (e.key === 'Enter') {
		e.preventDefault();
		const item = filtered[activeIndex];
		if (item) pick(item);
	}
}
</script>

<Dialog bind:open>
	<DialogContent
		showCloseButton={false}
		class="switcher-dialog max-w-[min(100%,560px)] p-0"
		aria-labelledby="chat-switcher-title"
	>
		<DialogTitle id="chat-switcher-title" class="sr-only">Switch chat</DialogTitle>

		<div class="search-row">
			<Search size={16} />
			<input
				bind:this={inputEl}
				bind:value={query}
				onkeydown={onKey}
				placeholder="Search chats..."
				aria-label="Search chats"
				autocomplete="off"
				spellcheck="false"
			/>
			<button class="close-btn" type="button" onclick={close} aria-label="Close">
				<X size={16} />
			</button>
		</div>

		<ul class="list" role="listbox">
			{#if filtered.length === 0}
				<li class="empty">No matching chats</li>
			{:else}
				{#each filtered as chat, i}
					<li>
						<button
							type="button"
							class="row"
							class:active={i === activeIndex}
							onmouseenter={() => (activeIndex = i)}
							onclick={() => pick(chat)}
							role="option"
							aria-selected={i === activeIndex}
						>
							<span class="title">{chat.title}</span>
							<span class="model">{chat.model ?? 'inherited'}</span>
						</button>
					</li>
				{/each}
			{/if}
		</ul>
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

.list {
	list-style: none;
	margin: 0;
	padding: var(--sp-1);
	max-height: min(70vh, 540px);
	overflow: auto;
}

.row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-3);
	width: 100%;
	padding: var(--sp-2) var(--sp-3);
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-primary);
	font-size: 13px;
	text-align: left;
	cursor: pointer;
	transition: background var(--motion-fast);
}

.row.active {
	background: var(--bg-surface-hover);
}

.title {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.model {
	flex-shrink: 0;
	color: var(--text-muted);
	font-size: 11px;
	font-family: 'SF Mono', 'JetBrains Mono', ui-monospace, monospace;
}

.empty {
	padding: var(--sp-4);
	color: var(--text-muted);
	font-size: 13px;
	text-align: center;
}
</style>
