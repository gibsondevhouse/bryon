import type {
	Plan,
	PlanDoctrine,
	ConopsPhase,
	Opord,
	Frago,
	Aar,
	Task,
	DoctrineLifecycle,
	TaskStatus,
} from '$lib/shared/types';

export type PlanSummary = {
	id: string;
	name: string;
	lifecycle: DoctrineLifecycle | null;
	hasMissionNeed: boolean;
	hasIntent: boolean;
	phaseCount: number;
	activeOpordStatus: Opord['status'] | null;
	openFragoCount: number;
	taskCount: number;
	blockedCount: number;
	aarDueCount: number;
	updatedAt: number;
	source: string | null;
};

export function toPlanSummary(
	plan: Plan,
	doctrine: PlanDoctrine | null,
	phases: ConopsPhase[],
	opords: Opord[],
	fragos: Frago[],
	tasks: Task[],
	aars: Aar[],
): PlanSummary {
	const activePhases = phases.filter((p) => !p.archivedAt);
	const activeOpord = opords.find((o) => o.status === 'issued') ?? opords.find((o) => o.status === 'draft') ?? null;
	const openFragos = fragos.filter((f) => f.status === 'issued');
	const blockedTasks = tasks.filter((t) => t.status === 'blocked');
	const draftAars = aars.filter((a) => a.status === 'draft');

	return {
		id: plan.id,
		name: plan.name,
		lifecycle: doctrine?.lifecycle ?? null,
		hasMissionNeed: !!doctrine?.missionNeed?.gap,
		hasIntent: !!doctrine?.commandersIntent?.purpose,
		phaseCount: activePhases.length,
		activeOpordStatus: activeOpord?.status ?? null,
		openFragoCount: openFragos.length,
		taskCount: tasks.length,
		blockedCount: blockedTasks.length,
		aarDueCount: draftAars.length,
		updatedAt: plan.updatedAt,
		source: doctrine?.missionNeed?.source ?? null,
	};
}

export type TaskSummary = {
	total: number;
	byStatus: Record<TaskStatus, number>;
	blocked: number;
};

export function toTaskSummary(tasks: Task[]): TaskSummary {
	const byStatus: Record<TaskStatus, number> = {
		proposed: 0,
		planned: 0,
		in_progress: 0,
		blocked: 0,
		completed: 0,
		archived: 0,
	};
	for (const t of tasks) {
		byStatus[t.status]++;
	}
	return {
		total: tasks.length,
		byStatus,
		blocked: byStatus.blocked,
	};
}

export type CommandCenterData = {
	activePlans: PlanSummary[];
	proposedPlans: PlanSummary[];
	missingMissionNeed: PlanSummary[];
	missingIntent: PlanSummary[];
	activeOpordCount: number;
	openFragoCount: number;
	blockedTaskCount: number;
	draftAarCount: number;
	recentCheckpoints: number;
};

export function toCommandCenterData(plans: PlanSummary[]): CommandCenterData {
	const activePlans = plans.filter((p) => p.lifecycle === 'active');
	const proposedPlans = plans.filter((p) => p.lifecycle === 'proposed');
	const missingMissionNeed = plans.filter((p) => !p.hasMissionNeed && p.lifecycle !== 'archived');
	const missingIntent = plans.filter((p) => !p.hasIntent && p.lifecycle !== 'archived');

	return {
		activePlans,
		proposedPlans,
		missingMissionNeed,
		missingIntent,
		activeOpordCount: plans.reduce((n, p) => n + (p.activeOpordStatus === 'issued' ? 1 : 0), 0),
		openFragoCount: plans.reduce((n, p) => n + p.openFragoCount, 0),
		blockedTaskCount: plans.reduce((n, p) => n + p.blockedCount, 0),
		draftAarCount: plans.reduce((n, p) => n + p.aarDueCount, 0),
		recentCheckpoints: 0,
	};
}
