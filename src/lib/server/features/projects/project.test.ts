import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initializeDb } from '$lib/server/db/client';
import { ChatService } from '$lib/server/features/chat/chat';
import { PersonaService } from '$lib/server/features/personas/persona';
import {
	MemoryEntryService,
	ProjectService,
	PromptPresetService,
} from '$lib/server/features/projects/project';

let tempDir = '';

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'bryon-projects-'));
	const db = initializeDb(join(tempDir, 'bryon.db'));
	migrate(db, { migrationsFolder: join(process.cwd(), 'src/lib/server/db/migrations') });
	new PersonaService(getDb()).create({
		id: 'persona_default',
		name: 'Bryon',
		systemPrompt: 'You are Bryon.',
	});
});

afterEach(() => {
	closeDb();
	rmSync(tempDir, { recursive: true, force: true });
});

describe('ProjectService', () => {
	it('keeps legacy chats global and moves chats into projects', () => {
		const projects = new ProjectService(getDb());
		const chats = new ChatService(getDb());

		const globalChat = chats.create({ title: 'Global' });
		const project = projects.create({ name: 'Client work' });
		const projectChat = chats.create({ title: 'Scoped', projectId: project.id });

		expect(globalChat.projectId).toBeNull();
		expect(projectChat.projectId).toBe(project.id);
		expect(chats.list({ projectId: null }).map((chat) => chat.id)).toEqual([globalChat.id]);
		expect(chats.list({ projectId: project.id }).map((chat) => chat.id)).toEqual([projectChat.id]);

		const moved = chats.update(globalChat.id, { projectId: project.id });
		expect(moved?.projectId).toBe(project.id);
		expect(chats.list({ projectId: project.id }).map((chat) => chat.id)).toContain(globalChat.id);
	});

	it('indexes project files and searches extracted text explicitly', () => {
		const service = new ProjectService(getDb());
		const project = service.create({ name: 'Research' });
		const sourcePath = join(tempDir, 'notes.md');
		const textPath = `${sourcePath}.txt`;
		writeFileSync(sourcePath, '# Notes\n');
		writeFileSync(textPath, 'Alpha budget notes for the project.', 'utf8');

		const file = service.addFile(project.id, {
			id: 'file-1',
			path: sourcePath,
			name: 'notes.md',
			kind: 'document',
			mime: 'text/markdown',
			sizeBytes: 8,
			textPath,
			textBytes: 35,
		});

		const results = service.searchFiles(project.id, 'Alpha');
		expect(file.projectId).toBe(project.id);
		expect(results).toHaveLength(1);
		expect(results[0].projectFileId).toBe(file.id);
	});
});

describe('PromptPresetService', () => {
	it('creates, retrieves, updates, and deletes a preset', () => {
		const service = new PromptPresetService(getDb());

		const preset = service.create({ name: 'Concise', body: 'Be brief.' });
		expect(preset.name).toBe('Concise');
		expect(preset.body).toBe('Be brief.');

		const fetched = service.get(preset.id);
		expect(fetched?.id).toBe(preset.id);

		const updated = service.update(preset.id, { name: 'Brief', body: 'Reply in one line.' });
		expect(updated?.name).toBe('Brief');
		expect(updated?.body).toBe('Reply in one line.');

		expect(service.delete(preset.id)).toBe(true);
		expect(service.get(preset.id)).toBeNull();
		expect(service.delete(preset.id)).toBe(false);
	});

	it('lists presets in descending updatedAt order', () => {
		const service = new PromptPresetService(getDb());

		const a = service.create({ name: 'Alpha', body: 'A.' });
		const b = service.create({ name: 'Beta', body: 'B.' });
		service.update(a.id, { name: 'Alpha v2' });

		const list = service.list();
		const ids = list.map((p) => p.id);
		expect(ids.indexOf(a.id)).toBeLessThan(ids.indexOf(b.id));
	});

	it('returns null for update/get on unknown id', () => {
		const service = new PromptPresetService(getDb());
		expect(service.get('no-such-id')).toBeNull();
		expect(service.update('no-such-id', { name: 'Ghost' })).toBeNull();
	});
});

