import { json } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db/client';
import { routingLogs } from '$lib/server/db/schema';
import { parsePositiveIntegerParam } from '$lib/server/http';

export const GET: RequestHandler = async ({ url }) => {
	const limit = parsePositiveIntegerParam(url.searchParams.get('limit'), 50, 200);
	const logs = getDb()
		.select()
		.from(routingLogs)
		.orderBy(desc(routingLogs.createdAt))
		.limit(limit)
		.all()
		.map((row) => ({
			...row,
			remote: row.remote === 1,
		}));
	return json({ logs });
};
