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

describe('MemoryEntryService', () => {
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
