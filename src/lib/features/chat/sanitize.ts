import DOMPurify from 'dompurify';

let hooksRegistered = false;

function registerHooks(): void {
	if (hooksRegistered) return;
	hooksRegistered = true;

	// Force external links to open safely in a new tab.
	DOMPurify.addHook('afterSanitizeAttributes', (node) => {
		if (node.tagName === 'A') {
			const el = node as HTMLAnchorElement;
			const href = el.getAttribute('href') ?? '';
			const isExternal = /^https?:\/\//i.test(href);
			if (isExternal) {
				el.setAttribute('target', '_blank');
				el.setAttribute('rel', 'noopener noreferrer');
			}
		}
	});
}

/**
 * Sanitize assistant-generated HTML produced by `marked.parse()`.
 *
 * Allowlist covers standard markdown output: paragraphs, headings, lists,
 * inline emphasis, links, code blocks, blockquotes, tables, and horizontal
 * rules. Strips scripts, iframes, inline styles, event handlers, and any
 * `javascript:` URLs. External `<a>` links are forced to `target="_blank"`
 * with `rel="noopener noreferrer"`.
 */
export function sanitizeAssistantHtml(html: string): string {
	registerHooks();
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [
			'a',
			'b',
			'blockquote',
			'br',
			'code',
			'em',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'hr',
			'i',
			'li',
			'ol',
			'p',
			'pre',
			'span',
			'strong',
			'table',
			'tbody',
			'td',
			'th',
			'thead',
			'tr',
			'ul',
		],
		ALLOWED_ATTR: ['href', 'title', 'class', 'rel', 'target'],
		ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
		FORBID_ATTR: ['style', 'srcset', 'on*'],
	});
}
