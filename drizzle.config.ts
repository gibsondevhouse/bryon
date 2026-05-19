import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'drizzle-kit';

const dataDir =
	process.env.BRYON_DATA_DIR ?? join(homedir(), '.local/share/bryon');

mkdirSync(dataDir, { recursive: true });

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './src/lib/server/db/migrations',
	dialect: 'sqlite',
	dbCredentials: {
		url: join(dataDir, 'bryon.db'),
	},
});
