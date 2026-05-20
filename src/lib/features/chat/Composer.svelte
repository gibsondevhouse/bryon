<script lang="ts">
import { Send, Square, Paperclip, X, FileText } from '@lucide/svelte';
import ComposerToolbar from './ComposerToolbar.svelte';
import ComposerFeedback from './ComposerFeedback.svelte';
import type { Attachment } from '$lib/shared/types';

const ACCEPTED_MIMES = [
	'image/png',
	'image/jpeg',
	'image/webp',
	'application/pdf',
	'text/plain',
	'text/markdown',
	'text/html',
	'application/xhtml+xml',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const ACCEPTED_EXTENSIONS = [
	'.png',
	'.jpg',
	'.jpeg',
	'.webp',
	'.pdf',
	'.txt',
	'.md',
	'.markdown',
	'.html',
	'.htm',
	'.docx',
	'.xlsx',
	'.pptx',
];

type PendingAttachment = {
	id: string;
	previewUrl: string;
	file: File;
	kind: 'image' | 'document';
	state: 'queued' | 'processing' | 'ready' | 'error';
	error?: string;
};

let {
	chatId,
	draft = $bindable(''),
	streaming = false,
	disabled = false,
	webSearch = $bindable(false),
	commandFeedback = $bindable<string | null>(null),
	onSend,
	onCancel,
	onSlashCommand,
}: {
	chatId?: string;
	draft?: string;
	streaming?: boolean;
	disabled?: boolean;
	webSearch?: boolean;
	commandFeedback?: string | null;
	onSend: (content: string, options?: {
		attachments?: Attachment[];
		projectFileIds?: string[];
		webSearch?: boolean;
	}) => void;
	onCancel: () => void;
	onSlashCommand: (input: string) => Promise<{ handled: boolean; error?: string; info?: string }>;
} = $props();

let textarea: HTMLTextAreaElement | undefined = $state();
let fileInput: HTMLInputElement | undefined = $state();
let pending = $state<PendingAttachment[]>([]);
let uploading = $state(false);
let uploadError = $state<string | null>(null);
let dragCounter = $state(0);
let dragOver = $derived(dragCounter > 0);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

function handleKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape' && streaming) {
		event.preventDefault();
		onCancel();
		return;
	}

	if (event.key === 'Enter' && !event.shiftKey) {
		event.preventDefault();
		void submit();
	}
}

async function submit(): Promise<void> {
	const value = draft.trim();
	if (!value) return;

	if (value.startsWith('/')) {
		void onSlashCommand(value).then((result) => {
			if (result.handled) {
				commandFeedback = result.error ?? result.info ?? null;
			} else {
				commandFeedback = null;
				void sendWithAttachments(value);
			}
		});
		draft = '';
		resizeTextarea();
		return;
	}

	commandFeedback = null;
	await sendWithAttachments(value);
	draft = '';
	resizeTextarea();
}

async function sendWithAttachments(content: string): Promise<void> {
	if (pending.length === 0 || !chatId) {
		onSend(content, { webSearch });
		return;
	}

	uploading = true;
	uploadError = null;

	try {
		const fd = new FormData();
		for (const p of pending) fd.append('files', p.file);

		const res = await fetch(`/api/chats/${chatId}/uploads`, {
			method: 'POST',
			body: fd,
		});

		if (!res.ok) {
			const body = await res.json().catch(() => null);
			uploadError = body?.error?.message ?? `Upload failed (${res.status}).`;
			return;
		}

		const { attachments } = (await res.json()) as { attachments: Attachment[] };
		clearPending();
		onSend(content, { attachments, webSearch });
	} catch (err) {
		uploadError = (err as Error).message || 'Upload failed.';
	} finally {
		uploading = false;
	}
}

function resizeTextarea(): void {
	if (!textarea) return;
	textarea.style.height = 'auto';
	textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
}

function handleInput(): void {
	resizeTextarea();
	if (commandFeedback) commandFeedback = null;
}

function addFiles(files: FileList | File[]): void {
	uploadError = null;
	const newPending: PendingAttachment[] = [];

	for (const file of Array.from(files)) {
		const id = Math.random().toString(36).slice(2);
		const kind =
			file.type.startsWith('image/') || isImageName(file.name)
				? 'image'
				: 'document';

		if (!isAccepted(file)) {
			uploadError = `"${file.name}" is an unsupported file type.`;
			continue;
		}

		if (file.size > MAX_FILE_SIZE) {
			uploadError = `"${file.name}" is too large (max 25MB).`;
			continue;
		}

		const previewUrl = kind === 'image' ? URL.createObjectURL(file) : '';
		newPending.push({
			id,
			previewUrl,
			file,
			kind,
			state: 'ready',
		});
	}

	pending = [...pending, ...newPending];
}

