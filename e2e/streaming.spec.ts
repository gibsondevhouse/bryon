import { test, expect } from '@playwright/test';

/**
 * The /api/chats/:id/stream endpoint is intercepted with a fake SSE stream so
 * these tests do not depend on a running Ollama instance.
 *
 * NOTE: With the route mocked client-side, the real endpoint never runs, so
 * messages are not persisted to the DB. Persistence is covered by the
 * server-side unit/integration tests (PromptBuilder + ChatService).
 */

function sseChunks(parts: Array<{ event: string; data: unknown }>): string {
	return parts
		.map((p) => `event: ${p.event}\ndata: ${JSON.stringify(p.data)}\n\n`)
		.join('');
}

test.beforeEach(async ({ page }) => {
	await page.route('**/api/chats/*/stream', async (route) => {
		const body =
			sseChunks([
				{ event: 'token', data: { delta: 'Hello' } },
				{ event: 'token', data: { delta: ' world' } },
				{ event: 'token', data: { delta: '!' } },
				{ event: 'meta', data: { msToFirst: 5, tokensIn: 3 } },
				{
					event: 'done',
					data: { id: 'fake-id', tokensOut: 3, msTotal: 50 },
				},
			]);
		await route.fulfill({
			status: 200,
			headers: { 'Content-Type': 'text/event-stream' },
			body,
		});
	});
});

async function createChatAndOpen(page: import('@playwright/test').Page) {
	const response = await page.request.post('/api/chats', {
		data: {},
	});
	const { chat } = await response.json();
	await page.goto(`/chats/${chat.id}`);
	return chat.id as string;
}

test('streaming flow: type → send → tokens appear', async ({ page }) => {
	await createChatAndOpen(page);

	const composer = page.getByPlaceholder(/Message Bryon/i);
	await composer.fill('Hi there');
	await composer.press('Enter');

	await expect(page.getByText('Hello world!')).toBeVisible();
});

test('/new slash command creates a fresh chat', async ({ page }) => {
	const firstId = await createChatAndOpen(page);

	const composer = page.getByPlaceholder(/Message Bryon/i);
	await composer.fill('/new');
	await composer.press('Enter');

	await page.waitForURL(
		(url) => /\/chats\//.test(url.href) && !url.href.endsWith(firstId),
	);
});

test('/help shows command feedback', async ({ page }) => {
	await createChatAndOpen(page);

	const composer = page.getByPlaceholder(/Message Bryon/i);
	await composer.fill('/help');
	await composer.press('Enter');

	await expect(page.getByRole('status').first()).toContainText(/\/new.*\/clear.*\/model/);
});

test('error event surfaces error row with Retry, retry recovers', async ({ page }) => {
	let callCount = 0;
	await page.unroute('**/api/chats/*/stream');
	await page.route('**/api/chats/*/stream', async (route) => {
		callCount += 1;
		const body =
			callCount === 1
				? sseChunks([
						{
							event: 'error',
							data: {
								code: 'MODEL_NOT_FOUND',
								model: 'gemma3:4b',
								message: 'Model not found',
							},
						},
					])
				: sseChunks([
						{ event: 'token', data: { delta: 'Recovered' } },
						{ event: 'meta', data: { msToFirst: 5, tokensIn: 3 } },
						{ event: 'done', data: { id: 'retry-id', tokensOut: 1, msTotal: 10 } },
					]);
		await route.fulfill({
			status: 200,
			headers: { 'Content-Type': 'text/event-stream' },
			body,
		});
	});

	await createChatAndOpen(page);

	const composer = page.getByPlaceholder(/Message Bryon/i);
	await composer.fill('Try this');
	await composer.press('Enter');

	await expect(page.getByText(/Model not found/)).toBeVisible();
	const retry = page.getByRole('button', { name: /Retry/i });
	await expect(retry).toBeVisible();
	await retry.click();

	await expect(page.getByText('Recovered')).toBeVisible();
});
