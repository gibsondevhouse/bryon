import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSqlite } from '$lib/server/db/client';
import { parsePositiveIntegerParam } from '$lib/server/http';

type SearchRow = {
	id: string;
	chatId: string;
	chatTitle: string;
	role: string;
	content: string;
	createdAt: number;
	snippet: string;
};

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (!q) return json({ results: [] });

	const limit = parsePositiveIntegerParam(
		url.searchParams.get('limit'),
		20,
		100,
	);
	const offset = Math.max(
		0,
		Number.parseInt(url.searchParams.get('offset') ?? '0', 10) || 0,
	);
	const query = toFtsQuery(q);

	const rows = getSqlite()
		.prepare(
			`
			select
				m.id,
				m.chat_id as chatId,
				c.title as chatTitle,
				m.role,
				m.content,
				m.created_at as createdAt,
				snippet(messages_fts, 3, '<mark>', '</mark>', '...', 16) as snippet
			from messages_fts
			join messages m on m.id = messages_fts.id
			join chats c on c.id = m.chat_id
			where messages_fts match ?
				and m.role in ('user', 'assistant')
			order by rank
			limit ?
			offset ?
			`,
		)
		.all(query, limit, offset) as SearchRow[];

	return json({ results: rows });
};

function toFtsQuery(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}