function removeAttachment(index: number): void {
	if (pending[index].previewUrl) URL.revokeObjectURL(pending[index].previewUrl);
	pending = pending.filter((_, i) => i !== index);
}

function clearPending(): void {
	for (const p of pending) {
		if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
	}
	pending = [];
}

function handleFileInputChange(event: Event): void {
	const input = event.currentTarget as HTMLInputElement;
	if (input.files?.length) addFiles(input.files);
	input.value = '';
}

function handleDragEnter(event: DragEvent): void {
	event.preventDefault();
	if (event.dataTransfer?.types.includes('Files')) {
		dragCounter++;
	}
}

function handleDragOver(event: DragEvent): void {
	event.preventDefault();
}

function handleDragLeave(): void {
	dragCounter = Math.max(0, dragCounter - 1);
}

function handleDrop(event: DragEvent): void {
	event.preventDefault();
	dragCounter = 0;
	const files = event.dataTransfer?.files;
	if (files?.length) addFiles(files);
}

function handlePaste(event: ClipboardEvent): void {
	const items = Array.from(event.clipboardData?.items ?? []);
	const imageItems = items.filter((item) => ACCEPTED_MIMES.includes(item.type));
	if (imageItems.length === 0) return;
	event.preventDefault();
	const files = imageItems.map((item) => item.getAsFile()).filter((f): f is File => f !== null);
	if (files.length) addFiles(files);
}

