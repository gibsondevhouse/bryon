<script lang="ts">
import { ExternalLink } from '@lucide/svelte';
import type { NewsArticle } from '$lib/shared/stream-events';

let { articles }: { articles: NewsArticle[] } = $props();

function domain(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}
</script>

<div class="carousel-wrap">
	<div class="carousel-label">Related articles</div>
	<div class="carousel">
		{#each articles as article (article.url)}
			{@const isSourceLabel = article.snippet.length < 80}
			<a
				class="card"
				href={article.url}
				target="_blank"
				rel="noopener noreferrer"
				title={article.title}
			>
				<div class="card-title">{article.title}</div>
				{#if !isSourceLabel}
					<div class="card-snippet">{article.snippet}</div>
				{/if}
				<div class="card-footer">
					<span class="card-domain">{isSourceLabel ? article.snippet : domain(article.url)}</span>
					<ExternalLink size={11} class="card-icon" />
				</div>
			</a>
		{/each}
	</div>
</div>

<style>
.carousel-wrap {
	margin-top: var(--sp-4);
	padding-top: var(--sp-4);
	border-top: 1px solid var(--border-subtle);
}

.carousel-label {
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--text-muted);
	margin-bottom: var(--sp-3);
}

.carousel {
	display: flex;
	gap: var(--sp-3);
	overflow-x: auto;
	padding-bottom: var(--sp-1);
	scrollbar-width: thin;
	scrollbar-color: var(--border-default) transparent;
}

.card {
	flex: 0 0 220px;
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
	padding: var(--sp-3) var(--sp-3);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-sm);
	background: var(--bg-surface);
	text-decoration: none;
	color: inherit;
	transition: border-color 120ms ease, background 120ms ease;
}

.card:hover {
	border-color: var(--border-default);
	background: var(--bg-surface-hover);
}

.card-title {
	font-size: 13px;
	font-weight: 600;
	color: var(--text-primary);
	line-height: 1.4;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.card-snippet {
	font-size: 12px;
	color: var(--text-secondary);
	line-height: 1.5;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
	flex: 1;
}

.card-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-2);
	margin-top: auto;
}

.card-domain {
	font-size: 11px;
	color: var(--text-muted);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

:global(.card-icon) {
	color: var(--text-muted);
	flex-shrink: 0;
}
</style>