describe('MemoryEntryService', () => {
	it('creates entries with explicit scope and kind', () => {
		const service = new MemoryEntryService(getDb());

		const global = service.create({ scope: 'global', kind: 'remember', body: 'Always be helpful.' });
		expect(global.scope).toBe('global');
		expect(global.kind).toBe('remember');
		expect(global.enabled).toBe(true);
		expect(global.projectId).toBeNull();

		const projectService = new ProjectService(getDb());
		const project = projectService.create({ name: 'Test project' });
		const proj = service.create({
			scope: 'project',
			projectId: project.id,
			kind: 'never_suggest',
			body: 'No pricing info.',
		});
		expect(proj.scope).toBe('project');
		expect(proj.projectId).toBe(project.id);
	});

	it('lists entries filtered by scope and projectId', () => {
		const service = new MemoryEntryService(getDb());
		const projectService = new ProjectService(getDb());
		const project = projectService.create({ name: 'Scoped proj' });

		service.create({ scope: 'global', kind: 'remember', body: 'Global fact.' });
		service.create({ scope: 'project', projectId: project.id, kind: 'remember', body: 'Proj fact.' });

		const globals = service.list({ scope: 'global', projectId: null });
		const projEntries = service.list({ scope: 'project', projectId: project.id });

		expect(globals.every((e) => e.scope === 'global')).toBe(true);
		expect(globals.some((e) => e.body === 'Global fact.')).toBe(true);
		expect(projEntries.every((e) => e.scope === 'project')).toBe(true);
		expect(projEntries.some((e) => e.body === 'Proj fact.')).toBe(true);
	});

	it('archives entries and excludes them from default list', () => {
		const service = new MemoryEntryService(getDb());
		const entry = service.create({ scope: 'global', kind: 'remember', body: 'Temp fact.' });

		service.archive(entry.id);

		const active = service.list({ includeArchived: false });
		const all = service.list({ includeArchived: true });
		expect(active.map((e) => e.id)).not.toContain(entry.id);
		expect(all.map((e) => e.id)).toContain(entry.id);
	});

	it('toggles enabled state', () => {
		const service = new MemoryEntryService(getDb());
		const entry = service.create({ scope: 'global', kind: 'remember', body: 'Toggle me.' });

		const disabled = service.update(entry.id, { enabled: false });
		expect(disabled?.enabled).toBe(false);

		const re = service.update(entry.id, { enabled: true });
		expect(re?.enabled).toBe(true);
	});

	it('updates body and kind', () => {
		const service = new MemoryEntryService(getDb());
		const entry = service.create({ scope: 'global', kind: 'remember', body: 'Old body.' });

		const updated = service.update(entry.id, { body: 'New body.', kind: 'never_suggest' });
		expect(updated?.body).toBe('New body.');
		expect(updated?.kind).toBe('never_suggest');
	});

	it('returns null for update on unknown id', () => {
		const service = new MemoryEntryService(getDb());
		expect(service.update('no-such-id', { body: 'Ghost' })).toBeNull();
	});

	it('imports legacy TOML memory and appends project memory in prompt order', () => {
		const projectService = new ProjectService(getDb());
		const memory = new MemoryEntryService(getDb());
		const project = projectService.create({
			name: 'Launch',
			promptOverride: null,
		});
		projectService.update(project.id, {
			remember: 'Project fact',
			neverSuggest: 'Project avoidance',
		});
		memory.create({
			scope: 'project',
			projectId: project.id,
			kind: 'remember',
			body: 'Project item',
		});

		const merged = memory.promptMemory(
			{
				enabled: true,
				remember: 'Global fact',
				never_suggest: 'Global avoidance',
			},
			projectService.get(project.id),
		);

		expect(memory.list({ scope: 'global', projectId: null })).toHaveLength(2);
		expect(merged.remember).toContain('Global fact');
		expect(merged.remember).toContain('Project item');
		expect(merged.remember).toContain('Project fact');
		expect(merged.never_suggest).toContain('Global avoidance');
		expect(merged.never_suggest).toContain('Project avoidance');
	});
});
