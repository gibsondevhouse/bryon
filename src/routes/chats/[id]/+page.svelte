<script lang="ts">
import { onMount, tick } from 'svelte';
import { page } from '$app/state';
import ChatView from '$lib/features/chat/ChatView.svelte';
import { session } from '$lib/features/streaming/session.svelte';

let { data } = $props();

$effect(() => {
	session.hydrate({
		currentChatId: data.chat.id,
		messages: data.messages,
	});
});

// Scroll to a specific message when the URL hash points at one (#msg-<id>),
// e.g. when jumping from the search panel.
$effect(() => {
	const hash = page.url.hash;
	if (!hash?.startsWith('#msg-')) return;
	const id = hash.slice(1);
	void tick().then(() => {
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			el.classList.add('msg-flash');
			setTimeout(() => el.classList.remove('msg-flash'), 1600);
		}
	});
});

onMount(() => {
	function handleKeydown(event: KeyboardEvent) {
		// Cmd+N — new chat
		if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
			event.preventDefault();
			session.createChat().then((id) => {
				if (id) window.location.href = `/chats/${id}`;
			});
		}
	}

	window.addEventListener('keydown', handleKeydown);
	return () => window.removeEventListener('keydown', handleKeydown);
});
</script>

<svelte:head>
	<title>{data.chat.title} — Bryon</title>
</svelte:head>

<ChatView
	chatId={data.chat.id}
/>
