import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Rich chat hardening: upload rejection, document uploads, and V1 scope gates.
 *
 * Upload and scope tests hit real server endpoints. Stream rendering is covered
 * elsewhere with token/meta/done/error SSE events; model-controlled tool cards
 * are intentionally outside V1.
 */

const APP_ORIGIN = 'http://127.0.0.1:5175';

async function createChat(page: Page): Promise<string> {
	const res = await page.request.post('/api/chats', { data: {} });
	const { chat } = await res.json();
	return chat.id as string;
}

async function postMultipart(
	page: Page,
	url: string,
	file: { name: string; mimeType: string; buffer: Buffer },
) {
	return page.request.post(url, {
		headers: { origin: APP_ORIGIN },
		multipart: { files: file },
	});
}

test.describe('upload endpoint hardening', () => {
	test('rejects an unsupported MIME type with 415', async ({ page }) => {
		const chatId = await createChat(page);

		const res = await postMultipart(page, `/api/chats/${chatId}/uploads`, {
			name: 'script.sh',
			mimeType: 'application/x-sh',
			buffer: Buffer.from('#!/bin/sh\necho nope\n'),
		});

		expect(res.status()).toBe(415);
		const body = await res.json();
		expect(body.error?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
	});

	test('rejects a file that exceeds 25 MB per-file limit with 413', async ({ page }) => {
		const chatId = await createChat(page);

		const oversized = Buffer.alloc(26 * 1024 * 1024, 0);

		const res = await postMultipart(page, `/api/chats/${chatId}/uploads`, {
			name: 'big.png',
			mimeType: 'image/png',
			buffer: oversized,
		});

		expect(res.status()).toBe(413);
		const body = await res.json();
		expect(body.error?.code).toBe('FILE_TOO_LARGE');
	});

	test('accepts a valid PNG upload and returns image metadata', async ({ page }) => {
		const chatId = await createChat(page);

		const minimalPng = Buffer.from(
			'89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
				'2e0000000447414d410000b18f0bfc6105000000097048597300000ec400000ec401952b0e1b000000' +
				'0c4944415478016360f8cfc0000000020001e221bc330000000049454e44ae426082',
			'hex',
		).subarray(0, 67);

		const res = await postMultipart(page, `/api/chats/${chatId}/uploads`, {
			name: 'test.png',
			mimeType: 'image/png',
			buffer: minimalPng,
		});

		expect(res.status()).toBe(201);
		const body = await res.json();
		expect(body.attachments).toBeInstanceOf(Array);
		expect(body.attachments[0]).toMatchObject({
			kind: 'image',
			mime: 'image/png',
			name: 'test.png',
		});
	});

	test('accepts a text document upload and returns extracted text metadata', async ({ page }) => {
		const chatId = await createChat(page);

		const res = await postMultipart(page, `/api/chats/${chatId}/uploads`, {
			name: 'notes.md',
			mimeType: 'text/markdown',
			buffer: Buffer.from('# Meeting notes\n\nRemember the launch checklist.'),
		});

		expect(res.status()).toBe(201);
		const body = await res.json();
		expect(body.attachments[0]).toMatchObject({
			kind: 'document',
			mime: 'text/markdown',
			name: 'notes.md',
		});
		expect(body.attachments[0].textBytes).toBeGreaterThan(0);
	});
});

test.describe('v1 scope gates', () => {
	test('persona API is disabled in rich chat V1', async ({ page }) => {
		const res = await page.request.get('/api/personas');
		expect(res.status()).toBe(404);
		const body = await res.json();
		expect(body.error?.code).toBe('PERSONAS_NOT_IN_V1');
	});

	test('knowledge-base APIs are deferred to projects V1.5', async ({ page }) => {
		const res = await page.request.get('/api/kb/documents');
		expect(res.status()).toBe(404);
		const body = await res.json();
		expect(body.error?.code).toBe('PROJECTS_NOT_IN_V1');
	});
});
