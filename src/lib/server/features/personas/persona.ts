import { randomUUID } from 'node:crypto';
import { asc, count, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { z } from 'zod';
import { llmParamsSchema, personaSchema } from '../../../shared/schemas';
import type { LLMParams, Persona } from '../../../shared/types';
import { getDb } from '../../db/client';
import type * as schema from '../../db/schema';
import { personas } from '../../db/schema';

type Db = BetterSQLite3Database<typeof schema>;
type PersonaRow = typeof personas.$inferSelect;

export type CreatePersonaInput = {
	id?: string;
	name: string;
	systemPrompt: string;
	defaultModel?: string | null;
	tools?: string[];
	params?: Partial<LLMParams> | null;
};

export type UpdatePersonaInput = Partial<
	Pick<CreatePersonaInput, 'name' | 'systemPrompt' | 'defaultModel' | 'tools' | 'params'>
>;

export class PersonaService {
	constructor(private readonly db: Db = getDb()) {}

	list(): Persona[] {
		return this.db
			.select()
			.from(personas)
			.orderBy(asc(personas.createdAt), asc(personas.name))
			.all()
			.map(toPersona);
	}

	get(id: string): Persona | null {
		const row = this.db
			.select()
			.from(personas)
			.where(eq(personas.id, id))
			.get();

		return row ? toPersona(row) : null;
	}

	getFirst(): Persona | null {
		const row = this.db
			.select()
			.from(personas)
			.orderBy(asc(personas.createdAt), asc(personas.name))
			.limit(1)
			.get();

		return row ? toPersona(row) : null;
	}

	create(input: CreatePersonaInput): Persona {
		const now = Date.now();
		const id = input.id ?? randomUUID();

		this.db
			.insert(personas)
			.values({
				id,
				name: input.name,
				systemPrompt: input.systemPrompt,
				defaultModel: input.defaultModel ?? null,
				toolsJson: serializeTools(input.tools),
				paramsJson: serializeParams(input.params),
				createdAt: now,
				updatedAt: now,
			})
			.run();

		const created = this.get(id);
		if (!created) {
			throw new Error(`Persona "${id}" was not created.`);
		}

		return created;
	}

	update(id: string, input: UpdatePersonaInput): Persona | null {
		if (
			input.name === undefined &&
			input.systemPrompt === undefined &&
			input.defaultModel === undefined &&
			input.tools === undefined &&
			!Object.hasOwn(input, 'params')
		) {
			return this.get(id);
		}

		const values: Partial<typeof personas.$inferInsert> = {
			updatedAt: Date.now(),
		};

		if (input.name !== undefined) values.name = input.name;
		if (input.systemPrompt !== undefined)
			values.systemPrompt = input.systemPrompt;
		if (input.defaultModel !== undefined)
			values.defaultModel = input.defaultModel;
		if (input.tools !== undefined) values.toolsJson = serializeTools(input.tools);
		if (Object.hasOwn(input, 'params')) values.paramsJson = serializeParams(input.params);

		const result = this.db
			.update(personas)
			.set(values)
			.where(eq(personas.id, id))
			.run();

		if (result.changes === 0) return null;
		return this.get(id);
	}

	delete(id: string): boolean {
		const result = this.db.delete(personas).where(eq(personas.id, id)).run();
		return result.changes > 0;
	}

	count(): number {
		const [{ total }] = this.db.select({ total: count() }).from(personas).all();
		return total;
	}
}

function toPersona(row: PersonaRow): Persona {
	return personaSchema.parse({
		...row,
		tools: parseTools(row.toolsJson),
		paramsJson: parseParams(row.paramsJson),
	});
}

function parseTools(value: string): string[] {
	const parsed = JSON.parse(value);
	return z.array(z.string().min(1)).parse(parsed);
}

function serializeTools(value: string[] | undefined): string {
	return JSON.stringify(z.array(z.string().min(1)).parse(value ?? []));
}

function parseParams(value: string | null): Partial<LLMParams> | null {
	if (!value) return null;
	return llmParamsSchema.partial().parse(JSON.parse(value));
}

function serializeParams(
	value: Partial<LLMParams> | null | undefined,
): string | null {
	if (!value) return null;
	return JSON.stringify(llmParamsSchema.partial().parse(value));
}
