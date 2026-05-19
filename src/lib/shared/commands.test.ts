import { describe, expect, it } from 'vitest';
import { parseCommand, knownCommands } from './commands';

describe('parseCommand', () => {
	it('returns kind=none for non-slash input', () => {
		expect(parseCommand('hello there').kind).toBe('none');
		expect(parseCommand('  hello there').kind).toBe('none');
		expect(parseCommand('').kind).toBe('none');
	});

	it('returns kind=unknown for a lone slash', () => {
		const result = parseCommand('/');
		expect(result).toEqual({ kind: 'unknown', name: '' });
	});

	it('parses each known command without args', () => {
		for (const name of knownCommands) {
			const result = parseCommand(`/${name}`);
			expect(result).toEqual({ kind: 'known', name, args: '' });
		}
	});

	it('lower-cases the command name', () => {
		const result = parseCommand('/HELP');
		expect(result).toEqual({ kind: 'known', name: 'help', args: '' });
	});

	it('collapses internal whitespace in args', () => {
		const result = parseCommand('/model   llama3:8b');
		expect(result).toEqual({ kind: 'known', name: 'model', args: 'llama3:8b' });
	});

	it('flags removed persona/tools commands as unknown', () => {
		expect(parseCommand('/persona Coder')).toEqual({ kind: 'unknown', name: 'persona' });
		expect(parseCommand('/tools')).toEqual({ kind: 'unknown', name: 'tools' });
	});

	it('trims leading/trailing whitespace', () => {
		const result = parseCommand('   /new   ');
		expect(result).toEqual({ kind: 'known', name: 'new', args: '' });
	});

	it('flags unknown commands', () => {
		const result = parseCommand('/wat is going on');
		expect(result).toEqual({ kind: 'unknown', name: 'wat' });
	});
});
