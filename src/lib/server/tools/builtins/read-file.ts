import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { z } from 'zod';
import { toolRegistry } from '../registry';

const MAX_BYTES = 100 * 1024; // 100 KB

const readFileArgsSchema = z.object({
	path: z.string().min(1).describe('Absolute path to the file'),
});

const readFileResultSchema = z.object({
	content: z.string(),
	path: z.string(),
	sizeBytes: z.number().int(),
	truncated: z.boolean(),
});

toolRegistry.register({
	name: 'read_file',
	description:
		'Read a text file from the local filesystem. Returns file contents (capped at 100 KB with a truncation note). Restricted to files under the home directory.',
	parameters: readFileArgsSchema,
	returns: readFileResultSchema,
	async execute(args) {
		const home = homedir();
		const requested = resolve(args.path);

		if (!requested.startsWith(`${home}/`) && requested !== home) {
			throw new Error('Path is outside the home directory.');
		}
		if (!existsSync(requested)) {
			throw new Error(`File not found: ${requested}`);
		}

		const stat = statSync(requested);
		if (!stat.isFile()) {
			throw new Error(`Not a regular file: ${requested}`);
		}

		const sizeBytes = stat.size;

		if (sizeBytes > MAX_BYTES) {
			const buf = readFileSync(requested);
			const content = `${buf.subarray(0, MAX_BYTES).toString('utf8')}\n\n[...truncated — file is too large]`;
			return { content, path: requested, sizeBytes, truncated: true };
		}

		const content = readFileSync(requested, 'utf8');
		return { content, path: requested, sizeBytes, truncated: false };
	},
});
