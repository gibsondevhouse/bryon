import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { planCardSchema, planSchema, taskSchema } from '$lib/shared/schemas';
import type {
	DoctrineLifecycle,
	Plan,
	PlanCard,
	PlanStatus,
	Task,
	TaskStatus,
} from '$lib/shared/types';
import { getDb } from '$lib/server/db/client';
import type * as schema from '$lib/server/db/schema';
import { planCards, plans, tasks } from '$lib/server/db/schema';

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
	status?: PlanStatus;
	doctrineLifecycle?: DoctrineLifecycle;
};

export type UpdatePlanInput = Partial<
	Pick<CreatePlanInput, 'name' | 'summary' | 'planType' | 'startDate'>
> & {
	status?: PlanStatus;
	doctrineLifecycle?: DoctrineLifecycle;
	archived?: boolean;
	projectId?: string | null;
	missionNeed?: {
		gap?: string | null;
		context?: string | null;
		priority?: string | null;
		source?: string | null;
	};
	commandersIntent?: {
		purpose?: string | null;
		endState?: string | null;
		keyTasks?: string[];
		constraints?: string[];
	};
};

export const DOCTRINE_LIFECYCLE_TRANSITIONS: Record<
	DoctrineLifecycle,
	readonly DoctrineLifecycle[]
> = {
	proposed: ['drafting'],
	drafting: ['active'],
	active: ['archived'],
	archived: [],
};

export class PlanLifecycleTransitionError extends Error {
	readonly code = 'INVALID_PLAN_LIFECYCLE_TRANSITION';
	readonly details: {
		from: DoctrineLifecycle;
		to: DoctrineLifecycle;
		allowed: readonly DoctrineLifecycle[];
	};

	constructor(from: DoctrineLifecycle, to: DoctrineLifecycle) {
		const allowed = DOCTRINE_LIFECYCLE_TRANSITIONS[from];
		super(`Plan lifecycle cannot transition from ${from} to ${to}.`);
		this.name = 'PlanLifecycleTransitionError';
		this.details = { from, to, allowed };
	}
}

export function canTransitionDoctrineLifecycle(
	from: DoctrineLifecycle,
	to: DoctrineLifecycle,
): boolean {
	return from === to || DOCTRINE_LIFECYCLE_TRANSITIONS[from].includes(to);
}

