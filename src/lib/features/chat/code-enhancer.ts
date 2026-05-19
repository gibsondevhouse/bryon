import { highlightToHtml, isSupportedLang } from './code-highlighter';

const ENHANCED_FLAG = 'data-hl-done';
const COPIED_LABEL_MS = 1400;

function extractLang(codeEl: HTMLElement): string {
	const classes = codeEl.className.split(/\s+/);
	for (const cls of classes) {
		if (cls.startsWith('language-')) return cls.slice('language-'.length);
	}
	return '';
}

function buildHeader(lang: string, getCode: () => string): HTMLDivElement {
	const header = document.createElement('div');
	header.className = 'code-header';

	const label = document.createElement('span');
	label.className = 'code-lang';
	label.textContent = lang || 'text';
	header.appendChild(label);

	const copyBtn = document.createElement('button');
	copyBtn.type = 'button';
	copyBtn.className = 'code-copy';
	copyBtn.setAttribute('aria-label', 'Copy code');
	copyBtn.textContent = 'Copy';
	copyBtn.addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(getCode());
			const prev = copyBtn.textContent;
			copyBtn.textContent = 'Copied';
			copyBtn.classList.add('copied');
			setTimeout(() => {
				copyBtn.textContent = prev ?? 'Copy';
				copyBtn.classList.remove('copied');
			}, COPIED_LABEL_MS);
		} catch {
			// silent — clipboard may be unavailable
		}
	});
	header.appendChild(copyBtn);

	return header;
}

/**
 * Walks the assistant prose and replaces each <pre><code class="language-X">
 * with a syntax-highlighted block (via Shiki) plus a copy button.
 *
 * Idempotent — re-processing a node leaves it untouched after the first run.
 * Falls back to the unstyled block if the language is unknown.
 */
export async function enhanceCodeBlocks(root: HTMLElement): Promise<void> {
	const blocks = Array.from(root.querySelectorAll<HTMLPreElement>('pre')).filter(
		(pre) => !pre.hasAttribute(ENHANCED_FLAG),
	);

	for (const pre of blocks) {
		const codeEl = pre.querySelector<HTMLElement>('code');
		if (!codeEl) {
			pre.setAttribute(ENHANCED_FLAG, '1');
			continue;
		}
		const lang = extractLang(codeEl);
		const raw = codeEl.textContent ?? '';

		const wrapper = document.createElement('div');
		wrapper.className = 'code-block';
		wrapper.appendChild(buildHeader(lang, () => raw));

		if (lang && isSupportedLang(lang)) {
			const html = await highlightToHtml(lang, raw);
			if (html) {
				const body = document.createElement('div');
				body.className = 'code-body shiki-host';
				body.innerHTML = html;
				wrapper.appendChild(body);
			} else {
				wrapper.appendChild(pre.cloneNode(true));
			}
		} else {
			wrapper.appendChild(pre.cloneNode(true));
		}

		wrapper.setAttribute(ENHANCED_FLAG, '1');
		pre.replaceWith(wrapper);
	}
}
