import { expect, test } from '@playwright/test';

function sseChunks(parts: Array<{ event: string; data: unknown }>): string {
	return parts
		.map((part) => `event: ${part.event}\ndata: ${JSON.stringify(part.data)}\n\n`)
		.join('');
}

test('projects API scopes chats and archives projects without touching global chats', async ({ page }) => {
	const name = `Project ${Date.now()}`;
	const projectResponse = await page.request.post('/api/projects', {
		data: { name },
	});
	expect(projectResponse.ok()).toBe(true);
	const { project } = await projectResponse.json();

	const globalResponse = await page.request.post('/api/chats', {
		data: { title: 'Global chat' },
	});
	const scopedResponse = await page.request.post('/api/chats', {
		data: { title: 'Scoped chat', projectId: project.id },
	});
	const globalChat = (await globalResponse.json()).chat;
	const scopedChat = (await scopedResponse.json()).chat;

	const globalList = await page.request.get('/api/chats?projectId=global');
	const scopedList = await page.request.get(`/api/chats?projectId=${project.id}`);
	expect((await globalList.json()).chats.map((chat: { id: string }) => chat.id)).toContain(globalChat.id);
	expect((await scopedList.json()).chats.map((chat: { id: string }) => chat.id)).toContain(scopedChat.id);

	const moveResponse = await page.request.patch(`/api/chats/${globalChat.id}`, {
		data: { projectId: project.id },
	});
	expect(moveResponse.ok()).toBe(true);
	expect((await moveResponse.json()).chat.projectId).toBe(project.id);

	const archiveResponse = await page.request.delete(`/api/projects/${project.id}`);
	expect(archiveResponse.ok()).toBe(true);
	const visibleProjects = await page.request.get('/api/projects');
	expect((await visibleProjects.json()).projects.map((item: { id: string }) => item.id)).not.toContain(project.id);
});

test('project files are searchable and explicitly attached from the chat UI', async ({ page }) => {
	let streamBody: { projectFileIds?: string[] } | null = null;
	await page.route('**/api/chats/*/stream', async (route) => {
		streamBody = route.request().postDataJSON() as { projectFileIds?: string[] };
		await route.fulfill({
			status: 200,
			headers: { 'Content-Type': 'text/event-stream' },
			body: sseChunks([
				{ event: 'meta', data: { assistantId: 'project-answer', msToFirst: 5, tokensIn: 4 } },
				{ event: 'token', data: { delta: 'Project answer' } },
				{ event: 'done', data: { id: 'project-answer', tokensOut: 2, msTotal: 20 } },
			]),
		});
	});

	const projectResponse = await page.request.post('/api/projects', {
		data: { name: `Files ${Date.now()}` },
	});
	const { project } = await projectResponse.json();
	const uploadResponse = await page.request.post(`/api/projects/${project.id}/files`, {
		multipart: {
			files: {
				name: 'brief.txt',
				mimeType: 'text/plain',
				buffer: Buffer.from('Alpha launch constraints and budget.'),
			},
		},
	});
	expect(uploadResponse.ok()).toBe(true);
	const { files } = await uploadResponse.json();

	const searchResponse = await page.request.get(`/api/projects/${project.id}/search?q=Alpha`);
	expect((await searchResponse.json()).results[0].projectFileId).toBe(files[0].id);

	const chatResponse = await page.request.post('/api/chats', {
		data: { title: 'Project turn', projectId: project.id },
	});
	const { chat } = await chatResponse.json();
	await page.goto(`/chats/${chat.id}`);

	await page.getByRole('button', { name: /brief\.txt/ }).click();
	const composer = page.getByPlaceholder(/Message Bryon/i);
	await composer.fill('Use the selected brief');
	await composer.press('Enter');

	await expect(page.getByText('Project answer')).toBeVisible();
	expect(streamBody?.projectFileIds).toContain(files[0].id);
});