export function assertDoctrineLifecycleTransition(
	from: DoctrineLifecycle,
	to: DoctrineLifecycle,
): void {
	if (!canTransitionDoctrineLifecycle(from, to)) {
		throw new PlanLifecycleTransitionError(from, to);
	}
}

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
		const doctrineLifecycle = resolveDoctrineLifecycle(input);
		this.db
			.insert(plans)
			.values({
				id,
				name: input.name.trim(),
				summary: input.summary?.trim() ?? null,
				planType: input.planType?.trim() ?? null,
				startDate: input.startDate ?? null,
				status: statusForDoctrineLifecycle(doctrineLifecycle),
				doctrineLifecycle,
				createdAt: now,
				updatedAt: now,
			})
			.run();
		const created = this.get(id);
		if (!created) throw new Error('Failed to create plan');
		return created;
	}

	update(id: string, input: UpdatePlanInput): Plan | null {
		const existing = this.get(id);
		if (!existing) return null;

		const now = Date.now();
		const values: Partial<PlanRow> = { updatedAt: now };
		const targetLifecycle = resolveDoctrineLifecycle(
			input,
			existing.doctrineLifecycle,
		);

		if (targetLifecycle !== existing.doctrineLifecycle) {
			assertDoctrineLifecycleTransition(
				existing.doctrineLifecycle,
				targetLifecycle,
			);
			values.doctrineLifecycle = targetLifecycle;
			values.status = statusForDoctrineLifecycle(targetLifecycle);
			values.archivedAt =
				targetLifecycle === 'archived' ? now : existing.archivedAt;
		}

		if (input.name !== undefined) values.name = input.name.trim();
		if (input.summary !== undefined)
			values.summary = input.summary?.trim() ?? null;
		if (input.planType !== undefined)
			values.planType = input.planType?.trim() ?? null;
		if (input.startDate !== undefined)
			values.startDate = input.startDate ?? null;
		if (input.archived !== undefined) {
			if (input.archived) {
				assertDoctrineLifecycleTransition(
					existing.doctrineLifecycle,
					'archived',
				);
				values.doctrineLifecycle = 'archived';
				values.status = statusForDoctrineLifecycle('archived');
				values.archivedAt = now;
			} else {
				values.archivedAt = null;
			}
		}
		if (input.projectId !== undefined)
			values.projectId = input.projectId ?? null;

		if (input.missionNeed !== undefined) {
			if (input.missionNeed.gap !== undefined)
				values.missionNeedGap = input.missionNeed.gap ?? null;
			if (input.missionNeed.context !== undefined)
				values.missionNeedContext = input.missionNeed.context ?? null;
			if (input.missionNeed.priority !== undefined)
				values.missionNeedPriority =
					(input.missionNeed.priority as PlanRow['missionNeedPriority']) ?? null;
			if (input.missionNeed.source !== undefined)
				values.missionNeedSource =
					(input.missionNeed.source as PlanRow['missionNeedSource']) ?? null;
		}

		if (input.commandersIntent !== undefined) {
			if (input.commandersIntent.purpose !== undefined)
				values.intentPurpose = input.commandersIntent.purpose ?? null;
			if (input.commandersIntent.endState !== undefined)
				values.intentEndState = input.commandersIntent.endState ?? null;
			if (input.commandersIntent.keyTasks !== undefined)
				values.intentKeyTasksJson = JSON.stringify(input.commandersIntent.keyTasks);
			if (input.commandersIntent.constraints !== undefined)
				values.intentConstraintsJson = JSON.stringify(
					input.commandersIntent.constraints,
				);
		}

		this.db.update(plans).set(values).where(eq(plans.id, id)).run();
		return this.get(id);
	}

	archive(id: string): Plan | null {
		return this.update(id, { archived: true });
	}
}

function toPlan(row: PlanRow): Plan {
	const doctrineLifecycle =
		row.doctrineLifecycle ?? doctrineLifecycleForStatus(row.status);
	return planSchema.parse({
		id: row.id,
		name: row.name,
		summary: row.summary,
		planType: row.planType,
		startDate: row.startDate,
		projectId: row.projectId,
		status: statusForDoctrineLifecycle(doctrineLifecycle),
		doctrineLifecycle,
		doctrine: {
			lifecycle: doctrineLifecycle,
			missionNeed: {
				gap: row.missionNeedGap,
				context: row.missionNeedContext,
				priority: row.missionNeedPriority,
				source: row.missionNeedSource,
			},
			commandersIntent: {
				purpose: row.intentPurpose,
				keyTasks: parseStringArray(row.intentKeyTasksJson),
				endState: row.intentEndState,
				constraints: parseStringArray(row.intentConstraintsJson),
			},
			lineOfEffort: parseStringArray(row.lineOfEffortJson),
			oplan: {
				missionStatement: row.oplanMissionStatement,
				executionTimeline: parseStringArray(row.oplanExecutionTimelineJson),
				taskOrganization: parseStringArray(row.oplanTaskOrganizationJson),
				sustainment: parseStringArray(row.oplanSustainmentJson),
				annexes: parseStringArray(row.oplanAnnexesJson),
				references: parseStringArray(row.oplanReferencesJson),
			},
		},
		archivedAt: row.archivedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}

function resolveDoctrineLifecycle(
	input: Pick<CreatePlanInput, 'status' | 'doctrineLifecycle'> & {
		archived?: boolean;
	},
	fallback: DoctrineLifecycle = 'proposed',
): DoctrineLifecycle {
	if (input.archived === true) return 'archived';
	if (input.doctrineLifecycle !== undefined) return input.doctrineLifecycle;
	if (input.status !== undefined)
		return doctrineLifecycleForStatus(input.status);
	return fallback;
}

function doctrineLifecycleForStatus(status: PlanStatus): DoctrineLifecycle {
	switch (status) {
		case 'definition':
		case 'drafting':
			return 'drafting';
		case 'execution':
		case 'active':
			return 'active';
		case 'maintenance':
			return 'archived';
		case 'ideation':
			return 'proposed';
	}
}

function statusForDoctrineLifecycle(lifecycle: DoctrineLifecycle): PlanStatus {
	switch (lifecycle) {
		case 'proposed':
			return 'ideation';
		case 'drafting':
			return 'drafting';
		case 'active':
			return 'active';
		case 'archived':
			return 'maintenance';
	}
}

function parseStringArray(value: string | null): string[] {
	if (!value) return [];
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed)
			? parsed.filter(
					(item): item is string =>
						typeof item === 'string' && item.trim().length > 0,
				)
			: [];
	} catch {
		return [];
	}
}

