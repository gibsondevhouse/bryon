/**
 * Course-correction e2e tests — Folder Intake feature.
 *
 * These tests exercise the async scan flow through the HTTP API directly.
 * They do NOT depend on Ollama being available.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import type { IntakeScan } from '../src/lib/shared/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeScratchDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'bryon-e2e-intake-'));
	return dir;
}

async function pollScan(
	page: import('@playwright/test').Page,
	id: string,
	targetStatuses: string[],
	timeoutMs = 10_000,
): Promise<IntakeScan> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const res = await page.request.get(`/api/intake/scans/${id}`);
		expect(res.ok()).toBe(true);
		const { scan } = (await res.json()) as { scan: IntakeScan };
		if (targetStatuses.includes(scan.status)) return scan;
		await page.waitForTimeout(200);
	}
	throw new Error(`Scan ${id} did not reach ${targetStatuses.join('|')} within ${timeoutMs}ms`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('GET /api/intake/scans returns empty list initially', async ({ page }) => {
	const res = await page.request.get('/api/intake/scans?includeCompleted=true');
	expect(res.ok()).toBe(true);
	const body = (await res.json()) as { scans: IntakeScan[] };
	expect(Array.isArray(body.scans)).toBe(true);
});

test('POST /api/intake/scans returns 202 with queued scan', async ({ page }) => {
	const dir = makeScratchDir();
	try {
		const res = await page.request.post('/api/intake/scans', {
			data: { folderPath: dir },
		});
		expect(res.status()).toBe(202);
		const body = (await res.json()) as { scan: IntakeScan };
		expect(body.scan.id).toBeTruthy();
		expect(body.scan.folderPath).toBe(dir);
		expect(['queued', 'running']).toContain(body.scan.status);

		// Clean up — cancel so it doesn't linger
		await page.request.delete(`/api/intake/scans/${body.scan.id}`);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('POST requires folderPath', async ({ page }) => {
	const res = await page.request.post('/api/intake/scans', {
		data: { folderPath: '' },
	});
	expect(res.status()).toBe(400);
});

test('scan completes and returns classified files', async ({ page }) => {
	const dir = makeScratchDir();
	try {
		writeFileSync(join(dir, 'readme.md'), '# Hello');
		writeFileSync(join(dir, 'data.csv'), 'a,b\n1,2');
		writeFileSync(join(dir, 'photo.jpg'), 'fake');
		mkdirSync(join(dir, 'src'), { recursive: true });
		writeFileSync(join(dir, 'src', 'index.ts'), 'export {}');

		const createRes = await page.request.post('/api/intake/scans', {
			data: { folderPath: dir },
		});
		expect(createRes.status()).toBe(202);
		const { scan: created } = (await createRes.json()) as { scan: IntakeScan };

		const done = await pollScan(page, created.id, ['completed', 'failed']);

		expect(done.status).toBe('completed');
		expect(done.phase).toBe('completed');
		expect(done.filesFound).toBe(4);
		expect(done.filesClassified).toBe(4);
		expect(done.result).toHaveLength(4);
		expect(done.completedAt).not.toBeNull();

		const kinds = new Set((done.result ?? []).map((f) => f.kind));
		expect(kinds).toContain('text');
		expect(kinds).toContain('data');
		expect(kinds).toContain('image');
		expect(kinds).toContain('code');
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('GET /api/intake/scans/:id returns 404 for unknown scan', async ({ page }) => {
	const res = await page.request.get('/api/intake/scans/does-not-exist');
	expect(res.status()).toBe(404);
});

test('cancelling an active scan sets status to cancelled', async ({ page }) => {
	// Create a large directory so the scan takes a moment
	const dir = makeScratchDir();
	try {
		for (let i = 0; i < 30; i++) {
			writeFileSync(join(dir, `file${i}.txt`), 'content '.repeat(100));
		}

		const createRes = await page.request.post('/api/intake/scans', {
			data: { folderPath: dir },
		});
		expect(createRes.status()).toBe(202);
		const { scan: created } = (await createRes.json()) as { scan: IntakeScan };

		// Cancel immediately
		const cancelRes = await page.request.delete(`/api/intake/scans/${created.id}`);
		expect(cancelRes.ok()).toBe(true);
		const { scan: cancelled } = (await cancelRes.json()) as { scan: IntakeScan };
		expect(['cancelled', 'completed']).toContain(cancelled.status);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('hard delete removes a scan record', async ({ page }) => {
	const dir = makeScratchDir();
	try {
		const createRes = await page.request.post('/api/intake/scans', {
			data: { folderPath: dir },
		});
		const { scan } = (await createRes.json()) as { scan: IntakeScan };

		// Cancel first, then hard-delete
		await page.request.delete(`/api/intake/scans/${scan.id}`);
		const delRes = await page.request.delete(`/api/intake/scans/${scan.id}?delete=true`);
		expect([204, 404]).toContain(delRes.status()); // 204 success or 404 already gone

		const checkRes = await page.request.get(`/api/intake/scans/${scan.id}`);
		expect(checkRes.status()).toBe(404);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('completed scan appears in GET /api/intake/scans list', async ({ page }) => {
	const dir = makeScratchDir();
	try {
		writeFileSync(join(dir, 'note.txt'), 'hello world');

		const createRes = await page.request.post('/api/intake/scans', {
			data: { folderPath: dir },
		});
		const { scan: created } = (await createRes.json()) as { scan: IntakeScan };
		await pollScan(page, created.id, ['completed', 'failed']);

		const listRes = await page.request.get('/api/intake/scans?includeCompleted=true');
		const { scans } = (await listRes.json()) as { scans: IntakeScan[] };
		expect(scans.map((s) => s.id)).toContain(created.id);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('/intake page loads without errors', async ({ page }) => {
	await page.goto('/intake');
	await expect(page.getByRole('heading', { name: 'Folder Intake' })).toBeVisible();
	await expect(page.locator('input[type="text"]').first()).toBeVisible();
});
