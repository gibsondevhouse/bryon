<script lang="ts">
import '../app.css';
import { onMount, untrack } from 'svelte';
import favicon from '$lib/assets/favicon.svg';
import { page } from '$app/state';
import { PanelLeft } from '@lucide/svelte';
import HealthBanner from '$lib/components/HealthBanner.svelte';
import Sidebar from '$lib/features/sidebar/Sidebar.svelte';
import ShortcutsModal from '$lib/features/chat/ShortcutsModal.svelte';
import ChatSwitcher from '$lib/features/chat/ChatSwitcher.svelte';
import SearchPanel from '$lib/features/chat/SearchPanel.svelte';
import ActivityPanel from '$lib/features/chat/ActivityPanel.svelte';
import ToastContainer from '$lib/components/ToastContainer.svelte';
import { session } from '$lib/features/streaming/session.svelte';

let { data, children } = $props();

let isMobile = $state(false);
let sidebarOpen = $state(false);
let shortcutsOpen = $state(false);
let switcherOpen = $state(false);
let searchOpen = $state(false);
let healthReachable = $state(true);
let healthRetrying = $state(false);
let healthRetryError = $state<string | null>(null);
let hasViewportSynced = $state(false);

const currentChatId = $derived(page.params?.id ?? null);

$effect(() => {
	untrack(() => {
		session.hydrate({
			chats: data.chats,
			projects: data.projects,
			settings: data.settings,
			ollamaReachable: healthReachable,
		});
	});
});

$effect(() => {
	healthReachable = data.ollamaReachable;
});

$effect(() => {
	void session.refreshModels();
});

onMount(() => {
	const media = window.matchMedia('(max-width: 768px)');
	const syncViewport = (mobile: boolean): void => {
		isMobile = mobile;
		sidebarOpen = !mobile;
		hasViewportSynced = true;
	};

	syncViewport(media.matches);

	const onChange = (event: MediaQueryListEvent): void => {
		syncViewport(event.matches);
	};

	media.addEventListener('change', onChange);
	void probeHealth(false);
	return () => {
		media.removeEventListener('change', onChange);
	};
});

$effect(() => {
	page.url.pathname;
	if (!hasViewportSynced || !isMobile) return;
	sidebarOpen = false;
});

function closeSidebar(): void {
	sidebarOpen = false;
}

function openSidebar(): void {
	sidebarOpen = true;
}

function toggleSidebar(): void {
	if (sidebarOpen) closeSidebar();
	else openSidebar();
}

async function retryHealth(): Promise<void> {
	if (healthRetrying) return;
	healthRetrying = true;
	healthRetryError = null;

	await probeHealth(true);
	healthRetrying = false;
}

async function probeHealth(showRetryError: boolean): Promise<void> {
	try {
		const response = await fetch('/api/health');
		if (!response.ok) {
			if (showRetryError) {
				healthRetryError = `Health check failed (HTTP ${response.status}).`;
			}
			return;
		}

		const body = (await response.json()) as {
			ollama?: boolean;
			ollamaState?: 'unknown' | 'ready' | 'unreachable';
		};
		healthReachable = body.ollama ?? body.ollamaState === 'ready';
		session.ollamaReachable = healthReachable;
		if (showRetryError && !healthReachable) {
			healthRetryError = 'Still unreachable. Make sure `ollama serve` is running.';
		}
	} catch (error) {
		if (showRetryError) {
			healthRetryError = (error as Error).message || 'Retry failed.';
		}
	}
}

function onGlobalKey(e: KeyboardEvent): void {
	const mod = e.metaKey || e.ctrlKey;
	if (!mod) return;
	// Cmd+/ → shortcuts modal
	if (e.key === '/' && !e.shiftKey) {
		e.preventDefault();
		shortcutsOpen = !shortcutsOpen;
		return;
	}
	// Cmd+K → chat switcher
	if ((e.key === 'k' || e.key === 'K') && !e.shiftKey && !e.altKey) {
		e.preventDefault();
		switcherOpen = !switcherOpen;
		return;
	}
	// Cmd+Shift+F → search panel
	if ((e.key === 'f' || e.key === 'F') && e.shiftKey && !e.altKey) {
		e.preventDefault();
		searchOpen = !searchOpen;
		return;
	}
	// Cmd+L → focus composer (dispatch event picked up by chat page)
	if ((e.key === 'l' || e.key === 'L') && !e.shiftKey && !e.altKey) {
		const target = e.target as HTMLElement | null;
		const tag = target?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return;
		e.preventDefault();
		window.dispatchEvent(new CustomEvent('bryon:focus-composer'));
	}
}
</script>

