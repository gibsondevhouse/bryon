<script lang="ts">
import { marked } from 'marked';
import { sanitizeAssistantHtml } from './sanitize';
import { stabilizeMarkdown } from './streaming-markdown';
import { enhanceCodeBlocks } from './code-enhancer';
import { getCachedHighlight, highlightToHtml, isSupportedLang } from './code-highlighter';

let {
	content,
	isStreaming = false
}: {
	content: string;
	isStreaming?: boolean;
} = $props();

let proseEl: HTMLDivElement | undefined = $state();

// Custom renderer to handle streaming highlights
const renderer = new marked.Renderer();
const originalCode = renderer.code.bind(renderer);

renderer.code = function({ text, lang, escaped }: { text: string; lang?: string; escaped?: boolean }) {
    if (!lang) return originalCode({ text, lang, escaped });

    // Check global Shiki cache
    const cached = getCachedHighlight(lang, text);
    if (cached) {
        return `<div class="code-block" data-hl-done="1">
            <div class="code-header">
                <span class="code-lang">${lang}</span>
                <button type="button" class="code-copy" aria-label="Copy code">Copy</button>
            </div>
            <div class="code-body shiki-host">${cached}</div>
        </div>`;
    }

    if (isStreaming) {
        // If not cached, trigger background highlight if supported
        if (isSupportedLang(lang)) {
            // This will populate the Shiki cache asycnchronously
            void highlightToHtml(lang, text);
        }
        // Just render as raw pre/code during streaming for now
        return `<pre><code class="language-${lang}">${text}</code></pre>`;
    }

    // Not streaming, will be enhanced by enhanceCodeBlocks effect
    return originalCode({ text, lang, escaped });
};

const renderedHtml = $derived.by(() => {
	if (!content) return '';
	const source = isStreaming ? stabilizeMarkdown(content) : content;
	const html = marked.parse(source, { async: false, breaks: true, renderer }) as string;
	return sanitizeAssistantHtml(html);
});

$effect(() => {
	// Re-run on content changes; only enhance once finalized (skip during streaming).
	void renderedHtml;
	if (!proseEl || isStreaming) return;

	void enhanceCodeBlocks(proseEl);
});
</script>

<div class="prose" bind:this={proseEl} aria-live={isStreaming ? 'polite' : undefined}>{@html renderedHtml}</div>

<style>
.prose {
	min-height: 1.6em; /* 1lh fallback */
	font-size: 15px;
	line-height: 1.75;
	color: var(--text-primary);
	word-wrap: break-word;
	overflow-wrap: break-word;
}

.prose :global(p)            { margin: 0 0 var(--sp-3); }
.prose :global(p:last-child) { margin: 0; }

.prose :global(pre) {
	margin: var(--sp-4) 0;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-code);
	padding: var(--sp-4);
	overflow-x: auto;
	color: #cdd6f4;
	font-size: 13px;
	line-height: 1.6;
}

/* ── Shiki-enhanced code block (duplicated for isolation) ── */
.prose :global(.code-block) {
	margin: var(--sp-4) 0;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	overflow: hidden;
	background: #fff;
}
.prose :global(.code-block .code-header) {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-2);
	padding: 4px var(--sp-2) 4px var(--sp-3);
	border-bottom: 1px solid var(--border-subtle);
	background: var(--bg-surface);
	font-size: 11px;
	color: var(--text-muted);
	font-family: 'SF Mono', 'JetBrains Mono', ui-monospace, monospace;
}
.prose :global(.code-block .code-lang) {
	text-transform: lowercase;
	letter-spacing: 0.04em;
}
.prose :global(.code-block .code-copy) {
	border: 1px solid transparent;
	border-radius: 4px;
	background: transparent;
	color: var(--text-muted);
	font-family: inherit;
	font-size: 11px;
	padding: 2px 8px;
	cursor: pointer;
}
.prose :global(.code-block .code-copy:hover) {
	background: var(--bg-surface-hover);
	color: var(--text-primary);
}
.prose :global(.code-block .code-copy.copied) {
	color: var(--green);
}
.prose :global(.code-block .code-body) {
	overflow-x: auto;
	font-size: 13px;
	line-height: 1.55;
}
.prose :global(.code-block .code-body pre) {
	margin: 0;
	border: none;
	border-radius: 0;
	padding: var(--sp-3) var(--sp-4);
	background: #fff !important;
	color: inherit;
	font-size: 13px;
	overflow: visible;
}
.prose :global(.code-block .code-body code) {
	font-size: 13px;
	background: transparent;
	padding: 0;
	color: inherit;
}

.prose :global(code) {
	font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace;
	font-size: 0.88em;
}

.prose :global(:not(pre) > code) {
	border-radius: 5px;
	background: var(--accent-soft);
	padding: 2px 7px;
	color: var(--accent-text);
}
</style>
