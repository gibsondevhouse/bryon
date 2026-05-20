<script lang="ts">
import { FileText } from '@lucide/svelte';
import type { Attachment } from '$lib/shared/types';

let {
	attachments,
	onOpenLightbox
}: {
	attachments: Attachment[];
	onOpenLightbox: (src: string) => void;
} = $props();

const imageAttachments = $derived(attachments.filter((att) => att.kind === 'image'));
const documentAttachments = $derived(attachments.filter((att) => att.kind === 'document'));
</script>

{#if imageAttachments.length > 0}
	<div class="msg-images">
		{#each imageAttachments as att (att.id)}
			<button
				class="msg-img-btn"
				onclick={() => onOpenLightbox(`/api/chats/image?path=${encodeURIComponent(att.path)}`)}
				title="View full size"
				aria-label="View image"
			>
				<img
					src="/api/chats/image?path={encodeURIComponent(att.path)}"
					alt="Attachment preview"
					class="msg-img"
				/>
			</button>
		{/each}
	</div>
{/if}

{#if documentAttachments.length > 0}
	<div class="msg-docs">
		{#each documentAttachments as att (att.id)}
			<div class="msg-doc" title={att.name}>
				<FileText size={14} />
				<span>{att.title ?? att.name}</span>
			</div>
		{/each}
	</div>
{/if}

<style>
.msg-images {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: var(--sp-2);
	margin-bottom: var(--sp-2);
	max-width: 85%;
}

.msg-img-btn {
	padding: 0;
	background: none;
	border: none;
	cursor: zoom-in;
	border-radius: var(--radius-sm);
	overflow: hidden;
	flex-shrink: 0;
}

.msg-img {
	display: block;
	max-width: 200px;
	max-height: 180px;
	object-fit: cover;
	border-radius: var(--radius-sm);
	border: 1px solid var(--border-subtle);
}

.msg-docs {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: var(--sp-2);
	margin-bottom: var(--sp-2);
	max-width: 85%;
}

.msg-doc {
	display: inline-flex;
	align-items: center;
	gap: var(--sp-2);
	max-width: 260px;
	padding: var(--sp-2) var(--sp-3);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-sm);
	background: var(--bg-surface);
	color: var(--text-secondary);
	font-size: 12px;
}

.msg-doc span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
