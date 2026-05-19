import { z } from 'zod';
import { toolRegistry } from '../registry';

const currentTimeArgsSchema = z.object({});

const currentTimeResultSchema = z.object({
	iso: z.string().min(1),
	unix: z.number().int().nonnegative(),
	tz: z.string().min(1),
});

toolRegistry.register({
	name: 'current_time',
	description: 'Return the current local date/time as ISO text and unix ms.',
	parameters: currentTimeArgsSchema,
	returns: currentTimeResultSchema,
	async execute() {
		const now = new Date();
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
		return {
			iso: now.toISOString(),
			unix: now.getTime(),
			tz,
		};
	},
});
