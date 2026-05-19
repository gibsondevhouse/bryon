/**
 * Stabilizes partially-streamed markdown so parsers receive syntactically
 * complete input on every flush, preventing flicker in rendered output.
 *
 * Only call this during active streaming; pass through the final content
 * unchanged once the stream is complete.
 */
export function stabilizeMarkdown(content: string): string {
	let result = content;

	// --- Fenced code blocks -----------------------------------------------
	// Count triple-backtick fence openers (lines that start with ```).
	// An odd count means one fence is still open; close it so `marked` emits
	// a complete <pre><code> block instead of an unclosed one.
	const fenceMatches = result.match(/^```/gm);
	const fenceCount = fenceMatches ? fenceMatches.length : 0;
	if (fenceCount % 2 !== 0) {
		// Ensure we start on a new line before closing
		if (!result.endsWith('\n')) result += '\n';
		result += '```';
	}

	// --- Inline code spans -------------------------------------------------
	// Only check for an unterminated inline backtick when there's no open
	// fenced block (the fence check above would have sealed it already).
	if (fenceCount % 2 === 0) {
		const backtickMatches = result.match(/(?<!`)`(?!`)/g);
		const backtickCount = backtickMatches ? backtickMatches.length : 0;
		if (backtickCount % 2 !== 0) {
			result += '`';
		}
	}

	return result;
}
