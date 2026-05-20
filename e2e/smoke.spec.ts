import { test, expect } from '@playwright/test';

async function clearAllChats(page: import('@playwright/test').Page): Promise<void> {
	const response = await page.request.get('/api/chats?limit=200');
	if (!response.ok) return;

	const body = (await response.json()) as { chats?: Array<{ id: string }> };
	for (const chat of body.chats ?? []) {
		await page.request.delete(`/api/chats/${chat.id}`);
	}
}

test.describe('smoke', () => {
	test.beforeEach(async ({ page }) => {
		await clearAllChats(page);
	});

	test('home page renders quick-start surface when no chats exist', async ({ page }) => {
		await page.goto('/');
		await expect(
			page.getByRole('heading', { name: 'Bryon' }),
		).toBeVisible();
		await expect(
			page.getByTestId('start-new-chat'),
		).toBeVisible();
	});

	test('"New chat" creates a chat and navigates to it', async ({
		page,
	}) => {
		await page.goto('/');
		await page.getByTestId('start-new-chat').click();
		await page.waitForURL(/\/chats\/[\w-]+/);
		await expect(
			page.getByRole('heading', { name: 'Bryon' }),
		).toBeVisible();
	});

	test('settings page loads and shows model field', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
		await expect(page.locator('#model')).toHaveValue(/.+/);
	});
});
