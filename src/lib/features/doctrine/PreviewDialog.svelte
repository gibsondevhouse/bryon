<script lang="ts">
import { AlertTriangle } from '@lucide/svelte';
import { Button } from '$lib/ui/button';
import * as Dialog from '$lib/ui/dialog';

let {
	open = $bindable(false),
	title,
	summary = null,
	warnings = [],
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	loading = false,
	error = null,
	onConfirm,
	onCancel,
	children,
}: {
	open: boolean;
	title: string;
	summary?: string | null;
	warnings?: string[];
	confirmLabel?: string;
	cancelLabel?: string;
	loading?: boolean;
	error?: string | null;
	onConfirm: () => void;
	onCancel?: () => void;
	children?: import('svelte').Snippet;
} = $props();

function handleCancel(): void {
	open = false;
	onCancel?.();
}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content class="preview-dialog-content">
			<Dialog.Header>
				<Dialog.Title>{title}</Dialog.Title>
				{#if summary}
					<Dialog.Description>{summary}</Dialog.Description>
				{/if}
			</Dialog.Header>

			{#if warnings.length > 0}
				<div class="warnings">
					{#each warnings as warning}
						<div class="warning-row">
							<AlertTriangle size={14} />
							<span>{warning}</span>
						</div>
					{/each}
				</div>
			{/if}

			{#if children}
				<div class="preview-body">
					{@render children()}
				</div>
			{/if}

			{#if error}
				<div class="error-msg">{error}</div>
			{/if}

			<Dialog.Footer>
				<Button variant="outline" onclick={handleCancel} disabled={loading}>{cancelLabel}</Button>
				<Button onclick={onConfirm} disabled={loading}>
					{loading ? 'Processing...' : confirmLabel}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
.warnings {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
	padding: var(--sp-3);
	border: 1px solid rgba(251, 191, 36, 0.2);
	border-radius: var(--radius-sm);
	background: rgba(251, 191, 36, 0.06);
}

.warning-row {
	display: flex;
	align-items: flex-start;
	gap: var(--sp-2);
	font-size: 12.5px;
	color: #fcd34d;
}

.preview-body {
	max-height: 400px;
	overflow-y: auto;
}

.error-msg {
	font-size: 12.5px;
	color: #fca5a5;
	padding: var(--sp-2);
}
</style>
