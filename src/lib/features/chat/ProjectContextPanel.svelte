<script lang="ts">
import { FileText, Search, Upload, X, Save } from '@lucide/svelte';
import { session } from '$lib/features/streaming/session.svelte';
import type { MemoryEntry, Project, ProjectFile, PromptPreset } from '$lib/shared/types';

type SearchHit = {
	chunkId: string;
	projectFileId: string;
	projectId: string;
	fileName: string;
	text: string;
	snippet: string;
};

let {
	project,
	initialFiles = [],
	selectedFileIds = $bindable<string[]>([]),
}: {
	project: Project;
	initialFiles?: ProjectFile[];
	selectedFileIds?: string[];
} = $props();

let files = $state<ProjectFile[]>([]);
let fileInput: HTMLInputElement | undefined = $state();
let uploadError = $state<string | null>(null);
let uploading = $state(false);
let query = $state('');
let searching = $state(false);
let searchResults = $state<SearchHit[]>([]);
let promptOverride = $state('');
let memoryEnabled = $state(true);
let remember = $state('');
let neverSuggest = $state('');
let projectSaving = $state(false);
let projectSaved = $state(false);
let memoryEntries = $state<MemoryEntry[]>([]);
let promptPresets = $state<PromptPreset[]>([]);
let memoryDraft = $state('');
let memoryKind = $state<'remember' | 'never_suggest'>('remember');
let activeProjectId = $state('');
let memoryLoadedFor = $state<string | null>(null);

const visibleFiles = $derived(files.filter((file) => !file.archivedAt));

$effect(() => {
	if (activeProjectId !== project.id) {
		activeProjectId = project.id;
		files = initialFiles;
		selectedFileIds = [];
		query = '';
		searchResults = [];
		promptOverride = project.promptOverride ?? '';
		memoryEnabled = project.memoryEnabled;
		remember = project.remember;
		neverSuggest = project.neverSuggest;
		memoryLoadedFor = project.id;
		void loadMemoryEntries();
		void loadPromptPresets();
	}
	if (memoryLoadedFor !== project.id) {
		memoryLoadedFor = project.id;
		void loadMemoryEntries();
		void loadPromptPresets();
	}
});

$effect(() => {
	files = initialFiles;
});
function toggleFile(fileId: string): void {
	selectedFileIds = selectedFileIds.includes(fileId)
		? selectedFileIds.filter((id) => id !== fileId)
		: [...selectedFileIds, fileId];
}

async function uploadFiles(event: Event): Promise<void> {
	const input = event.currentTarget as HTMLInputElement;
	const selected = Array.from(input.files ?? []);
	input.value = '';
	if (selected.length === 0) return;

	uploading = true;
	uploadError = null;
	const form = new FormData();
	for (const file of selected) form.append('files', file);

	try {
		const response = await fetch(`/api/projects/${project.id}/files`, {
			method: 'POST',
			body: form,
		});
		if (!response.ok) {
			const body = await response.json().catch(() => null);
			uploadError = body?.error?.message ?? `Upload failed (${response.status}).`;
			return;
		}
		const body = (await response.json()) as { files: ProjectFile[] };
		files = [...body.files, ...files];
		const next = new Map(session.projectFiles);
		next.set(project.id, files);
		session.projectFiles = next;
	} catch (error) {
		uploadError = (error as Error).message || 'Upload failed.';
	} finally {
		uploading = false;
	}
}

async function archiveFile(file: ProjectFile): Promise<void> {
	try {
		const response = await fetch(`/api/projects/${project.id}/files/${file.id}`, {
			method: 'DELETE',
		});
		if (!response.ok) return;
		files = files.filter((item) => item.id !== file.id);
		selectedFileIds = selectedFileIds.filter((id) => id !== file.id);
		const next = new Map(session.projectFiles);
		next.set(project.id, files);
		session.projectFiles = next;
	} catch {
		// File remains listed.
	}
}

async function searchFiles(): Promise<void> {
	const text = query.trim();
	if (!text) {
		searchResults = [];
		return;
	}
	searching = true;
	try {
		const response = await fetch(
			`/api/projects/${project.id}/search?q=${encodeURIComponent(text)}`,
		);
		if (!response.ok) return;
		const body = (await response.json()) as { results: SearchHit[] };
		searchResults = body.results;
	} finally {
		searching = false;
	}
}

function attachSearchHit(hit: SearchHit): void {
	if (!selectedFileIds.includes(hit.projectFileId)) {
		selectedFileIds = [...selectedFileIds, hit.projectFileId];
	}
}

async function saveProject(): Promise<void> {
	projectSaving = true;
	projectSaved = false;
	try {
		const updated = await session.updateProject(project.id, {
			promptOverride: promptOverride.trim() || null,
			memoryEnabled,
			remember,
			neverSuggest,
		});
		projectSaved = !!updated;
		if (projectSaved) {
			setTimeout(() => {
				projectSaved = false;
			}, 1800);
		}
	} finally {
		projectSaving = false;
	}
}

