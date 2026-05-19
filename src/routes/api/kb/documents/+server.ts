import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const disabled = () =>
	json(
		{
			error: {
				code: 'PROJECTS_NOT_IN_V1',
				message: 'Project knowledge bases are planned for v1.5. V1 supports chat-attached documents instead.',
			},
		},
		{ status: 404 },
	);

export const GET: RequestHandler = () => disabled();
export const POST: RequestHandler = () => disabled();
export const PATCH: RequestHandler = () => disabled();
export const DELETE: RequestHandler = () => disabled();
