import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { toolRegistry } from '../registry';
import { loadConfig } from '$lib/server/config';
import { OllamaAdapter } from '$lib/server/llm/ollama';
import { getDb } from '$lib/server/db/client';
import { messages } from '$lib/server/db/schema';

const parameters = z
	.object({
		attachmentId: z.string().min(1).optional(),
		path: z.string().min(1).optional(),
		prompt: z.string().min(1),
	})
	.refine((d) => d.attachmentId !== undefined || d.path !== undefined, {
		message: 'Provide either attachmentId or path.',
	});

const returns = z.object({ description: z.string() });

toolRegistry.register({
	name: 'analyze_image',
	description:
		'Analyze an image from this chat by attachment id, or by a file path under the user data directory.',
	parameters,
	returns,
	async execute(args, ctx) {
		const { config } = loadConfig();
		let imagePath: string;

		if (args.attachmentId) {
			const db = getDb();
			const rows = db
				.select({ attachmentsJson: messages.attachmentsJson })
				.from(messages)
				.where(eq(messages.chatId, ctx.chatId))
				.all();

			let found: string | null = null;
			for (const row of rows) {
				if (!row.attachmentsJson) continue;
				try {
					const list = JSON.parse(row.attachmentsJson) as Array<{
						id: string;
						path: string;
					}>;
					const match = list.find((a) => a.id === args.attachmentId);
					if (match) {
						found = match.path;
						break;
					}
				} catch {
					// skip unparseable rows
				}
			}
			if (!found) {
				throw new Error(
					`Attachment "${args.attachmentId}" not found in this chat.`,
				);
			}
			imagePath = found;
		} else {
			const dataDir = resolve(config.app.data_dir);
			const requested = resolve(args.path ?? '');
			if (!requested.startsWith(dataDir)) {
				throw new Error('Path must be under the Bryon data directory.');
			}
			imagePath = requested;
		}

		const imageData = readFileSync(imagePath).toString('base64');
		const adapter = new OllamaAdapter({ baseUrl: config.llm.base_url });

		const stream = await adapter.stream({
			model: config.llm.vision_model,
			messages: [{ role: 'user', content: args.prompt, images: [imageData] }],
			signal: ctx.signal,
		});

		const reader = stream.getReader();
		let text = '';
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				if (value.type === 'token') text += value.delta;
			}
		} finally {
			reader.releaseLock();
		}

		return { description: text.trim() || 'No description generated.' };
	},
});
