import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const disabled = () =>
	json(
		{
			error: {
				code: 'PERSONAS_NOT_IN_V1',
				message: 'V1 uses one internal Bryon persona. Prompt and project persona editing is planned for v1.5.',
			},
		},
		{ status: 404 },
	);

export const GET: RequestHandler = () => disabled();
export const POST: RequestHandler = () => disabled();
export const PATCH: RequestHandler = () => disabled();
export const DELETE: RequestHandler = () => disabled();
