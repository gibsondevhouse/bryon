<script lang="ts">
import { tick } from 'svelte';
import { untrack } from 'svelte';
import { createVirtualizer } from '@tanstack/svelte-virtual';
import Message from './Message.svelte';
import type { Message as MessageType } from '$lib/shared/types';
import type { NewsArticle } from '$lib/shared/stream-events';

let {
	messages,
	streaming = false,
	streamingContent = '',
	streamingThinking = '',
	streamingThinkingDurationMs = 0,
	articlesByMessageId = new Map(),
	thinkingByMessageId = new Map(),
	thinkingDurationByMessageId = new Map(),
	onRetry,
}: {
	messages: MessageType[];
	streaming?: boolean;
	streamingContent?: string;
	streamingThinking?: string;
	streamingThinkingDurationMs?: number;
	articlesByMessageId?: Map<string, NewsArticle[]>;
	thinkingByMessageId?: Map<string, string>;
	thinkingDurationByMessageId?: Map<string, number>;
	onRetry?: () => void;
} = $props();

let scrollContainer: HTMLDivElement | undefined = $state();
let userScrolledUp = $state(false);

const visibleMessages = $derived(
	messages.filter((m) => m.role === 'user' || m.role === 'assistant'),
);

type RenderItem =
	| { kind: 'message'; key: string; message: MessageType }
	| { kind: 'streaming'; key: string; content: string };

const renderItems = $derived.by((): RenderItem[] => {
	const rows: RenderItem[] = visibleMessages.map((message) => ({
		kind: 'message',
		key: message.id,
		message,
	}));
	if (streaming) {
		rows.push({
			kind: 'streaming',
			key: 'streaming-preview',
			content: streamingContent,
		});
	}
	return rows;
});

const rowVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
	count: 0,
	getScrollElement: () => scrollContainer ?? null,
	estimateSize: () => 200,
	overscan: 8,
});

$effect(() => {
	void renderItems.length;
	void scrollContainer;
	const virtualizer = untrack(() => $rowVirtualizer);
	virtualizer.setOptions({
		count: renderItems.length,
		getScrollElement: () => scrollContainer ?? null,
		estimateSize: () => 200,
		overscan: 8,
	});
});

$effect(() => {
	void messages.length;
	void streamingContent;
	if (!userScrolledUp) scrollToBottom();
});

async function scrollToBottom(): Promise<void> {
	await tick();
	if (!scrollContainer) return;

	const lastIndex = renderItems.length - 1;
	if (lastIndex < 0) return;
	$rowVirtualizer.scrollToIndex(lastIndex, { align: 'end' });
}

function handleScroll(): void {
	if (!scrollContainer) return;
	const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
	userScrolledUp = scrollHeight - scrollTop - clientHeight > 80;
}

function measureItem(
	node: HTMLDivElement,
): { update: () => void; destroy: () => void } {
	$rowVirtualizer.measureElement(node);
	return {
		update: () => {
			$rowVirtualizer.measureElement(node);
		},
		destroy: () => {
			// no cleanup required
		},
	};
}
</script>

<div class="list" bind:this={scrollContainer} onscroll={handleScroll}>
	{#if renderItems.length === 0}
		<!-- empty: composer is shown by ChatView -->
	{:else}
		<div class="inner" style={`height:${$rowVirtualizer.getTotalSize()}px`}>
			{#each $rowVirtualizer.getVirtualItems() as virtualRow (virtualRow.key)}
				{@const item = renderItems[virtualRow.index]}
				<div
					class="virtual-row"
					data-index={virtualRow.index}
					style={`transform: translateY(${virtualRow.start}px);`}
					use:measureItem
				>
					{#if item?.kind === 'message'}
						{@const isLast = virtualRow.index === renderItems.length - 1}
						{@const articles = articlesByMessageId.get(item.message.id)}
						{@const thinking = thinkingByMessageId.get(item.message.id)}
						{@const thinkingDurationMs = thinkingDurationByMessageId.get(item.message.id) ?? 0}
						<div id="msg-{item.message.id}">
							<Message
								message={item.message}
								{thinking}
								{thinkingDurationMs}
								{articles}
								onRetry={isLast ? onRetry : undefined}
							/>
						</div>
					{:else if item?.kind === 'streaming'}
						<div role="status" aria-live="polite" aria-label="Assistant is responding">
							<Message
								isStreaming={true}
								streamingContent={item.content}
								thinking={streamingThinking || undefined}
								thinkingDurationMs={streamingThinkingDurationMs}
							/>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if userScrolledUp && renderItems.length > 6}
		<button class="anchor" onclick={scrollToBottom} aria-label="Scroll to latest message">&darr;</button>
	{/if}
</div>

<style>
.list {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-height: 0;
	overflow-y: auto;
}

.inner {
	max-width: var(--content-max-w);
	width: 100%;
	margin: 0 auto;
	position: relative;
	padding: var(--sp-2) var(--sp-6) var(--sp-8);
}

.virtual-row {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
}

.anchor {
	position: sticky;
	bottom: var(--sp-4);
	align-self: center;
	height: 32px;
	width: 32px;
	border: 1px solid var(--border-default);
	border-radius: 50%;
	background: var(--bg-surface);
	color: var(--text-muted);
	font-size: 14px;
	cursor: pointer;
	box-shadow: var(--shadow-md);
	z-index: 10;
	transition: all 120ms ease;
}

.anchor:hover {
	color: var(--text-primary);
	background: var(--bg-surface-hover);
	border-color: var(--border-strong);
}
</style>
