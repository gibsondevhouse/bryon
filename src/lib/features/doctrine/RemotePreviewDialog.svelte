<script lang="ts">
import { ShieldAlert } from '@lucide/svelte';
import { Button } from '$lib/ui/button';
import * as Dialog from '$lib/ui/dialog';

type RemotePreview = {
	taskType: string;
	tier: 3 | 4;
	model: string;
	requiresApproval: boolean;
	blockedCategories: string[];
	reason: string;
};

let {
	open = $bindable(false),
	preview,
	onApprove,
	onCancel,
	loading = false,
}: {
	open: boolean;
	preview: RemotePreview | null;
	onApprove: () => void;
	onCancel?: () => void;
	loading?: boolean;
} = $props();

function cancel(): void {
	open = false;
	onCancel?.();
}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content class="remote-preview">
			<Dialog.Header>
				<Dialog.Title>Remote Model Preview</Dialog.Title>
				<Dialog.Description>
					Review context routing before remote model use.
				</Dialog.Description>
			</Dialog.Header>

			{#if preview}
				<div class="preview-warning">
					<ShieldAlert size={16} />
					<span>{preview.reason}</span>
				</div>
				<dl>
					<div><dt>Task</dt><dd>{preview.taskType}</dd></div>
					<div><dt>Tier</dt><dd>Tier {preview.tier}</dd></div>
					<div><dt>Model</dt><dd>{preview.model}</dd></div>
					<div><dt>Approval</dt><dd>{preview.requiresApproval ? 'Required' : 'Not required by policy'}</dd></div>
				</dl>
				{#if preview.blockedCategories.length > 0}
					<div class="blocked">
						<strong>Local-only categories</strong>
						<p>{preview.blockedCategories.join(', ')}</p>
					</div>
				{/if}
			{/if}

			<Dialog.Footer>
				<Button variant="outline" onclick={cancel} disabled={loading}>Cancel</Button>
				<Button onclick={onApprove} disabled={loading || !preview || preview.blockedCategories.length > 0}>
					{loading ? 'Approving...' : 'Approve remote route'}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
.preview-warning {
	display: flex;
	gap: var(--sp-2);
	align-items: flex-start;
	padding: var(--sp-3);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-sm);
	background: var(--bg-surface-hover);
	color: var(--text-primary);
	font-size: 13px;
}

dl {
	display: grid;
	gap: var(--sp-2);
	margin: 0;
}

dl div {
	display: grid;
	grid-template-columns: 110px minmax(0, 1fr);
	gap: var(--sp-3);
}

dt {
	color: var(--text-muted);
	font-size: 12px;
}

dd {
	margin: 0;
	color: var(--text-primary);
	font-size: 13px;
}

.blocked {
	padding: var(--sp-3);
	border: 1px solid color-mix(in srgb, var(--red) 30%, transparent);
	border-radius: var(--radius-sm);
	background: color-mix(in srgb, var(--red) 8%, transparent);
}

.blocked strong,
.blocked p {
	margin: 0;
	color: var(--red);
	font-size: 13px;
}

.blocked p {
	margin-top: var(--sp-1);
}
</style>