<svelte:window onkeydown={onGlobalKey} />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app" class:sidebar-open={sidebarOpen} class:activity-open={session.activityPanelOpen}>
	<aside class="sidebar-rail">
		<Sidebar
			settings={data.settings}
			{currentChatId}
			ollamaReachable={healthReachable}
			onToggle={toggleSidebar}
		/>
	</aside>

	{#if isMobile && sidebarOpen}
		<button class="backdrop" type="button" aria-label="Close sidebar" onclick={closeSidebar}></button>
	{/if}

	<main class="main">
		{#if !sidebarOpen}
			<header class="main-header">
				<button class="open-btn" type="button" onclick={openSidebar} title="Open sidebar" aria-label="Open sidebar">
					<PanelLeft size={18} />
				</button>
			</header>
		{/if}

		{#if !healthReachable}
			<div class="banner-wrap">
				<HealthBanner
					reachable={healthReachable}
					baseUrl={data.settings.llm.base_url}
					showRetry={true}
					retrying={healthRetrying}
					errorMessage={healthRetryError}
					onRetry={retryHealth}
					compact={true}
				/>
			</div>
		{/if}

		<div class="content" class:is-chat={!!currentChatId}>
			{@render children()}
		</div>
	</main>

	<aside class="activity-rail">
		<ActivityPanel />
	</aside>
</div>

<ShortcutsModal bind:open={shortcutsOpen} />
<ChatSwitcher bind:open={switcherOpen} chats={data.chats} />
<SearchPanel bind:open={searchOpen} />
<ToastContainer />

<style>
/* ── Shell ── */
.app {
	display: grid;
	height: 100dvh;
	grid-template-columns: 0 minmax(0, 1fr) 0;
	grid-template-rows: minmax(0, 1fr);
	overflow: hidden;
	transition: grid-template-columns var(--motion-slow);
	--activity-w: 380px;
}

.app.sidebar-open {
	grid-template-columns: var(--sidebar-w) minmax(0, 1fr) 0;
}

.app.activity-open {
	grid-template-columns: 0 minmax(0, 1fr) var(--activity-w);
}

.app.sidebar-open.activity-open {
	grid-template-columns: var(--sidebar-w) minmax(0, 1fr) var(--activity-w);
}

/* ── Activity rail ── */
.activity-rail {
	overflow: hidden;
	background: var(--bg-base);
}

/* ── Sidebar rail ── */
.sidebar-rail {
	overflow: hidden;
	background: var(--bg-base);
}

/* ── Main ── */
.main {
	position: relative;
	display: flex;
	flex-direction: column;
	min-width: 0;
	background: var(--bg-base);
}

.main-header {
	display: flex;
	align-items: center;
	padding: var(--sp-2) var(--sp-4);
}

.content {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-height: 0;
	overflow: auto;
	padding: var(--sp-6);
}

.content.is-chat {
	padding: 0;
	overflow: hidden;
}

/* ── Open sidebar button ── */
.open-btn {
	display: grid;
	place-items: center;
	width: 36px;
	height: 36px;
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	transition:
		color var(--motion-fast),
		background var(--motion-fast);
}

.open-btn:hover {
	color: var(--text-primary);
	background: var(--bg-surface-hover);
}

.banner-wrap {
	margin: 0 var(--sp-4) var(--sp-2);
}

/* ── Mobile ── */
@media (max-width: 768px) {
	.app {
		grid-template-columns: minmax(0, 1fr);
	}

	.app.sidebar-open,
	.app.activity-open,
	.app.sidebar-open.activity-open {
		grid-template-columns: minmax(0, 1fr);
	}

	.activity-rail {
		position: fixed;
		inset: 0 0 0 auto;
		z-index: 50;
		width: min(90vw, 360px);
		transform: translateX(100%);
		transition: transform var(--motion-slow);
		box-shadow: var(--shadow-lg);
	}

	.app.activity-open .activity-rail {
		transform: translateX(0);
	}

	.sidebar-rail {
		position: fixed;
		inset: 0 auto 0 0;
		z-index: 50;
		width: var(--sidebar-w);
		transform: translateX(-100%);
		transition: transform var(--motion-slow);
		box-shadow: var(--shadow-lg);
	}

	.app.sidebar-open .sidebar-rail {
		transform: translateX(0);
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: var(--bg-overlay);
		border: 0;
		padding: 0;
		margin: 0;
		cursor: default;
	}

	.content {
		padding: var(--sp-4);
	}
}
</style>
