import type { ExtractResult } from './txt';

// Strips markdown syntax to produce clean prose for embedding.
export function extractMd(content: string, filename: string): ExtractResult {
	const normalized = content.replace(/\r\n/g, '\n').trim();

	// Extract title from first ATX heading or frontmatter title field.
	const title = extractTitle(normalized) ?? filename;

	// Strip frontmatter, then strip markdown syntax.
	const body = stripFrontmatter(normalized);
	const text = stripMarkdown(body).trim();

	return { title, text: text || normalized };
}

function extractTitle(content: string): string | null {
	// frontmatter title: ...
	const fmMatch = content.match(/^---\s*\n(?:.*\n)*?title:\s*["']?(.+?)["']?\s*\n/m);
	if (fmMatch?.[1]) return fmMatch[1].trim();

	// First # heading
	const headingMatch = content.match(/^#\s+(.+)$/m);
	if (headingMatch?.[1]) return headingMatch[1].trim();

	return null;
}

function stripFrontmatter(content: string): string {
	return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
}

function stripMarkdown(text: string): string {
	return text
		// Remove code fences
		.replace(/```[\s\S]*?```/g, '')
		.replace(/`[^`]+`/g, (m) => m.slice(1, -1))
		// Remove images
		.replace(/!\[.*?\]\(.*?\)/g, '')
		// Convert links to text
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		// Remove ATX headings markers, keep text
		.replace(/^#{1,6}\s+/gm, '')
		// Remove bold/italic
		.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
		.replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
		// Remove blockquote markers
		.replace(/^>\s?/gm, '')
		// Remove horizontal rules
		.replace(/^[-*_]{3,}\s*$/gm, '')
		// Remove list markers
		.replace(/^[\s]*[-*+]\s+/gm, '')
		.replace(/^[\s]*\d+\.\s+/gm, '')
		// Collapse multiple blank lines
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
