import { expect, test } from '@playwright/test';

function sseChunks(parts: Array<{ event: string; data: unknown }>): string {
	return parts
		.map((part) => `event: ${part.event}\ndata: ${JSON.stringify(part.data)}\n\n`)
		.join('');
}

async function createChatAndOpen(page: import('@playwright/test').Page): Promise<string> {
	const response = await page.request.post('/api/chats', { data: {} });
	const { chat } = (await response.json()) as { chat: { id: string } };
	await page.goto(`/chats/${chat.id}`);
	return chat.id;
}

async function clearAllChats(page: import('@playwright/test').Page): Promise<void> {
	const response = await page.request.get('/api/chats?limit=200');
	if (!response.ok) return;

	const body = (await response.json()) as { chats?: Array<{ id: string }> };
	for (const chat of body.chats ?? []) {
		await page.request.delete(`/api/chats/${chat.id}`);
	}
}

test('mobile shell defaults to content-first and sidebar toggles cleanly', async ({ page }) => {
	const chatId = await createChatAndOpen(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`/chats/${chatId}`);

	const openSidebar = page.getByRole('button', { name: 'Open sidebar' });
	await expect(openSidebar).toBeVisible();

	await openSidebar.click();
	await expect(page.locator('.sidebar-rail button[aria-label="Close sidebar"]')).toBeVisible();

	await page.locator('.sidebar-rail button[aria-label="Close sidebar"]').click();
	await expect(openSidebar).toBeVisible();
});

test('keyboard overlays open/close and focus returns to composer', async ({ page }) => {
	await createChatAndOpen(page);

	const composer = page.getByPlaceholder(/Message Bryon/i);
	await composer.click();

	await page.keyboard.press('Control+/');
	await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeHidden();
	await expect(composer).toBeFocused();

	await page.keyboard.press('Control+K');
	const switcherInput = page.getByPlaceholder('Search chats...');
	await expect(switcherInput).toBeVisible();
	await expect(switcherInput).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(switcherInput).toBeHidden();
	await expect(composer).toBeFocused();

	await page.keyboard.press('Control+Shift+F');
	const searchInput = page.getByPlaceholder('Search messages...');
	await expect(searchInput).toBeVisible();
	await expect(searchInput).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(searchInput).toBeHidden();
	await expect(composer).toBeFocused();
});

test('health failure disables composer and shows one coherent app banner', async ({ page }) => {
	await page.route('**/api/health', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				db: true,
				ollama: false,
				model: { name: 'gemma3:4b', present: false },
				config: { path: '/tmp/config.toml', parseError: null },
			}),
		});
	});

	await createChatAndOpen(page);

	await expect(page.getByTestId('ollama-health-banner')).toBeVisible();
	await expect(page.getByPlaceholder(/Message Bryon/i)).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
});

test('long-thread virtualization keeps DOM bounded and scroll interactions fast', async ({ page }) => {
	await page.route('**/api/chats/*/stream', async (route) => {
		await route.fulfill({
			status: 200,
			headers: { 'Content-Type': 'text/event-stream' },
			body: sseChunks([
				{ event: 'meta', data: { assistantId: `stub-${Date.now()}`, msToFirst: 5, tokensIn: 12 } },
				{ event: 'token', data: { delta: 'Ack' } },
				{ event: 'done', data: { id: `stub-${Date.now()}`, tokensOut: 1, msTotal: 15 } },
			]),
		});
	});

	await createChatAndOpen(page);
	const composer = page.getByPlaceholder(/Message Bryon/i);
	const assistantMessages = page.locator('.msg-assistant');
	const stopButton = page.getByRole('button', { name: 'Stop generating' });

	for (let i = 0; i < 26; i += 1) {
		await composer.fill(`message-${i}`);
		await composer.press('Enter');
		await expect(stopButton).toBeHidden({ timeout: 3_000 });
		await expect(assistantMessages.first()).toBeVisible();
	}

	const sanity = await page.evaluate(() => {
		const list = document.querySelector('.list') as HTMLDivElement | null;
		if (!list) return { toggleMs: -1, renderedRows: -1 };
		const start = performance.now();
		for (let i = 0; i < 20; i += 1) {
			list.scrollTop = i % 2 === 0 ? 0 : list.scrollHeight;
		}
		const toggleMs = performance.now() - start;
		const renderedRows = document.querySelectorAll('.virtual-row').length;
		return { toggleMs, renderedRows };
	});

	expect(sanity.toggleMs).toBeGreaterThanOrEqual(0);
	expect(sanity.toggleMs).toBeLessThan(60);
	expect(sanity.renderedRows).toBeLessThan(20);
});

test('visual baselines for utility home, settings, chat, overlays, and mobile shell', async ({ page }) => {
	await clearAllChats(page);
	await page.goto('/');
	await expect(page).toHaveScreenshot('utility-home-desktop.png', {
		animations: 'disabled',
		mask: [page.getByTestId('home-runtime-panel'), page.getByTestId('home-recent-panel')],
	});

	await page.goto('/settings');
	await expect(page).toHaveScreenshot('settings-desktop.png', {
		animations: 'disabled',
		mask: [page.locator('.data-row code')],
	});

	await createChatAndOpen(page);
	await expect(page).toHaveScreenshot('chat-desktop.png', {
		animations: 'disabled',
		maxDiffPixels: 100,
	});

	await page.keyboard.press('Control+K');
	await expect(page).toHaveScreenshot('chat-switcher-desktop.png', {
		animations: 'disabled',
		maxDiffPixels: 120,
	});
	await page.keyboard.press('Escape');

	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.getByRole('button', { name: 'Open sidebar' })).toBeVisible();
	await expect(page).toHaveScreenshot('chat-mobile-shell.png', {
		animations: 'disabled',
		maxDiffPixels: 120,
	});
});