function isAccepted(file: File): boolean {
	if (ACCEPTED_MIMES.includes(file.type)) return true;
	const lower = file.name.toLowerCase();
	return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isImageName(name: string): boolean {
	const lower = name.toLowerCase();
	return ['.png', '.jpg', '.jpeg', '.webp'].some((ext) => lower.endsWith(ext));
}

function toggleWebSearch(): void {
	webSearch = !webSearch;
}

export function focus(): void {
	textarea?.focus();
}
</script>

<div
	class="composer-wrap"
	class:drag-active={dragOver}
	role="region"
	aria-label="Message composer"
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	{#if dragOver}
		<div class="drag-overlay">
			<div class="drag-prompt">
				<Paperclip size={24} />
				<span>Drop to attach</span>
			</div>
		</div>
	{/if}
	{#if commandFeedback}
		<ComposerFeedback message={commandFeedback} />
	{/if}

	{#if uploadError}
		<div class="upload-error">{uploadError}</div>
	{/if}

	{#if pending.length > 0}
		<div class="thumb-strip">
			{#each pending as p, i (p.id)}
				<div class="thumb" class:uploading={uploading}>
					{#if p.kind === 'image'}
						<img src={p.previewUrl} alt="attachment {i + 1}" />
					{:else}
						<div class="doc-thumb" title={p.file.name}>
							<FileText size={18} />
							<span>{p.file.name}</span>
						</div>
					{/if}

					{#if uploading}
						<div class="thumb-overlay">
							<span class="spinner"></span>
						</div>
					{/if}

					<button
						class="thumb-remove"
						onclick={() => removeAttachment(i)}
						disabled={uploading}
						title="Remove"
						aria-label="Remove attachment"
					>
						<X size={10} />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<div class="pill">
		<textarea
			bind:this={textarea}
			bind:value={draft}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onpaste={handlePaste}
			placeholder={streaming ? 'Generating...' : 'Message Bryon...'}
			disabled={disabled || streaming || uploading}
			rows="1"
			class="input"
		></textarea>

		{#if chatId}
			<button
				class="attach-btn"
				onclick={() => fileInput?.click()}
				disabled={disabled || streaming}
				title="Attach photo or document"
				aria-label="Attach photo or document"
			>
				<Paperclip size={16} />
			</button>
			<input
				bind:this={fileInput}
				type="file"
				accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/markdown,text/html,.md,.markdown,.html,.htm,.docx,.xlsx,.pptx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
				multiple
				class="sr-only"
				onchange={handleFileInputChange}
			/>
		{/if}

		{#if streaming}
			<button class="send-btn cancel" onclick={onCancel} title="Stop (Esc)" aria-label="Stop generating">
				<Square size={18} />
			</button>
		{:else}
			<button
				class="send-btn"
				onclick={() => void submit()}
				disabled={disabled || uploading || (!draft.trim() && pending.length === 0)}
				title="Send (Enter)"
				aria-label="Send message"
			>
				<Send size={18} />
			</button>
		{/if}
	</div>

	<ComposerToolbar {webSearch} onToggleWebSearch={toggleWebSearch} />
</div>

<style>
.composer-wrap {
	display: flex;
	flex-direction: column;
	gap: var(--sp-2);
	max-width: var(--content-max-w);
	width: 100%;
	margin: 0 auto;
	padding: 0 var(--sp-6) var(--sp-4);
	border-radius: var(--radius-xl);
	transition: background 0.15s;
}

.composer-wrap.drag-active {
	background: var(--accent-soft);
}

.drag-overlay {
	position: absolute;
	inset: 0;
	z-index: 50;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--accent-soft);
	border: 2px dashed var(--accent);
	border-radius: var(--radius-xl);
	pointer-events: none;
	animation: fadeIn 0.15s ease-out;
}

.drag-prompt {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--sp-2);
	color: var(--accent);
	font-weight: 600;
}

@keyframes fadeIn {
	from { opacity: 0; }
	to { opacity: 1; }
}

/* ── Thumbnail strip ── */
.thumb-strip {
	display: flex;
	flex-wrap: wrap;
	gap: var(--sp-2);
	padding: 0 var(--sp-1);
}

.thumb {
	position: relative;
	width: 56px;
	height: 56px;
	border-radius: var(--radius-sm);
	overflow: hidden;
	border: 1px solid var(--border-default);
	flex-shrink: 0;
	transition: opacity 0.2s;
}

.thumb.uploading {
	opacity: 0.7;
}

.thumb-overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.4);
	display: grid;
	place-items: center;
}

.spinner {
	width: 16px;
	height: 16px;
	border: 2px solid rgba(255, 255, 255, 0.3);
	border-top-color: white;
	border-radius: 50%;
	animation: spin 0.8s linear infinite;
}

@keyframes spin {
	to { transform: rotate(360deg); }
}

.doc-thumb {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 2px;
	width: 100%;
	height: 100%;
	padding: 4px;
	background: var(--bg-surface);
	color: var(--text-muted);
	font-size: 9px;
	line-height: 1.1;
	text-align: center;
}

.doc-thumb span {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
	max-width: 48px;
}

.thumb img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.thumb-remove {
	position: absolute;
	top: 2px;
	right: 2px;
	display: grid;
	place-items: center;
	width: 16px;
	height: 16px;
	border-radius: 50%;
	background: rgba(0, 0, 0, 0.65);
	color: white;
	border: none;
	cursor: pointer;
	padding: 0;
}

.thumb-remove:hover {
	background: rgba(185, 28, 28, 0.85);
}

/* ── Upload error ── */
.upload-error {
	font-size: 12px;
	color: #b91c1c;
	padding: 0 var(--sp-1);
}

/* ── Pill input ── */
.pill {
	display: flex;
	align-items: flex-end;
	gap: var(--sp-2);
	padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
	border-radius: var(--radius-xl);
	background: var(--bg-surface);
	border: 1px solid var(--border-subtle);
	box-shadow: var(--shadow-composer);
	transition: border-color 180ms ease;
}

.pill:focus-within {
	border-color: var(--border-default);
}

.input {
	flex: 1;
	min-height: 24px;
	max-height: 180px;
	resize: none;
	border: none;
	background: transparent;
	padding: var(--sp-1) 0;
	font-family: inherit;
	font-size: 15px;
	line-height: 1.5;
	color: var(--text-primary);
	outline: none;
}

.input::placeholder {
	color: var(--text-placeholder);
}

.input:disabled {
	opacity: 0.4;
}

/* ── Attach button ── */
.attach-btn {
	display: grid;
	place-items: center;
	width: 32px;
	height: 32px;
	flex-shrink: 0;
	border: none;
	border-radius: 50%;
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	transition: background 120ms, color 120ms;
}

.attach-btn:hover:not(:disabled) {
	background: var(--bg-input);
	color: var(--text-primary);
}

.attach-btn:disabled {
	opacity: 0.25;
	cursor: not-allowed;
}

/* ── Send button ── */
.send-btn {
	display: grid;
	place-items: center;
	width: 36px;
	height: 36px;
	flex-shrink: 0;
	border: none;
	border-radius: 50%;
	background: var(--accent);
	color: white;
	cursor: pointer;
	transition: background 120ms, opacity 120ms;
}

.send-btn:hover:not(:disabled) {
	background: var(--accent-hover);
}

.send-btn:disabled {
	opacity: 0.25;
	cursor: not-allowed;
}

.send-btn.cancel {
	background: transparent;
	border: 1px solid var(--border-default);
	color: var(--text-muted);
}

.send-btn.cancel:hover {
	background: var(--bg-surface-hover);
	color: var(--red);
	border-color: var(--red);
}

.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip: rect(0 0 0 0);
}
</style>