// ── TaskService (new API — title/description/status) ─────────────────────────
// Note: the legacy body/done API lives in task.ts and is used by /api/plans/[id]/tasks

type TaskRow = typeof tasks.$inferSelect;

export type ListTasksInput = {
	planId?: string;
	projectId?: string;
	includeArchived?: boolean;
	limit?: number;
	offset?: number;
};

export type CreateTaskInput = {
	planId: string;
	projectId?: string | null;
	title: string;
	description?: string | null;
	status?: TaskStatus;
	assignee?: string | null;
	dueDate?: string | null;
	sortOrder?: number | null;
};

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'planId'>> & {
	archived?: boolean;
};

export class TaskService {
	constructor(private readonly db: Db = getDb()) {}

	list(input: ListTasksInput = {}): Task[] {
		const limit = Math.min(Math.max(1, input.limit ?? 200), 500);
		const offset = Math.max(0, input.offset ?? 0);
		const conditions = [];
		if (input.planId !== undefined)
			conditions.push(eq(tasks.planId, input.planId));
		if (input.projectId !== undefined)
			conditions.push(eq(tasks.projectId, input.projectId));
		if (!input.includeArchived) conditions.push(ne(tasks.status, 'archived'));
		const query = this.db
			.select()
			.from(tasks)
			.orderBy(asc(tasks.sortOrder), asc(tasks.createdAt))
			.limit(limit)
			.offset(offset);
		const rows =
			conditions.length > 0
				? query.where(and(...conditions)).all()
				: query.all();
		return rows.map(toTask);
	}

	get(id: string): Task | null {
		const row = this.db.select().from(tasks).where(eq(tasks.id, id)).get();
		return row ? toTask(row) : null;
	}

	create(input: CreateTaskInput): Task {
		const now = Date.now();
		const id = randomUUID();
		this.db
			.insert(tasks)
			.values({
				id,
				planId: input.planId,
				body: '',
				done: 0,
				title: input.title.trim(),
				description: input.description?.trim() ?? null,
				status: input.status ?? 'planned',
				projectId: input.projectId ?? null,
				assignee: input.assignee ?? null,
				dueDate: input.dueDate ?? null,
				sortOrder: input.sortOrder ?? null,
				createdAt: now,
				updatedAt: now,
			})
			.run();
		const created = this.get(id);
		if (!created) throw new Error(`Task "${id}" was not created.`);
		return created;
	}

	update(id: string, input: UpdateTaskInput): Task | null {
		const existing = this.get(id);
		if (!existing) return null;
		const now = Date.now();
		const values: Partial<typeof tasks.$inferInsert> = { updatedAt: now };
		if (input.title !== undefined) values.title = input.title.trim();
		if (input.description !== undefined)
			values.description = input.description?.trim() ?? null;
		if (input.status !== undefined) values.status = input.status;
		if (input.projectId !== undefined)
			values.projectId = input.projectId ?? null;
		if (input.assignee !== undefined) values.assignee = input.assignee ?? null;
		if (input.dueDate !== undefined) values.dueDate = input.dueDate ?? null;
		if (input.sortOrder !== undefined)
			values.sortOrder = input.sortOrder ?? null;
		if (input.archived !== undefined)
			values.status = input.archived ? 'archived' : existing.status;
		this.db.update(tasks).set(values).where(eq(tasks.id, id)).run();
		return this.get(id);
	}
}