async function loadMemoryEntries(): Promise<void> {
	try {
		const response = await fetch(`/api/memory?scope=project&projectId=${project.id}`);
		if (!response.ok) return;
		const body = (await response.json()) as { entries: MemoryEntry[] };
		memoryEntries = body.entries;
	} catch {
		// Keep existing entries.
	}
}

async function loadPromptPresets(): Promise<void> {
	if (promptPresets.length > 0) return;
	try {
		const response = await fetch('/api/prompts/presets');
		if (!response.ok) return;
		const body = (await response.json()) as { presets: PromptPreset[] };
		promptPresets = body.presets;
	} catch {
		// Preset selector stays empty.
	}
}

async function addMemoryEntry(): Promise<void> {
	const body = memoryDraft.trim();
	if (!body) return;
	const response = await fetch('/api/memory', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			scope: 'project',
			projectId: project.id,
			kind: memoryKind,
			body,
		}),
	});
	if (!response.ok) return;
	const payload = (await response.json()) as { entry: MemoryEntry };
	memoryEntries = [payload.entry, ...memoryEntries];
	memoryDraft = '';
}

async function toggleMemory(entry: MemoryEntry): Promise<void> {
	const response = await fetch(`/api/memory/${entry.id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ enabled: !entry.enabled }),
	});
	if (!response.ok) return;
	const payload = (await response.json()) as { entry: MemoryEntry };
	memoryEntries = memoryEntries.map((item) =>
		item.id === entry.id ? payload.entry : item,
	);
}

async function archiveMemory(entry: MemoryEntry): Promise<void> {
	const response = await fetch(`/api/memory/${entry.id}`, { method: 'DELETE' });
	if (!response.ok) return;
	memoryEntries = memoryEntries.filter((item) => item.id !== entry.id);
}
</script>

<section class="project-panel" aria-label="Project context">
	<div class="panel-head">
		<div>
			<p class="eyebrow">Project</p>
			<h2>{project.name}</h2>
		</div>
		<button class="icon-btn" type="button" onclick={() => fileInput?.click()} title="Upload project files" aria-label="Upload project files">
			<Upload size={16} />
		</button>
		<input
			bind:this={fileInput}
			class="sr-only"
			type="file"
			multiple
			onchange={uploadFiles}
		/>
	</div>

	{#if uploadError}
		<p class="error">{uploadError}</p>
	{/if}

	<div class="file-strip" aria-label="Project files">
		{#if visibleFiles.length === 0}
			<span class="muted">{uploading ? 'Uploading...' : 'No project files'}</span>
		{:else}
			{#each visibleFiles as file (file.id)}
				<button
					type="button"
					class="file-chip"
					class:selected={selectedFileIds.includes(file.id)}
					onclick={() => toggleFile(file.id)}
					title={file.name}
				>
					<FileText size={14} />
					<span>{file.name}</span>
				</button>
				<button class="remove-btn" type="button" onclick={() => archiveFile(file)} title="Archive file" aria-label="Archive file">
					<X size={12} />
				</button>
			{/each}
		{/if}
	</div>

	<div class="search-row">
		<input bind:value={query} placeholder="Search project files" onkeydown={(event) => {
			if (event.key === 'Enter') void searchFiles();
		}} />
		<button type="button" class="icon-btn" onclick={searchFiles} disabled={searching} title="Search" aria-label="Search project files">
			<Search size={15} />
		</button>
	</div>

	{#if searchResults.length > 0}
		<div class="results">
			{#each searchResults as hit (hit.chunkId)}
				<button type="button" class="result" onclick={() => attachSearchHit(hit)}>
					<strong>{hit.fileName}</strong>
					<span>{hit.snippet.replace(/<\/?mark>/g, '')}</span>
				</button>
			{/each}
		</div>
	{/if}

	<details class="project-editor">
		<summary>Project prompt and memory</summary>
		{#if promptPresets.length > 0}
			<label>
				<span>Apply preset</span>
				<select onchange={(event) => {
					const value = (event.currentTarget as HTMLSelectElement).value;
					const preset = promptPresets.find((item) => item.id === value);
					if (preset) promptOverride = preset.body;
					(event.currentTarget as HTMLSelectElement).value = '';
				}}>
					<option value="">Choose a preset</option>
					{#each promptPresets as preset (preset.id)}
						<option value={preset.id}>{preset.name}</option>
					{/each}
				</select>
			</label>
		{/if}
		<label>
			<span>Prompt override</span>
			<textarea bind:value={promptOverride} placeholder="Project-specific instructions."></textarea>
		</label>
		<label class="check">
			<input type="checkbox" bind:checked={memoryEnabled} />
			<span>Use project memory</span>
		</label>
		<label>
			<span>Project remember</span>
			<textarea bind:value={remember} placeholder="Project facts or preferences."></textarea>
		</label>
		<label>
			<span>Project never suggest</span>
			<textarea bind:value={neverSuggest} placeholder="Project-specific avoidances."></textarea>
		</label>
		<button class="save-btn" type="button" onclick={saveProject} disabled={projectSaving}>
			<Save size={14} />
			<span>{projectSaving ? 'Saving...' : projectSaved ? 'Saved' : 'Save project'}</span>
		</button>

		<div class="memory-adder">
			<select bind:value={memoryKind} aria-label="Memory kind">
				<option value="remember">Remember</option>
				<option value="never_suggest">Never suggest</option>
			</select>
			<input bind:value={memoryDraft} placeholder="Add itemized project memory" />
			<button type="button" onclick={addMemoryEntry}>Add</button>
		</div>

		{#if memoryEntries.length > 0}
			<div class="memory-list">
				{#each memoryEntries as entry (entry.id)}
					<div class="memory-row" class:disabled={!entry.enabled}>
						<button type="button" onclick={() => toggleMemory(entry)}>
							{entry.enabled ? 'On' : 'Off'}
						</button>
						<span>{entry.kind === 'remember' ? 'Remember' : 'Never'}</span>
						<p>{entry.body}</p>
						<button type="button" onclick={() => archiveMemory(entry)}>Archive</button>
					</div>
				{/each}
			</div>
		{/if}
	</details>
</section>

<style>
.project-panel {
	display: flex;
	flex-direction: column;
	gap: var(--sp-3);
	width: min(var(--content-max-w), 100%);
	margin: 0 auto;
	padding: var(--sp-3) var(--sp-6) 0;
}

.panel-head,
.search-row,
.file-strip,
.memory-adder {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
}

.panel-head {
	justify-content: space-between;
}

.eyebrow {
	margin: 0 0 2px;
	color: var(--text-muted);
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-transform: uppercase;
}

h2 {
	margin: 0;
	font-size: 16px;
	font-weight: 650;
	color: var(--text-primary);
}

.icon-btn,
.remove-btn,
.save-btn,
.memory-adder button,
.memory-row button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: var(--sp-2);
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-secondary);
	font: inherit;
	font-size: 12px;
	cursor: pointer;
}

.icon-btn {
	width: 32px;
	height: 32px;
}

.file-strip {
	flex-wrap: wrap;
}

.file-chip {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	max-width: 220px;
	padding: 6px 9px;
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-sm);
	background: var(--bg-surface);
	color: var(--text-secondary);
	font: inherit;
	font-size: 12px;
	cursor: pointer;
}

.file-chip.selected {
	border-color: var(--accent);
	color: var(--text-primary);
	background: var(--accent-soft);
}

.file-chip span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.remove-btn {
	width: 24px;
	height: 24px;
	margin-left: -6px;
	padding: 0;
}

.search-row input,
.memory-adder input,
.memory-adder select {
	min-width: 0;
	flex: 1;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	color: var(--text-primary);
	font: inherit;
	font-size: 13px;
	padding: 7px 9px;
}

.results {
	display: grid;
	gap: 4px;
}

.result {
	display: grid;
	gap: 2px;
	width: 100%;
	padding: 7px 9px;
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--text-secondary);
	font: inherit;
	font-size: 12px;
	text-align: left;
	cursor: pointer;
}

.result strong {
	color: var(--text-primary);
	font-weight: 650;
}

.result span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.project-editor {
	border-top: 1px solid var(--border-subtle);
	padding-top: var(--sp-2);
}

.project-editor summary {
	color: var(--text-secondary);
	cursor: pointer;
	font-size: 12px;
	font-weight: 650;
}

.project-editor label {
	display: grid;
	gap: 5px;
	margin-top: var(--sp-3);
	color: var(--text-secondary);
	font-size: 12px;
	font-weight: 650;
}

.project-editor textarea {
	min-height: 78px;
	resize: vertical;
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	color: var(--text-primary);
	font: inherit;
	font-size: 13px;
	line-height: 1.45;
	padding: var(--sp-2);
}

.project-editor select {
	border: 1px solid var(--border-default);
	border-radius: var(--radius-sm);
	background: var(--bg-base);
	color: var(--text-primary);
	font: inherit;
	font-size: 13px;
	padding: var(--sp-2);
}

.project-editor .check {
	display: flex;
	align-items: center;
	gap: var(--sp-2);
}

.save-btn {
	margin-top: var(--sp-3);
	padding: 7px 10px;
}

.memory-adder {
	margin-top: var(--sp-3);
}

.memory-adder button,
.memory-row button {
	padding: 6px 8px;
}

.memory-list {
	display: grid;
	gap: 5px;
	margin-top: var(--sp-2);
}

.memory-row {
	display: grid;
	grid-template-columns: auto auto minmax(0, 1fr) auto;
	align-items: center;
	gap: var(--sp-2);
	color: var(--text-secondary);
	font-size: 12px;
}

.memory-row.disabled {
	opacity: 0.55;
}

.memory-row p {
	margin: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.muted,
.error {
	margin: 0;
	font-size: 12px;
}

.muted {
	color: var(--text-muted);
}

.error {
	color: var(--red);
}
</style>
