import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/http';
import { loadConfig } from '$lib/server/config';

const MIME_BY_EXT: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
};

export const GET: RequestHandler = async ({ url }) => {
	const rawPath = url.searchParams.get('path');
	if (!rawPath) return apiError(400, 'MISSING_PATH', 'path query param is required.');

	const { config } = loadConfig();
	const dataDir = resolve(config.app.data_dir);
	const requested = resolve(rawPath);

	// Only serve files under the uploads directory.
	if (!requested.startsWith(resolve(dataDir, 'uploads'))) {
		return apiError(403, 'FORBIDDEN', 'Path is outside the uploads directory.');
	}

	let data: Buffer;
	try {
		data = readFileSync(requested);
	} catch {
		return apiError(404, 'NOT_FOUND', 'Image not found.');
	}

	const extMatch = requested.match(/(\.[^.]+)$/);
	const ext = extMatch?.[1]?.toLowerCase() ?? '';
	const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';

	return new Response(new Uint8Array(data), {
		headers: {
			'content-type': mime,
			'cache-control': 'private, max-age=86400',
		},
	});
};