function toTask(row: TaskRow): Task {
	return taskSchema.parse({
		id: row.id,
		planId: row.planId,
		body: row.body ?? '',
		done: row.done === 1,
		title: row.title ?? '',
		description: row.description ?? null,
		status: row.status ?? 'planned',
		projectId: row.projectId ?? null,
		assignee: row.assignee ?? null,
		dueDate: row.dueDate ?? null,
		sortOrder: row.sortOrder ?? null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}

// ── PlanCardService ───────────────────────────────────────────────────────────

type PlanCardRow = typeof planCards.$inferSelect;

export type ListPlanCardsInput = {
	planId: string;
	series?:
		| '100'
		| '200'
		| '300'
		| '400'
		| '500'
		| '600'
		| '700'
		| '800'
		| '900'
		| '1000';
	includeArchived?: boolean;
};

export type CreatePlanCardInput = {
	planId: string;
	series?:
		| '100'
		| '200'
		| '300'
		| '400'
		| '500'
		| '600'
		| '700'
		| '800'
		| '900'
		| '1000';
	title: string;
	body?: string | null;
	sortOrder?: number | null;
	locked?: boolean;
	contextWeight?: 'always' | 'conditional' | 'never';
};

export type UpdatePlanCardInput = Partial<
	Omit<CreatePlanCardInput, 'planId'>
> & {
	archived?: boolean;
};

export class PlanCardService {
	constructor(private readonly db: Db = getDb()) {}

	list(input: ListPlanCardsInput): PlanCard[] {
		const conditions = [eq(planCards.planId, input.planId)];
		if (input.series !== undefined)
			conditions.push(eq(planCards.series, input.series));
		if (!input.includeArchived) conditions.push(isNull(planCards.archivedAt));
		return this.db
			.select()
			.from(planCards)
			.where(and(...conditions))
			.orderBy(asc(planCards.sortOrder), asc(planCards.createdAt))
			.all()
			.map(toPlanCard);
	}

	get(id: string): PlanCard | null {
		const row = this.db
			.select()
			.from(planCards)
			.where(eq(planCards.id, id))
			.get();
		return row ? toPlanCard(row) : null;
	}

	create(input: CreatePlanCardInput): PlanCard {
		const now = Date.now();
		const id = randomUUID();
		this.db
			.insert(planCards)
			.values({
				id,
				planId: input.planId,
				series: input.series ?? '100',
				title: input.title.trim(),
				body: input.body?.trim() ?? '',
				sortOrder: input.sortOrder ?? 0,
				locked: input.locked ? 1 : 0,
				contextWeight: input.contextWeight ?? 'conditional',
				archivedAt: null,
				createdAt: now,
				updatedAt: now,
			})
			.run();
		const created = this.get(id);
		if (!created) throw new Error(`Plan card "${id}" was not created.`);
		return created;
	}

	update(id: string, input: UpdatePlanCardInput): PlanCard | null {
		const existing = this.get(id);
		if (!existing) return null;
		const now = Date.now();
		const values: Partial<typeof planCards.$inferInsert> = { updatedAt: now };
		if (input.series !== undefined) values.series = input.series;
		if (input.title !== undefined) values.title = input.title.trim();
		if (input.body !== undefined) values.body = input.body?.trim() ?? null;
		if (input.sortOrder !== undefined)
			values.sortOrder = input.sortOrder ?? null;
		if (input.locked !== undefined) values.locked = input.locked ? 1 : 0;
		if (input.contextWeight !== undefined)
			values.contextWeight = input.contextWeight;
		if (input.archived !== undefined)
			values.archivedAt = input.archived ? now : null;
		this.db.update(planCards).set(values).where(eq(planCards.id, id)).run();
		return this.get(id);
	}

	archive(id: string): PlanCard | null {
		return this.update(id, { archived: true });
	}

	referencesTo(cardId: string): string[] {
		void cardId;
		return [];
	}
}

function toPlanCard(row: PlanCardRow): PlanCard {
	return planCardSchema.parse({
		...row,
		locked: row.locked === 1,
	});
}
