import type { Logger } from 'pino';
import { z } from 'zod';

export type ToolContext = {
	chatId: string;
	personaId: string;
	signal: AbortSignal;
	logger: Logger;
};

export type ToolDefinition<
	P extends z.ZodTypeAny = z.ZodTypeAny,
	R extends z.ZodTypeAny = z.ZodTypeAny,
> = {
	name: string;
	description: string;
	parameters: P;
	returns: R;
	execute: (args: z.infer<P>, ctx: ToolContext) => Promise<z.infer<R>>;
};

export type OllamaTool = {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
};

export class ToolRegistry {
	private readonly tools = new Map<
		string,
		ToolDefinition<z.ZodTypeAny, z.ZodTypeAny>
	>();

	register<P extends z.ZodTypeAny, R extends z.ZodTypeAny>(
		def: ToolDefinition<P, R>,
	): void {
		this.tools.set(def.name, def);
	}

	get(name: string): ToolDefinition<z.ZodTypeAny, z.ZodTypeAny> | undefined {
		return this.tools.get(name);
	}

	list(allowed: string[]): ToolDefinition<z.ZodTypeAny, z.ZodTypeAny>[] {
		return allowed
			.map((name) => this.tools.get(name))
			.filter(
				(
					tool,
				): tool is ToolDefinition<z.ZodTypeAny, z.ZodTypeAny> =>
					Boolean(tool),
			);
	}

	toOllamaSchema(allowed: string[]): OllamaTool[] {
		return this.list(allowed).map((tool) => ({
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: toOllamaParameters(tool.parameters),
			},
		}));
	}

	names(): string[] {
		return [...this.tools.keys()].sort();
	}
}

function toOllamaParameters(schema: z.ZodTypeAny): Record<string, unknown> {
	const raw = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
	const { $schema: _schema, ...jsonSchema } = raw;
	return jsonSchema;
}

export const toolRegistry = new ToolRegistry();
