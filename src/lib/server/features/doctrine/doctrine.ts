import type {
	Aar,
	AarLesson,
	CommandersIntent,
	ConopsDecisionPoint,
	ConopsPhase,
	DoctrineLifecycle,
	Frago,
	MissionNeed,
	Oplan,
	Opord,
	PlanDoctrine,
	TaskTraceability,
} from '$lib/shared/types';

type CreateConopsPhaseInput = {
	ordinal: number;
	name: string;
	summary?: string | null;
	startEvent?: string | null;
	endEvent?: string | null;
	objectives?: string[];
	decisionPoints?: ConopsDecisionPoint[];
	branches?: string[];
	contingencies?: string[];
};

type UpdateConopsPhaseInput = Partial<CreateConopsPhaseInput> & {
	archived?: boolean;
};

type CreateOpordInput = {
	paragraphs?: Opord['paragraphs'];
};

type UpdateOpordInput = Partial<CreateOpordInput> & {
	status?: Opord['status'];
	issuedAt?: number | null;
	pushedAt?: number | null;
	archived?: boolean;
};

type CreateFragoInput = {
	changeType: Frago['changeType'];
	targets?: Frago['targets'];
	originalText?: string | null;
	amendedText?: string | null;
	reason?: string | null;
	effectiveAt?: number | null;
	issuedAt?: number | null;
	appliedAt?: number | null;
	acknowledgedAt?: number | null;
};

type UpdateFragoInput = Partial<CreateFragoInput> & {
	status?: Frago['status'];
	archived?: boolean;
};

type CreateAarInput = {
	projectId?: string | null;
	opordId?: string | null;
	fragoId?: string | null;
	checkpointId?: string | null;
	whatHappened?: string | null;
	whatWasSupposedToHappen?: string | null;
	whatWentRight?: string | null;
	whatWentWrong?: string | null;
	recommendations?: string | null;
	relatedTaskIds?: string[];
};

type UpdateAarInput = Partial<CreateAarInput> & {
	status?: Aar['status'];
	completedAt?: number | null;
	archived?: boolean;
};

type CreateAarLessonInput = {
	proposedTargetKind?: AarLesson['proposedTargetKind'];
	lesson: string;
	evidence?: string[];
};

type UpdateAarLessonInput = Partial<CreateAarLessonInput> & {
	status?: AarLesson['status'];
	acceptedAt?: number | null;
	rejectedAt?: number | null;
};

type SetTaskTraceabilityInput = TaskTraceability;

export class DoctrinePlanService {
	get(_planId: string): PlanDoctrine | null {
		return notImplemented('DoctrinePlanService.get');
	}

	setLifecycle(_planId: string, _lifecycle: DoctrineLifecycle): PlanDoctrine {
		return notImplemented('DoctrinePlanService.setLifecycle');
	}

	setMissionNeed(_planId: string, _input: MissionNeed): PlanDoctrine {
		return notImplemented('DoctrinePlanService.setMissionNeed');
	}

	setCommandersIntent(_planId: string, _input: CommandersIntent): PlanDoctrine {
		return notImplemented('DoctrinePlanService.setCommandersIntent');
	}

	setLineOfEffort(_planId: string, _lineOfEffort: string[]): PlanDoctrine {
		return notImplemented('DoctrinePlanService.setLineOfEffort');
	}

	setOplan(_planId: string, _input: Oplan): PlanDoctrine {
		return notImplemented('DoctrinePlanService.setOplan');
	}
}

export class ConopsPhaseService {
	list(_planId: string): ConopsPhase[] {
		return notImplemented('ConopsPhaseService.list');
	}

	get(_id: string): ConopsPhase | null {
		return notImplemented('ConopsPhaseService.get');
	}

	create(_planId: string, _input: CreateConopsPhaseInput): ConopsPhase {
		return notImplemented('ConopsPhaseService.create');
	}

	update(_id: string, _input: UpdateConopsPhaseInput): ConopsPhase | null {
		return notImplemented('ConopsPhaseService.update');
	}

	archive(_id: string): ConopsPhase | null {
		return notImplemented('ConopsPhaseService.archive');
	}
}

export class OpordService {
	list(_planId: string): Opord[] {
		return notImplemented('OpordService.list');
	}

	get(_id: string): Opord | null {
		return notImplemented('OpordService.get');
	}

	create(_planId: string, _input: CreateOpordInput = {}): Opord {
		return notImplemented('OpordService.create');
	}

	update(_id: string, _input: UpdateOpordInput): Opord | null {
		return notImplemented('OpordService.update');
	}

	issue(_id: string): Opord | null {
		return notImplemented('OpordService.issue');
	}

	markPushed(_id: string): Opord | null {
		return notImplemented('OpordService.markPushed');
	}
}

export class FragoService {
	list(_opordId: string): Frago[] {
		return notImplemented('FragoService.list');
	}

	get(_id: string): Frago | null {
		return notImplemented('FragoService.get');
	}

	create(_opordId: string, _input: CreateFragoInput): Frago {
		return notImplemented('FragoService.create');
	}

	update(_id: string, _input: UpdateFragoInput): Frago | null {
		return notImplemented('FragoService.update');
	}

	preview(_id: string): Frago | null {
		return notImplemented('FragoService.preview');
	}

	apply(_id: string): Frago | null {
		return notImplemented('FragoService.apply');
	}
}

export class AarService {
	list(_planId: string): Aar[] {
		return notImplemented('AarService.list');
	}

	get(_id: string): Aar | null {
		return notImplemented('AarService.get');
	}

	create(_planId: string, _input: CreateAarInput = {}): Aar {
		return notImplemented('AarService.create');
	}

	update(_id: string, _input: UpdateAarInput): Aar | null {
		return notImplemented('AarService.update');
	}

	complete(_id: string): Aar | null {
		return notImplemented('AarService.complete');
	}

	addLesson(_aarId: string, _input: CreateAarLessonInput): AarLesson {
		return notImplemented('AarService.addLesson');
	}

	updateLesson(_lessonId: string, _input: UpdateAarLessonInput): AarLesson | null {
		return notImplemented('AarService.updateLesson');
	}
}

export class TaskTraceabilityService {
	get(_taskId: string): TaskTraceability | null {
		return notImplemented('TaskTraceabilityService.get');
	}

	set(_taskId: string, _input: SetTaskTraceabilityInput): TaskTraceability {
		return notImplemented('TaskTraceabilityService.set');
	}

	clear(_taskId: string): boolean {
		return notImplemented('TaskTraceabilityService.clear');
	}

	listByOpord(_opordId: string): Array<{ taskId: string } & TaskTraceability> {
		return notImplemented('TaskTraceabilityService.listByOpord');
	}

	listByFrago(_fragoId: string): Array<{ taskId: string } & TaskTraceability> {
		return notImplemented('TaskTraceabilityService.listByFrago');
	}

	listByPhase(_phaseId: string): Array<{ taskId: string } & TaskTraceability> {
		return notImplemented('TaskTraceabilityService.listByPhase');
	}
}

function notImplemented<T>(method: string): T {
	throw new Error(`Not implemented in 101: ${method}`);
}
