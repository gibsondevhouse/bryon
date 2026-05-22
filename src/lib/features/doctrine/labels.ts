import { doctrineTerms } from '$lib/shared/doctrine';
import type {
	DoctrineLifecycle,
	OpordStatus,
	FragoStatus,
	AarStatus,
	TaskStatus,
	MissionNeedPriority,
	TaskSourceKind,
	PlanCardSeries,
} from '$lib/shared/types';

export type DoctrineLabelMode = 'doctrine_only' | 'doctrine_with_helper' | 'plain_first';

export function doctrineLabel(term: keyof typeof doctrineTerms, mode: DoctrineLabelMode): string {
	const formal = doctrineTerms[term];
	switch (mode) {
		case 'doctrine_only':
			return formal;
		case 'doctrine_with_helper':
			return `${formal} (${helperLabel(term)})`;
		case 'plain_first':
			return helperLabel(term);
	}
}

function helperLabel(term: keyof typeof doctrineTerms): string {
	const map: Record<keyof typeof doctrineTerms, string> = {
		missionNeed: 'Why This Exists',
		commandersIntent: 'Desired Outcome',
		conops: 'Phase Plan',
		oplan: 'Master Plan',
		opord: 'Directive',
		frago: 'Change Order',
		tacticalExecution: 'Active Work',
		aar: 'Review',
	};
	return map[term];
}

const PLAN_LIFECYCLE_LABELS: Record<DoctrineLifecycle, string> = {
	proposed: 'Proposed',
	drafting: 'Drafting',
	active: 'Active',
	archived: 'Archived',
};

const OPORD_STATUS_LABELS: Record<OpordStatus, string> = {
	draft: 'Draft',
	issued: 'Issued',
	superseded: 'Superseded',
	archived: 'Archived',
};

const FRAGO_STATUS_LABELS: Record<FragoStatus, string> = {
	draft: 'Draft',
	issued: 'Issued',
	applied: 'Applied',
	archived: 'Archived',
};

const AAR_STATUS_LABELS: Record<AarStatus, string> = {
	draft: 'Draft',
	in_review: 'In Review',
	complete: 'Complete',
	archived: 'Archived',
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
	proposed: 'Proposed',
	planned: 'Not Started',
	in_progress: 'In Progress',
	blocked: 'Blocked',
	completed: 'Completed',
	archived: 'Archived',
};

const PRIORITY_LABELS: Record<MissionNeedPriority, string> = {
	low: 'Low',
	medium: 'Medium',
	high: 'High',
	critical: 'Critical',
};

const SOURCE_KIND_LABELS: Record<TaskSourceKind, string> = {
	manual: 'Manual',
	opord: 'OPORD',
	frago: 'FRAGO',
	intake: 'Intake',
	expansion: 'Expansion',
};

const SERIES_LABELS: Record<PlanCardSeries, string> = {
	'100': '100 Purpose',
	'200': '200 Context',
	'300': '300 Goals',
	'400': '400 Rules',
	'500': '500 Standards',
	'600': '600 Tools & Sources',
	'700': '700 Workflows',
	'800': '800 Projects',
	'900': '900 Actions',
	'1000': '1000 Review',
};

export function planLifecycleLabel(status: DoctrineLifecycle): string {
	return PLAN_LIFECYCLE_LABELS[status];
}

export function opordStatusLabel(status: OpordStatus): string {
	return OPORD_STATUS_LABELS[status];
}

export function fragoStatusLabel(status: FragoStatus): string {
	return FRAGO_STATUS_LABELS[status];
}

export function aarStatusLabel(status: AarStatus): string {
	return AAR_STATUS_LABELS[status];
}

export function taskStatusLabel(status: TaskStatus): string {
	return TASK_STATUS_LABELS[status];
}

export function priorityLabel(priority: MissionNeedPriority): string {
	return PRIORITY_LABELS[priority];
}

export function sourceKindLabel(kind: TaskSourceKind): string {
	return SOURCE_KIND_LABELS[kind];
}

export function seriesLabel(series: PlanCardSeries): string {
	return SERIES_LABELS[series];
}
