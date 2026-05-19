import { json } from '@sveltejs/kit';
import { ZodError, type ZodType } from 'zod';

export type ApiErrorBody = {
	error: {
		code: string;
		message: string;
		details?: unknown;
	};
};

export function apiError(
	status: number,
	code: string,
	message: string,
	details?: unknown,
): Response {
	return json(
		{
			error: {
				code,
				message,
				...(details === undefined ? {} : { details }),
			},
		} satisfies ApiErrorBody,
		{ status },
	);
}

export async function parseJsonBody<T>(
	request: Request,
	schema: ZodType<T>,
): Promise<
	| {
			ok: true;
			data: T;
	  }
	| {
			ok: false;
			response: Response;
	  }
> {
	try {
		const raw = await request.json();
		return { ok: true, data: schema.parse(raw) };
	} catch (error) {
		if (error instanceof ZodError) {
			return {
				ok: false,
				response: apiError(
					400,
					'INVALID_REQUEST',
					'Invalid request body.',
					error.issues,
				),
			};
		}

		return {
			ok: false,
			response: apiError(
				400,
				'INVALID_JSON',
				'Request body must be valid JSON.',
			),
		};
	}
}

export function parseBooleanParam(value: string | null): boolean | undefined {
	if (value === null) return undefined;
	if (value === 'true' || value === '1') return true;
	if (value === 'false' || value === '0') return false;
	return undefined;
}

export function parsePositiveIntegerParam(
	value: string | null,
	defaultValue: number,
	maxValue: number,
): number {
	if (value === null) return defaultValue;

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed)) return defaultValue;

	return Math.min(Math.max(1, parsed), maxValue);
}
