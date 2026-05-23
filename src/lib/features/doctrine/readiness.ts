import type { PlanDoctrine } from '$lib/shared/types';

export type ReadinessCheck = {
	key: string;
	label: string;
	passed: boolean;
	required: boolean;
};

export type PlanReadiness = {
	checks: ReadinessCheck[];
	ready: boolean;
	score: number;
};

export function evaluatePlanReadiness(doctrine: PlanDoctrine | null): PlanReadiness {
	const checks: ReadinessCheck[] = [
		{
			key: 'mission_need_gap',
			label: 'Mission Need gap defined',
			passed: !!doctrine?.missionNeed?.gap,
			required: true,
		},
		{
			key: 'mission_need_priority',
			label: 'Mission Need priority set',
			passed: !!doctrine?.missionNeed?.priority,
			required: false,
		},
		{
			key: 'intent_purpose',
			label: "Commander's Intent purpose defined",
			passed: !!doctrine?.commandersIntent?.purpose,
			required: true,
		},
		{
			key: 'intent_end_state',
			label: "Commander's Intent end state defined",
			passed: !!doctrine?.commandersIntent?.endState,
			required: false,
		},
		{
			key: 'intent_key_tasks',
			label: 'At least one key task',
			passed: (doctrine?.commandersIntent?.keyTasks?.length ?? 0) > 0,
			required: false,
		},
		{
			key: 'oplan_mission',
			label: 'OPLAN mission statement',
			passed: !!doctrine?.oplan?.missionStatement,
			required: false,
		},
	];

	const requiredChecks = checks.filter((c) => c.required);
	const ready = requiredChecks.every((c) => c.passed);
	const passed = checks.filter((c) => c.passed).length;
	const score = checks.length > 0 ? passed / checks.length : 0;

	return { checks, ready, score };
}
