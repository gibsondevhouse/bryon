export type ExtractResult = {
	title: string | null;
	text: string;
};

export function extractTxt(content: string, filename: string): ExtractResult {
	const text = content.replace(/\r\n/g, '\n').trim();
	// Use the first non-empty line as title fallback.
	const firstLine = text.split('\n').find((l) => l.trim().length > 0) ?? null;
	const title = firstLine && firstLine.length <= 120 ? firstLine.trim() : filename;
	return { title, text };
}
