import type { ExtractResult } from './txt';

export function extractHtml(content: string, filename: string): ExtractResult {
	const normalized = content.replace(/\r\n/g, '\n');
	const title = extractTitle(normalized) ?? filename;
	const text = htmlToText(normalized).trim();
	return { title, text: text || normalized };
}

function extractTitle(html: string): string | null {
	const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
	if (titleMatch?.[1]) return titleMatch[1].trim();

	const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
	if (h1Match?.[1]) return stripTags(h1Match[1]).trim();

	return null;
}

function htmlToText(html: string): string {
	// Remove script and style blocks entirely.
	let text = html
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<style[\s\S]*?<\/style>/gi, '');

	// Convert headings to text with newlines before and after.
	text = text.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, inner) => {
		return `\n${stripTags(inner).trim()}\n`;
	});

	// Convert block elements to newlines.
	text = text.replace(/<\/?(p|div|section|article|header|footer|main|nav|aside|li|dt|dd|blockquote|pre|tr)[^>]*>/gi, '\n');

	// Convert <br> to newline.
	text = text.replace(/<br\s*\/?>/gi, '\n');

	// Decode common HTML entities.
	text = stripTags(text)
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'");

	// Collapse multiple blank lines.
	text = text.replace(/\n{3,}/g, '\n\n');

	return text.trim();
}

function stripTags(html: string): string {
	return html.replace(/<[^>]+>/g, '');
}
