import { test, expect } from '@playwright/test';

/**
 * Slash command e2e tests. Streaming endpoint stubbed so we don't depend on
 * Ollama. PATCH /api/chats/:id mocked for the /model failure scenario.
 */

function sseChunks(parts: Array<{ event: string; data: unknown }>): string {
	return parts
		.map((p) => `event: ${p.event}\ndata: ${JSON.stringify(p.data)}\n\n`)
		.join('');
}

test.beforeEach(async ({ page }) => {
	await page.route('**/api/chats/*/stream', async (route) => {
		await route.fulfill({
			status: 200,
			headers: { 'Content-Type': 'text/event-stream' },
			body: sseChunks([
				{ event: 'meta', data: { assistantId: 'stub-1', msToFirst: 5, tokensIn: 1 } },
				{ event: 'token', data: { delta: 'Hi' } },
				{ event: 'done', data: { id: 'stub-1', tokensOut: 1, msTotal: 10 } },
			]),
		});
	});
});

async function createChatAndOpen(page: import('@playwright/test').Page) {
	const response = await page.request.post('/api/chats', { data: {} });
	const { chat } = await response.json();
	await page.goto(`/chats/${chat.id}`);
	return chat.id as string;
}

test('/help renders the command help text', async ({ page }) => {
	await createChatAndOpen(page);
	const composer = page.getByPlaceholder(/Message Bryon/i);
	await composer.fill('/help');
	await composer.press('Enter');

	await expect(page.getByRole('status').first()).toContainText(/\/help/);
	await expect(page.getByRole('status').first()).toContainText(/\/new/);
	await expect(page.getByRole('status').first()).toContainText(/\/export/);
});

test('/new navigates to a freshly created chat', async ({ page }) => {
	const firstId = await createChatAndOpen(page);
	const composer = page.getByPlaceholder(/Message Bryon/i);
	await composer.fill('/new');
	await composer.press('Enter');

	await page.waitForURL(
		(url) => /\/chats\//.test(url.href) && !url.href.endsWith(firstId),
	);
});

test('/model with an unknown model surfaces an error in the feedback strip', async ({
	page,
}) => {
	await createChatAndOpen(page);

	await page.route('**/api/chats/*', async (route, request) => {
		if (request.method() === 'PATCH') {
			await route.fulfill({
				status: 400,
				contentType: 'application/json',
				body: JSON.stringify({
					error: {
						code: 'MODEL_NOT_FOUND',
						message: 'Model not found: bogusmodel123',
					},
				}),
			});
			return;
		}
		await route.fallback();
	});

	const composer = page.getByPlaceholder(/Message Bryon/i);
	await composer.fill('/model bogusmodel123');
	await composer.press('Enter');

	await expect(page.getByRole('status').first()).toContainText(
		/bogusmodel123|Model not found/i,
	);
});

test('/export triggers a markdown download', async ({ page }) => {
	await createChatAndOpen(page);

	const composer = page.getByPlaceholder(/Message Bryon/i);
	await composer.fill('Hello');
	await composer.press('Enter');
	await expect(page.getByText('Hi', { exact: true })).toBeVisible();

	const downloadPromise = page.waitForEvent('download');
	await composer.fill('/export');
	await composer.press('Enter');
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/^bryon-.*\.md$/);
});
