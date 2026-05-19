import { createRequire } from 'node:module';
import type { ExtractResult } from './txt';

const _require = createRequire(import.meta.url);
// pdf-parse is CJS-only; use createRequire for ESM compatibility.
const pdfParse = _require('pdf-parse') as (
	buffer: Buffer,
	opts?: { pagerender?: (page: { getTextContent: () => Promise<{ items: Array<{ str: string; hasEOL?: boolean }> }> }) => Promise<string> },
) => Promise<{ text: string }>;

export type PdfPage = {
	page: number;
	text: string;
};

export type PdfExtractResult = ExtractResult & {
	pages: PdfPage[];
};

export async function extractPdf(buffer: Buffer, filename: string): Promise<PdfExtractResult> {
	await pdfParse(buffer, {
		// Collect page text using the render callback so we can track page numbers.
		pagerender: renderPage,
	});

	const pages: PdfPage[] = pageTexts.map((text, i) => ({
		page: i + 1,
		text: text.replace(/\r\n/g, '\n').trim(),
	}));

	// Reset module-level state after parse.
	pageTexts.length = 0;

	// Full text for title extraction.
	const fullText = pages.map((p) => p.text).join('\n\n');
	const firstLine = fullText.split('\n').find((l) => l.trim().length > 0) ?? null;
	const title = firstLine && firstLine.length <= 120 ? firstLine.trim() : filename;

	return { title, text: fullText, pages };
}

// pdf-parse's pagerender callback is called once per page; we accumulate text here.
const pageTexts: string[] = [];

function renderPage(pageData: { getTextContent: () => Promise<{ items: Array<{ str: string; hasEOL?: boolean }> }> }): Promise<string> {
	return pageData.getTextContent().then((content) => {
		let text = '';
		for (const item of content.items) {
			text += item.str;
			if (item.hasEOL) text += '\n';
		}
		pageTexts.push(text);
		return text;
	});
}
