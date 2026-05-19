/**
 * Slash-command parsing for the composer.
 *
 * Pure function: only inspects the raw input and returns a structured
 * descriptor. Side effects (navigation, API calls, downloads) are the
 * responsibility of the caller.
 */

export type SlashCommandName =
	| 'help'
	| 'new'
	| 'clear'
	| 'model'
	| 'export';

export const knownCommands: readonly SlashCommandName[] = [
	'help',
	'new',
	'clear',
	'model',
	'export',
] as const;

export type ParsedCommand =
	| { kind: 'none' }
	| { kind: 'known'; name: SlashCommandName; args: string }
	| { kind: 'unknown'; name: string };

export function parseCommand(input: string): ParsedCommand {
	const trimmed = input.trim();
	if (!trimmed.startsWith('/')) return { kind: 'none' };

	const body = trimmed.slice(1);
	if (body.length === 0) return { kind: 'unknown', name: '' };

	const parts = body.split(/\s+/);
	const name = (parts[0] ?? '').toLowerCase();
	const args = parts.slice(1).join(' ');

	if ((knownCommands as readonly string[]).includes(name)) {
		return { kind: 'known', name: name as SlashCommandName, args };
	}
	return { kind: 'unknown', name };
}

export const helpText =
	'Commands: /new, /clear, /model [name], /export, /help';
