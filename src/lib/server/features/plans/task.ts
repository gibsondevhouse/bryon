import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { taskSchema } from '$lib/shared/schemas';
import type { Task } from '$lib/shared/types';
import { getDb } from '$lib/server/db/client';
import type * as schema from '$lib/server/db/schema';
import { tasks } from '$lib/server/db/schema';

type Db = BetterSQLite3Database<typeof schema>;
type TaskRow = typeof tasks.$inferSelect;

export class TaskService {
	constructor(private readonly db: Db = getDb()) {}

	list(planId: string): Task[] {
		return this.db
			.select()
			.from(tasks)
			.where(eq(tasks.planId, planId))
			.orderBy(asc(tasks.createdAt))
			.all()
			.map(toTask);
	}

	get(id: string): Task | null {
		const row = this.db.select().from(tasks).where(eq(tasks.id, id)).get();
		return row ? toTask(row) : null;
	}

	create(planId: string, body: string): Task {
		const now = Date.now();
		const id = randomUUID();
		this.db.insert(tasks).values({ id, planId, body: body.trim(), done: 0, createdAt: now, updatedAt: now }).run();
		const created = this.get(id);
		if (!created) throw new Error('Failed to create task');
		return created;
	}

	update(id: string, input: { body?: string; done?: boolean }): Task | null {
		const existing = this.get(id);
		if (!existing) return null;
		const now = Date.now();
		const values: Partial<TaskRow> = { updatedAt: now };
		if (input.body !== undefined) values.body = input.body.trim();
		if (input.done !== undefined) values.done = input.done ? 1 : 0;
		this.db.update(tasks).set(values).where(eq(tasks.id, id)).run();
		return this.get(id);
	}

	delete(id: string): boolean {
		const result = this.db.delete(tasks).where(eq(tasks.id, id)).run();
		return result.changes > 0;
	}
}

function toTask(row: TaskRow): Task {
	return taskSchema.parse({
		id: row.id,
		planId: row.planId,
		body: row.body,
		done: row.done === 1,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}
