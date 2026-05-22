<script lang="ts">
import {
	planLifecycleLabel,
	opordStatusLabel,
	fragoStatusLabel,
	aarStatusLabel,
	taskStatusLabel,
} from './labels';
import type {
	DoctrineLifecycle,
	OpordStatus,
	FragoStatus,
	AarStatus,
	TaskStatus,
} from '$lib/shared/types';

type StatusKind = 'plan' | 'opord' | 'frago' | 'aar' | 'task';

let {
	kind,
	status,
}: {
	kind: StatusKind;
	status: string;
} = $props();

const label = $derived.by(() => {
	switch (kind) {
		case 'plan': return planLifecycleLabel(status as DoctrineLifecycle);
		case 'opord': return opordStatusLabel(status as OpordStatus);
		case 'frago': return fragoStatusLabel(status as FragoStatus);
		case 'aar': return aarStatusLabel(status as AarStatus);
		case 'task': return taskStatusLabel(status as TaskStatus);
	}
});

const variant = $derived.by(() => {
	if (status === 'active' || status === 'issued' || status === 'in_progress') return 'active';
	if (status === 'blocked') return 'danger';
	if (status === 'archived' || status === 'superseded') return 'muted';
	if (status === 'applied' || status === 'complete' || status === 'completed') return 'success';
	if (status === 'draft' || status === 'proposed' || status === 'drafting') return 'draft';
	if (status === 'in_review' || status === 'planned') return 'info';
	return 'default';
});
</script>

<span class="badge {variant}" title="{kind}: {label}">{label}</span>

<style>
.badge {
	display: inline-flex;
	align-items: center;
	padding: 2px 8px;
	font-size: 10px;
	font-weight: 600;
	letter-spacing: 0.04em;
	text-transform: uppercase;
	border-radius: 999px;
	white-space: nowrap;
}

.default {
	color: var(--text-muted);
	background: rgba(255, 255, 255, 0.06);
}

.draft {
	color: var(--text-secondary);
	background: rgba(255, 255, 255, 0.08);
}

.info {
	color: #93c5fd;
	background: rgba(59, 130, 246, 0.14);
}

.active {
	color: var(--accent-text);
	background: var(--accent-soft);
}

.success {
	color: #6ee7b7;
	background: rgba(52, 211, 153, 0.14);
}

.danger {
	color: #fca5a5;
	background: rgba(248, 113, 113, 0.14);
}

.muted {
	color: var(--text-muted);
	background: rgba(255, 255, 255, 0.04);
}
</style>
