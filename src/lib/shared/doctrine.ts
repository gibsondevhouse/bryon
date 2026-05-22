export const doctrineTerms = {
	missionNeed: 'Mission Need',
	commandersIntent: "Commander's Intent",
	conops: 'CONOPS',
	oplan: 'OPLAN',
	opord: 'OPORD',
	frago: 'FRAGO',
	tacticalExecution: 'Tactical Execution',
	aar: 'AAR',
} as const;

export type DoctrineTerm = keyof typeof doctrineTerms;

export const doctrineLifecycleValues = [
	'proposed',
	'drafting',
	'active',
	'archived',
] as const;

export const opordStatusValues = [
	'draft',
	'issued',
	'superseded',
	'archived',
] as const;

export const fragoStatusValues = [
	'draft',
	'issued',
	'applied',
	'archived',
] as const;

export const aarStatusValues = [
	'draft',
	'in_review',
	'complete',
	'archived',
] as const;

export const doctrineSourceValues = [
	'folder_intake',
	'manual_entry',
	'chat_command',
	'imported_document',
] as const;

export const doctrinePriorityValues = [
	'low',
	'medium',
	'high',
	'critical',
] as const;

export const taskSourceKindValues = [
	'manual',
	'opord',
	'frago',
	'intake',
	'expansion',
] as const;

export const lessonTargetKindValues = [
	'review',
	'rule',
	'standard',
	'workflow',
	'project',
] as const;
