<script lang="ts">
import { X, AlertCircle, Info, CheckCircle } from '@lucide/svelte';
import { errorChannel, type AppError } from '../features/streaming/error-channel.svelte';

function remove(id: string) {
    errorChannel.remove(id);
}
</script>

<div class="toast-container" role="alert" aria-live="assertive">
    {#each errorChannel.errors.filter(e => e.type === 'system') as error (error.id)}
        <div class="toast" class:error={error.severity === 'error'} class:warn={error.severity === 'warning'} class:info={error.severity === 'info'}>
            <div class="icon">
                {#if error.severity === 'error'}
                    <AlertCircle size={18} />
                {:else if error.severity === 'warning'}
                    <AlertCircle size={18} />
                {:else}
                    <Info size={18} />
                {/if}
            </div>
            <div class="content">
                <div class="message">{error.message}</div>
            </div>
            <button class="close" onclick={() => remove(error.id)} aria-label="Close notification">
                <X size={14} />
            </button>
        </div>
    {/each}
</div>

<style>
.toast-container {
    position: fixed;
    top: var(--sp-4);
    right: var(--sp-4);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    pointer-events: none;
}

.toast {
    pointer-events: auto;
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
    min-width: 280px;
    max-width: 420px;
    padding: var(--sp-3) var(--sp-4);
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    animation: slideIn 0.2s ease-out;
}

.toast.error { border-left: 4px solid var(--red); }
.toast.warn { border-left: 4px solid var(--amber); }
.toast.info { border-left: 4px solid var(--accent); }

.icon {
    flex-shrink: 0;
    margin-top: 2px;
}

.toast.error .icon { color: var(--red); }
.toast.warn .icon { color: var(--amber); }
.toast.info .icon { color: var(--accent); }

.content {
    flex: 1;
    min-width: 0;
}

.message {
    font-size: 13px;
    line-height: 1.4;
    color: var(--text-primary);
}

.close {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    margin-top: 2px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
}

.close:hover {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
}

@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
</style>
