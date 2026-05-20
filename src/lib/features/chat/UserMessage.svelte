<script lang="ts">
import AttachmentList from './AttachmentList.svelte';

let {
    content,
    attachments = [],
    onOpenLightbox
}: {
    content: string;
    attachments?: import('$lib/shared/types').Attachment[];
    onOpenLightbox: (src: string) => void;
} = $props();

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\n/g, '<br>');
}

const renderedHtml = $derived(escapeHtml(content));
</script>

<div class="msg msg-user">
    {#if attachments.length > 0}
        <AttachmentList {attachments} {onOpenLightbox} />
    {/if}

    <div class="user-bubble">
        <div class="prose">{@html renderedHtml}</div>
    </div>
</div>

<style>
.msg-user {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	justify-content: flex-end;
}

.user-bubble {
	max-width: 85%;
	padding: var(--sp-3) var(--sp-4);
	border-radius: var(--radius-lg) var(--radius-lg) var(--sp-1) var(--radius-lg);
	background: var(--bg-user-msg);
	border: 1px solid var(--border-subtle);
}

.prose {
	font-size: 15px;
	line-height: 1.75;
	color: var(--text-primary);
	word-wrap: break-word;
	overflow-wrap: break-word;
}
</style>
