import type { TaskTraceability, TaskSourceKind } from '$lib/shared/types';

export type TraceabilityDisplay = {
	hasTraceability: boolean;
	sourceLabel: string;
	fields: TraceabilityField[];
};

export type TraceabilityField = {
	key: string;
	label: string;
	value: string | null;
	present: boolean;
};

export function toTraceabilityDisplay(trace: TaskTraceability | null): TraceabilityDisplay {
	if (!trace) {
		return {
			hasTraceability: false,
			sourceLabel: 'Manual',
			fields: [],
		};
	}

	const fields: TraceabilityField[] = [
		{ key: 'sourceKind', label: 'Source', value: trace.sourceKind, present: true },
		{ key: 'sourceKey', label: 'Source Key', value: trace.sourceKey, present: !!trace.sourceKey },
		{ key: 'sourceOpordId', label: 'OPORD', value: trace.sourceOpordId, present: !!trace.sourceOpordId },
		{ key: 'sourceOpordParagraph', label: 'Paragraph', value: trace.sourceOpordParagraph, present: !!trace.sourceOpordParagraph },
		{ key: 'sourceFragoId', label: 'FRAGO', value: trace.sourceFragoId, present: !!trace.sourceFragoId },
		{ key: 'phaseId', label: 'CONOPS Phase', value: trace.phaseId, present: !!trace.phaseId },
		{ key: 'pushBatchId', label: 'Push Batch', value: trace.pushBatchId, present: !!trace.pushBatchId },
		{ key: 'sourceFingerprint', label: 'Fingerprint', value: trace.sourceFingerprint, present: !!trace.sourceFingerprint },
	];

	const hasTraceability = trace.sourceKind !== 'manual' || !!trace.sourceKey;

	return {
		hasTraceability,
		sourceLabel: formatSourceKind(trace.sourceKind),
		fields: fields.filter((f) => f.present),
	};
}

function formatSourceKind(kind: TaskSourceKind): string {
	const labels: Record<TaskSourceKind, string> = {
		manual: 'Manual',
		opord: 'OPORD',
		frago: 'FRAGO',
		intake: 'Intake',
		expansion: 'Expansion',
	};
	return labels[kind];
}
