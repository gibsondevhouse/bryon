import { randomUUID } from 'node:crypto';
import { desc, eq, isNull } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { planSchema } from '$lib/shared/schemas';
import type { Plan, PlanStatus } from '$lib/shared/types';
import { getDb } from '$lib/server/db/client';
import type * as schema from '$lib/server/db/schema';
import { plans } from '$lib/server/db/schema';

type Db = BetterSQLite3Database<typeof schema>;
type PlanRow = typeof plans.$inferSelect;

export type ListPlansInput = {
	includeArchived?: boolean;
	limit?: number;
	offset?: number;
};

export type CreatePlanInput = {
	id?: string;
	name: string;
	summary?: string | null;
	planType?: string | null;
	startDate?: string | null;
};

export type UpdatePlanInput = Partial<
	Pick<CreatePlanInput, 'name' | 'summary' | 'planType' | 'startDate'>
> & {
	status?: PlanStatus;
	archived?: boolean;
	projectId?: string | null;
};

export class PlanService {
	constructor(private readonly db: Db = getDb()) {}

	list(input: ListPlansInput = {}): Plan[] {
		const limit = Math.min(Math.max(1, input.limit ?? 100), 200);
		const offset = Math.max(0, input.offset ?? 0);
		const query = this.db
			.select()
			.from(plans)
			.orderBy(desc(plans.updatedAt), desc(plans.createdAt))
			.limit(limit)
			.offset(offset);
		const rows = input.includeArchived
			? query.all()
			: query.where(isNull(plans.archivedAt)).all();
		return rows.map(toPlan);
	}

	get(id: string): Plan | null {
		const row = this.db.select().from(plans).where(eq(plans.id, id)).get();
		return row ? toPlan(row) : null;
	}

	create(input: CreatePlanInput): Plan {
		const now = Date.now();
		const id = input.id ?? randomUUID();
		this.db.insert(plans).values({
			id,
			name: input.name.trim(),
			summary: input.summary?.trim() ?? null,
			planType: input.planType?.trim() ?? null,
			startDate: input.startDate ?? null,
			status: 'ideation',
			createdAt: now,
			updatedAt: now,
		}).run();
		const created = this.get(id);
		if (!created) throw new Error('Failed to create plan');
		return created;
	}

	update(id: string, input: UpdatePlanInput): Plan | null {
		const existing = this.get(id);
		if (!existing) return null;

		const now = Date.now();
		const values: Partial<PlanRow> = { updatedAt: now };

		if (input.name !== undefined) values.name = input.name.trim();
		if (input.summary !== undefined) values.summary = input.summary?.trim() ?? null;
		if (input.planType !== undefined) values.planType = input.planType?.trim() ?? null;
		if (input.startDate !== undefined) values.startDate = input.startDate ?? null;
		if (input.status !== undefined) values.status = input.status;
		if (input.archived !== undefined) {
			values.archivedAt = input.archived ? now : null;
		}
		if (input.projectId !== undefined) values.projectId = input.projectId ?? null;

		this.db.update(plans).set(values).where(eq(plans.id, id)).run();
		return this.get(id);
	}

	archive(id: string): Plan | null {
		return this.update(id, { archived: true });
	}
}

function toPlan(row: PlanRow): Plan {
	return planSchema.parse({
		id: row.id,
		name: row.name,
		summary: row.summary,
		planType: row.planType,
		startDate: row.startDate,
		projectId: row.projectId,
		status: row.status,
		archivedAt: row.archivedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}
