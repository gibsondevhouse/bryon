export function countTokens(text: string): number {
	if (!text) return 0;
	return Math.ceil(text.length / 4);
}

export function countMessageTokens(
	messages: Array<{ content: string }>,
): number {
	return messages.reduce(
		(total, message) => total + countTokens(message.content),
		0,
	);
}
