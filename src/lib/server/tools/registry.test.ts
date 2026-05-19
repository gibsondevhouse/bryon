import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from './registry';

function makeRegistry() {
	return new ToolRegistry();
}

function tool(name: string) {
	return {
		name,
		description: `desc-${name}`,
		parameters: z.object({}),
		returns: z.object({}),
		async execute() {
			return {};
		},
	};
}

function paramTool(name: string) {
	return {
		name,
		description: `greet`,
		parameters: z.object({
			username: z.string().describe('The user to greet'),
			count: z.number().int().optional(),
		}),
		returns: z.object({ greeting: z.string() }),
		async execute({ username }: { username: string }) {
			return { greeting: `Hello, ${username}!` };
		},
	};
}

describe('ToolRegistry', () => {
	describe('register / get', () => {
		it('retrieves a registered tool by name', () => {
			const reg = makeRegistry();
			reg.register(tool('alpha'));
			expect(reg.get('alpha')).toBeDefined();
			expect(reg.get('alpha')?.name).toBe('alpha');
		});

		it('returns undefined for an unknown name', () => {
			const reg = makeRegistry();
			expect(reg.get('missing')).toBeUndefined();
		});

		it('overwrites an existing registration with the same name', () => {
			const reg = makeRegistry();
			reg.register({ ...tool('x'), description: 'first' });
			reg.register({ ...tool('x'), description: 'second' });
			expect(reg.get('x')?.description).toBe('second');
		});
	});

	describe('list()', () => {
		it('returns only tools whose names appear in the allowlist', () => {
			const reg = makeRegistry();
			reg.register(tool('a'));
			reg.register(tool('b'));
			reg.register(tool('c'));
			const listed = reg.list(['a', 'c']);
			expect(listed.map((t) => t.name)).toEqual(['a', 'c']);
		});

		it('silently skips allowlist entries with no matching registration', () => {
			const reg = makeRegistry();
			reg.register(tool('a'));
			const listed = reg.list(['a', 'ghost']);
			expect(listed).toHaveLength(1);
			expect(listed[0].name).toBe('a');
		});

		it('returns empty array when allowlist is empty', () => {
			const reg = makeRegistry();
			reg.register(tool('a'));
			expect(reg.list([])).toHaveLength(0);
		});

		it('returns empty array when registry is empty', () => {
			const reg = makeRegistry();
			expect(reg.list(['a', 'b'])).toHaveLength(0);
		});
	});

	describe('toOllamaSchema()', () => {
		it('produces one function entry per allowed tool', () => {
			const reg = makeRegistry();
			reg.register(tool('t1'));
			reg.register(tool('t2'));
			const schema = reg.toOllamaSchema(['t1', 't2']);
			expect(schema).toHaveLength(2);
			expect(schema.map((s) => s.function.name).sort()).toEqual(['t1', 't2']);
		});

		it('sets type: "function" on every entry', () => {
			const reg = makeRegistry();
			reg.register(tool('t'));
			const [entry] = reg.toOllamaSchema(['t']);
			expect(entry?.type).toBe('function');
		});

		it('includes description in the function entry', () => {
			const reg = makeRegistry();
			reg.register(tool('t'));
			const [entry] = reg.toOllamaSchema(['t']);
			expect(entry?.function.description).toBe('desc-t');
		});

		it('serialises Zod parameters to JSON Schema object', () => {
			const reg = makeRegistry();
			reg.register(paramTool('greet'));
			const [entry] = reg.toOllamaSchema(['greet']);
			const params = entry?.function.parameters as Record<string, unknown>;
			expect(params.type).toBe('object');
			const props = params.properties as Record<string, unknown>;
			expect(props).toHaveProperty('username');
			expect(props).toHaveProperty('count');
		});

		it('omits $schema key from serialised parameters', () => {
			const reg = makeRegistry();
			reg.register(paramTool('greet'));
			const [entry] = reg.toOllamaSchema(['greet']);
			expect(entry?.function.parameters).not.toHaveProperty('$schema');
		});

		it('returns empty array when nothing is allowed', () => {
			const reg = makeRegistry();
			reg.register(tool('t'));
			expect(reg.toOllamaSchema([])).toHaveLength(0);
		});
	});

	describe('names()', () => {
		it('returns all registered names in alphabetical order', () => {
			const reg = makeRegistry();
			for (const n of ['zebra', 'alpha', 'mango']) reg.register(tool(n));
			expect(reg.names()).toEqual(['alpha', 'mango', 'zebra']);
		});

		it('returns empty array when nothing is registered', () => {
			expect(makeRegistry().names()).toEqual([]);
		});
	});
});
