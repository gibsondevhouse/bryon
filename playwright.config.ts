import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Each Playwright run gets a fresh BRYON data dir so tests start with an empty
 * database. The dev server is started with an unreachable LLM base URL — tests
 * that exercise streaming intercept `/api/chats/:id/stream` with `page.route`.
 */
const dataDir = mkdtempSync(join(tmpdir(), 'bryon-e2e-'));

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: [['list']],
	use: {
		baseURL: 'http://127.0.0.1:5175',
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: [
		{
			command: 'node e2e/stub-ollama.mjs',
			url: 'http://127.0.0.1:39998/api/tags',
			timeout: 10_000,
			reuseExistingServer: !process.env.CI,
		},
		{
			command: 'pnpm build && PORT=5175 BRYON_PORT=5175 node build',
			url: 'http://127.0.0.1:5175',
			timeout: 120_000,
			reuseExistingServer: !process.env.CI,
			env: {
				BRYON_DATA_DIR: dataDir,
				BRYON_CONFIG: join(dataDir, 'config.toml'),
				BRYON_LLM_BASE_URL: 'http://127.0.0.1:39998',
				BRYON_PORT: '5175',
				PORT: '5175',
				HOST: '127.0.0.1',
				BODY_SIZE_LIMIT: '100M',
			},
		},
	],
});
