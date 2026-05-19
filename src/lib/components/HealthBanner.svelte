<script lang="ts">
import { AlertTriangle, RefreshCw } from '@lucide/svelte';

let {
	reachable = true,
	baseUrl,
	showRetry = false,
	retrying = false,
	errorMessage = null,
	onRetry,
	compact = false
}: {
	reachable?: boolean;
	baseUrl?: string;
	showRetry?: boolean;
	retrying?: boolean;
	errorMessage?: string | null;
	onRetry?: () => void | Promise<void>;
	compact?: boolean;
} = $props();

const __templateUsage = () => [
	reachable,
	baseUrl,
	showRetry,
	retrying,
	errorMessage,
	onRetry,
	compact,
	AlertTriangle,
	RefreshCw,
];
void __templateUsage;

</script>

{#if !reachable}
	<div class="health-banner" class:compact role="status" aria-live="polite" data-testid="ollama-health-banner">
		<div class="banner-copy">
			<span class="icon-wrap" aria-hidden="true">
				<AlertTriangle size={14} />
			</span>
			<div>
				<p class="title">Ollama unavailable</p>
				<p class="body">
					Bryon can’t reach Ollama{#if baseUrl} at <code>{baseUrl}</code>{/if}. Run <code>ollama serve</code>.
				</p>
				{#if errorMessage}
					<p class="error">{errorMessage}</p>
				{/if}
			</div>
		</div>

		{#if showRetry && onRetry}
			<button class="retry-btn" onclick={onRetry} disabled={retrying} aria-label="Retry Ollama health check">
				<span class:spin={retrying} aria-hidden="true">
					<RefreshCw size={14} />
				</span>
				<span>{retrying ? 'Retrying…' : 'Retry'}</span>
			</button>
		{/if}
	</div>
{/if}

<style>
.health-banner {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--sp-4);
	border: 1px solid rgba(239, 68, 68, 0.3);
	border-radius: var(--radius-md);
	background: rgba(239, 68, 68, 0.08);
	padding: var(--sp-3) var(--sp-4);
	color: var(--text-secondary);
}

.health-banner.compact {
	padding: var(--sp-2) var(--sp-3);
}

.banner-copy {
	display: flex;
	align-items: flex-start;
	gap: var(--sp-2);
	min-width: 0;
}

.icon-wrap {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	border-radius: 999px;
	color: var(--red);
	flex-shrink: 0;
}

.title {
	margin: 0;
	font-size: 13px;
	font-weight: 600;
	color: var(--text-primary);
}

.body {
	margin: 0;
	font-size: 12.5px;
	color: var(--text-secondary);
}

.body code {
	border-radius: 4px;
	padding: 1px 5px;
	background: rgba(255, 255, 255, 0.08);
	font-size: 12px;
}

.error {
	margin: var(--sp-1) 0 0;
	font-size: 12px;
	color: #fca5a5;
}

.retry-btn {
	display: inline-flex;
	align-items: center;
	gap: var(--sp-2);
	height: 30px;
	padding: 0 var(--sp-3);
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-primary);
	font-size: 12px;
	font-weight: 500;
	cursor: pointer;
	transition:
		background var(--motion-fast),
		color var(--motion-fast),
		border-color var(--motion-fast);
}

.retry-btn:hover:not(:disabled) {
	background: var(--bg-surface-hover);
	border-color: var(--border-strong);
}

.retry-btn:disabled {
	opacity: 0.65;
	cursor: default;
}

.spin {
	animation: spin 1s linear infinite;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
