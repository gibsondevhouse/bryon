import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { toolRegistry } from '../registry';

const listDirArgsSchema = z.object({
	path: z.string().min(1).describe('Absolute path to the directory'),
	showHidden: z
		.boolean()
		.optional()
		.describe('Include hidden files and directories starting with "." (default: false)'),
});

const listDirResultSchema = z.object({
	entries: z.array(
		z.object({
			name: z.string(),
			type: z.enum(['file', 'directory', 'symlink', 'other']),
			sizeBytes: z.number().int().nullable(),
			modifiedAt: z.string().nullable(),
		}),
	),
	path: z.string(),
	count: z.number().int(),
});

toolRegistry.register({
	name: 'list_dir',
	description:
		'List the contents of a directory on the local filesystem. Returns entry names, types, sizes, and modification times. Restricted to directories under the home directory.',
	parameters: listDirArgsSchema,
	returns: listDirResultSchema,
	async execute(args) {
		const home = homedir();
		const requested = resolve(args.path);

		if (!requested.startsWith(`${home}/`) && requested !== home) {
			throw new Error('Path is outside the home directory.');
		}
		if (!existsSync(requested)) {
			throw new Error(`Directory not found: ${requested}`);
		}

		const stat = statSync(requested);
		if (!stat.isDirectory()) {
			throw new Error(`Not a directory: ${requested}`);
		}

		const showHidden = args.showHidden ?? false;
		const dirents = readdirSync(requested, { withFileTypes: true });

		const entries = dirents
			.filter((d) => showHidden || !d.name.startsWith('.'))
			.map((d) => {
				let type: 'file' | 'directory' | 'symlink' | 'other' = 'other';
				if (d.isFile()) type = 'file';
				else if (d.isDirectory()) type = 'directory';
				else if (d.isSymbolicLink()) type = 'symlink';

				let sizeBytes: number | null = null;
				let modifiedAt: string | null = null;

				try {
					const st = statSync(join(requested, d.name));
					sizeBytes = st.size;
					modifiedAt = st.mtime.toISOString();
				} catch {
					// ignore stat failures on inaccessible entries
				}

				return { name: d.name, type, sizeBytes, modifiedAt };
			});

		return { entries, path: requested, count: entries.length };
	},
});
