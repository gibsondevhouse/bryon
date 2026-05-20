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

	// --- Tables -----------------------------------------------------------
	// If a row starts with | and is not closed with |, close it.
	// This prevents the whole table from disappearing until the row is done.
	const lines = result.split('\n');
	const lastLine = lines[lines.length - 1] ?? '';
	if (lastLine.trim().startsWith('|') && !lastLine.trim().endsWith('|')) {
		result += ' |';
	}

	// --- Lists ------------------------------------------------------------
	// Orphan '- ' or '* ' or '1. ' at end of buffer -> drop it temporarily
	// so we don't render a list item without content.
	if (result.endsWith('\n- ') || result.endsWith('\n* ') || result.match(/\n\d+\. $/)) {
		const lastSpace = result.lastIndexOf(' ');
		result = result.slice(0, lastSpace + 1); // remove the marker? No, instructions said drop partial link/marker
		// Actually, инструкция says: "orphan - at end of buffer -> drop until next token"
		// If I drop it, marked won't see it.
		// Let's re-read: "drop partial link until closing arrives; drop orphan - at end of buffer"
		if (result.endsWith('\n- ')) result = result.slice(0, -2);
		else if (result.endsWith('\n* ')) result = result.slice(0, -2);
		else {
			const match = result.match(/\n\d+\. $/);
			if (match) result = result.slice(0, -match[0].length + 1);
		}
	}

	// --- Links ------------------------------------------------------------
	// Trailing [text](http -> drop the partial link until closing ) arrives
	const linkMatch = result.match(/\[[^\]]*\]\((https?:\/\/[^)]*)$/);
	if (linkMatch) {
		result = result.slice(0, -linkMatch[0].length);
	}

	return result;
}
