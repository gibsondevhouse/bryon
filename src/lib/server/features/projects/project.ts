import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
	memoryEntrySchema,
	projectFileSchema,
	projectSchema,
	promptPresetSchema,
} from '$lib/shared/schemas';
import type {
	Attachment,
	MemoryEntry,
	MemorySettings,
	Project,
	ProjectFile,
	PromptPreset,
} from '$lib/shared/types';
import { getDb, getSqlite } from '$lib/server/db/client';
import type * as schema from '$lib/server/db/schema';
import { memoryEntries, projectFiles, projects, promptPresets } from '$lib/server/db/schema';
import { countTokens } from '$lib/server/llm/tokens';

type Db = BetterSQLite3Database<typeof schema>;
type ProjectRow = typeof projects.$inferSelect;
type ProjectFileRow = typeof projectFiles.$inferSelect;
type PromptPresetRow = typeof promptPresets.$inferSelect;
type MemoryEntryRow = typeof memoryEntries.$inferSelect;

export type ListProjectsInput = {
	includeArchived?: boolean;
	limit?: number;
	offset?: number;
};

export type CreateProjectInput = {
	id?: string;
	name: string;
	description?: string | null;
	promptOverride?: string | null;
};

export type UpdateProjectInput = Partial<
	Pick<CreateProjectInput, 'name' | 'description' | 'promptOverride'>
> & {
	memoryEnabled?: boolean;
	remember?: string;
	neverSuggest?: string;
	status?: 'ideation' | 'definition' | 'execution' | 'maintenance';
	archived?: boolean;
};

export type SearchProjectFileHit = {
	chunkId: string;
	projectFileId: string;
	projectId: string;
	fileName: string;
	text: string;
	snippet: string;
};

export class ProjectService {
	constructor(private readonly db: Db = getDb()) {}

	list(input: ListProjectsInput = {}): Project[] {
		const limit = normalizeLimit(input.limit, 50, 200);
		const offset = Math.max(0, input.offset ?? 0);
		const query = this.db
			.select()
			.from(projects)
			.orderBy(desc(projects.updatedAt), desc(projects.createdAt))
			.limit(limit)
			.offset(offset);
		const rows = input.includeArchived
			? query.all()
			: query.where(isNull(projects.archivedAt)).all();
		return rows.map(toProject);
	}

	get(id: string): Project | null {
		const row = this.db.select().from(projects).where(eq(projects.id, id)).get();
		return row ? toProject(row) : null;
	}

	create(input: CreateProjectInput): Project {
		const now = Date.now();
		const id = input.id ?? randomUUID();
		this.db.insert(projects).values({
			id,
			name: input.name,
			description: input.description ?? null,
			promptOverride: input.promptOverride ?? null,
			memoryEnabled: 1,
			remember: '',
			neverSuggest: '',
			status: 'ideation',
			archivedAt: null,
			createdAt: now,
			updatedAt: now,
		}).run();

		const created = this.get(id);
		if (!created) throw new Error(`Project "${id}" was not created.`);
		return created;
	}

	update(id: string, input: UpdateProjectInput): Project | null {
		const values: Partial<typeof projects.$inferInsert> = {
			updatedAt: Date.now(),
		};
		let hasChanges = false;
		if (input.name !== undefined) {
			values.name = input.name;
			hasChanges = true;
		}
		if (input.description !== undefined) {
			values.description = input.description;
			hasChanges = true;
		}
		if (input.promptOverride !== undefined) {
			values.promptOverride = input.promptOverride;
			hasChanges = true;
		}
		if (input.memoryEnabled !== undefined) {
			values.memoryEnabled = input.memoryEnabled ? 1 : 0;
			hasChanges = true;
		}
		if (input.remember !== undefined) {
			values.remember = input.remember;
			hasChanges = true;
		}
		if (input.neverSuggest !== undefined) {
			values.neverSuggest = input.neverSuggest;
			hasChanges = true;
		}
		if (input.status !== undefined) {
			values.status = input.status;
			hasChanges = true;
		}
		if (input.archived !== undefined) {
			values.archivedAt = input.archived ? Date.now() : null;
			hasChanges = true;
		}
		if (!hasChanges) return this.get(id);

		const result = this.db
			.update(projects)
			.set(values)
			.where(eq(projects.id, id))
			.run();
		if (result.changes === 0) return null;
		return this.get(id);
	}

	archive(id: string): Project | null {
		return this.update(id, { archived: true });
	}

	listFiles(projectId: string, includeArchived = false): ProjectFile[] {
		const query = this.db
			.select()
			.from(projectFiles)
			.where(
				includeArchived
					? eq(projectFiles.projectId, projectId)
					: and(eq(projectFiles.projectId, projectId), isNull(projectFiles.archivedAt)),
			)
			.orderBy(desc(projectFiles.createdAt));
		return query.all().map(toProjectFile);
	}

	getFile(id: string): ProjectFile | null {
		const row = this.db
			.select()
			.from(projectFiles)
			.where(eq(projectFiles.id, id))
			.get();
		return row ? toProjectFile(row) : null;
	}

	getFilesByIds(ids: string[], projectId?: string | null): ProjectFile[] {
		if (ids.length === 0) return [];
		const filters = [inArray(projectFiles.id, ids), isNull(projectFiles.archivedAt)];
		if (projectId) filters.push(eq(projectFiles.projectId, projectId));
		return this.db
			.select()
			.from(projectFiles)
			.where(and(...filters))
			.all()
			.map(toProjectFile);
	}

	addFile(projectId: string, attachment: Attachment): ProjectFile {
		const now = Date.now();
		this.db.insert(projectFiles).values({
			id: attachment.id,
			projectId,
			name: attachment.name,
			mime: attachment.mime,
			kind: attachment.kind,
			path: attachment.path,
			textPath: attachment.textPath ?? null,
			sizeBytes: attachment.sizeBytes,
			textBytes: attachment.textBytes ?? null,
			archivedAt: null,
			createdAt: now,
		}).run();

		const file = this.getFile(attachment.id);
		if (!file) throw new Error(`Project file "${attachment.id}" was not created.`);
		if (file.textPath) this.reindexFile(file);
		return file;
	}

	archiveFile(projectId: string, fileId: string): ProjectFile | null {
		const result = this.db
			.update(projectFiles)
			.set({ archivedAt: Date.now() })
			.where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, projectId)))
			.run();
		if (result.changes === 0) return null;
		return this.getFile(fileId);
	}

	reindexFile(file: ProjectFile): void {
		const sqlite = getSqlite();
		sqlite.prepare('DELETE FROM project_file_chunks WHERE project_file_id = ?').run(file.id);
		if (!file.textPath) return;

		let text = '';
		try {
			text = readFileSync(file.textPath, 'utf8').trim();
		} catch {
			return;
		}
		if (!text) return;

		const chunks = chunkText(text);
		const insert = sqlite.prepare(
			`INSERT INTO project_file_chunks
				(id, project_file_id, project_id, ordinal, token_count, text)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		);
		const tx = sqlite.transaction(() => {
			for (const [index, chunk] of chunks.entries()) {
				insert.run(
					randomUUID(),
					file.id,
					file.projectId,
					index,
					countTokens(chunk),
					chunk,
				);
			}
		});
		tx();
	}

	searchFiles(projectId: string, query: string, limit = 10): SearchProjectFileHit[] {
		const rows = getSqlite()
			.prepare(
				`
				SELECT
					c.id AS chunkId,
					c.project_file_id AS projectFileId,
					c.project_id AS projectId,
					f.name AS fileName,
					c.text,
					snippet(project_file_chunks_fts, 2, '<mark>', '</mark>', '...', 18) AS snippet
				FROM project_file_chunks_fts
				JOIN project_file_chunks c ON c.id = project_file_chunks_fts.chunk_id
				JOIN project_files f ON f.id = c.project_file_id
				WHERE project_file_chunks_fts MATCH ?
					AND c.project_id = ?
					AND f.archived_at IS NULL
				ORDER BY rank
				LIMIT ?
				`,
			)
			.all(toFtsQuery(query), projectId, normalizeLimit(limit, 10, 50)) as SearchProjectFileHit[];
		return rows;
	}
}

export class PromptPresetService {
	constructor(private readonly db: Db = getDb()) {}

	list(): PromptPreset[] {
		return this.db
			.select()
			.from(promptPresets)
			.orderBy(desc(promptPresets.updatedAt), desc(promptPresets.createdAt))
			.all()
			.map(toPromptPreset);
	}

	get(id: string): PromptPreset | null {
		const row = this.db
			.select()
			.from(promptPresets)
			.where(eq(promptPresets.id, id))
			.get();
		return row ? toPromptPreset(row) : null;
	}

	create(input: { name: string; body: string }): PromptPreset {
		const now = Date.now();
		const id = randomUUID();
		this.db.insert(promptPresets).values({
			id,
			name: input.name,
			body: input.body,
			createdAt: now,
			updatedAt: now,
		}).run();
		const created = this.get(id);
		if (!created) throw new Error(`Prompt preset "${id}" was not created.`);
		return created;
	}

	update(id: string, input: Partial<{ name: string; body: string }>): PromptPreset | null {
		const values: Partial<typeof promptPresets.$inferInsert> = {
			updatedAt: Date.now(),
		};
		let hasChanges = false;
		if (input.name !== undefined) {
			values.name = input.name;
			hasChanges = true;
		}
		if (input.body !== undefined) {
			values.body = input.body;
			hasChanges = true;
		}
		if (!hasChanges) return this.get(id);
		const result = this.db
			.update(promptPresets)
			.set(values)
			.where(eq(promptPresets.id, id))
			.run();
		if (result.changes === 0) return null;
		return this.get(id);
	}

	delete(id: string): boolean {
		return this.db.delete(promptPresets).where(eq(promptPresets.id, id)).run().changes > 0;
	}
}

export class MemoryEntryService {
	constructor(private readonly db: Db = getDb()) {}

	list(input: {
		scope?: 'global' | 'project';
		projectId?: string | null;
		includeArchived?: boolean;
	} = {}): MemoryEntry[] {
		const filters = [];
		if (input.scope) filters.push(eq(memoryEntries.scope, input.scope));
		if (input.projectId !== undefined) {
			filters.push(
				input.projectId === null
					? isNull(memoryEntries.projectId)
					: eq(memoryEntries.projectId, input.projectId),
			);
		}
		if (!input.includeArchived) filters.push(isNull(memoryEntries.archivedAt));
		const query = this.db
			.select()
			.from(memoryEntries)
			.orderBy(desc(memoryEntries.updatedAt), desc(memoryEntries.createdAt));
		const rows = filters.length ? query.where(and(...filters)).all() : query.all();
		return rows.map(toMemoryEntry);
	}

	create(input: {
		scope: 'global' | 'project';
		projectId?: string | null;
		kind: 'remember' | 'never_suggest';
		body: string;
		enabled?: boolean;
		origin?: 'user' | 'imported' | 'model_suggested';
	}): MemoryEntry {
		const now = Date.now();
		const id = randomUUID();
		this.db.insert(memoryEntries).values({
			id,
			scope: input.scope,
			projectId: input.scope === 'project' ? (input.projectId ?? null) : null,
			kind: input.kind,
			body: input.body,
			enabled: (input.enabled ?? true) ? 1 : 0,
			origin: input.origin ?? 'user',
			archivedAt: null,
			createdAt: now,
			updatedAt: now,
		}).run();
		const created = this.get(id);
		if (!created) throw new Error(`Memory entry "${id}" was not created.`);
		return created;
	}

	get(id: string): MemoryEntry | null {
		const row = this.db
			.select()
			.from(memoryEntries)
			.where(eq(memoryEntries.id, id))
			.get();
		return row ? toMemoryEntry(row) : null;
	}

	update(
		id: string,
		input: Partial<Pick<MemoryEntry, 'body' | 'kind' | 'enabled' | 'archivedAt'>>,
	): MemoryEntry | null {
		const values: Partial<typeof memoryEntries.$inferInsert> = {
			updatedAt: Date.now(),
		};
		let hasChanges = false;
		if (input.body !== undefined) {
			values.body = input.body;
			hasChanges = true;
		}
		if (input.kind !== undefined) {
			values.kind = input.kind;
			hasChanges = true;
		}
		if (input.enabled !== undefined) {
			values.enabled = input.enabled ? 1 : 0;
			hasChanges = true;
		}
		if (input.archivedAt !== undefined) {
			values.archivedAt = input.archivedAt;
			hasChanges = true;
		}
		if (!hasChanges) return this.get(id);
		const result = this.db
			.update(memoryEntries)
			.set(values)
			.where(eq(memoryEntries.id, id))
			.run();
		if (result.changes === 0) return null;
		return this.get(id);
	}

	archive(id: string): MemoryEntry | null {
		return this.update(id, { archivedAt: Date.now() });
	}

	promptMemory(
		configMemory: MemorySettings,
		project?: Pick<Project, 'id' | 'memoryEnabled' | 'remember' | 'neverSuggest'> | null,
	): MemorySettings {
		this.ensureConfigMemoryImported(configMemory);
		const projectId = project?.id ?? null;
		const globalEntries = this.list({ scope: 'global', projectId: null });
		const projectEntries = projectId
			? this.list({ scope: 'project', projectId })
			: [];
		const remember: string[] = [];
		const neverSuggest: string[] = [];

		if (globalEntries.length === 0) {
			if (configMemory.remember.trim()) remember.push(configMemory.remember.trim());
			if (configMemory.never_suggest.trim()) neverSuggest.push(configMemory.never_suggest.trim());
		} else {
			for (const entry of globalEntries.filter((item) => item.enabled)) {
				(entry.kind === 'remember' ? remember : neverSuggest).push(entry.body.trim());
			}
		}
		for (const entry of projectEntries.filter((item) => item.enabled)) {
			(entry.kind === 'remember' ? remember : neverSuggest).push(entry.body.trim());
		}
		if (project?.memoryEnabled) {
			if (project.remember.trim()) remember.push(project.remember.trim());
			if (project.neverSuggest.trim()) neverSuggest.push(project.neverSuggest.trim());
		}

		return {
			enabled: configMemory.enabled,
			remember: remember.filter(Boolean).join('\n\n'),
			never_suggest: neverSuggest.filter(Boolean).join('\n\n'),
		};
	}

	private ensureConfigMemoryImported(configMemory: MemorySettings): void {
		if (!configMemory.remember.trim() && !configMemory.never_suggest.trim()) return;
		const existing = this.db
			.select({ kind: memoryEntries.kind })
			.from(memoryEntries)
			.where(
				and(
					eq(memoryEntries.scope, 'global'),
					isNull(memoryEntries.projectId),
					or(
						eq(memoryEntries.kind, 'remember'),
						eq(memoryEntries.kind, 'never_suggest'),
					),
				),
			)
			.all();
		const existingKinds = new Set(existing.map((entry) => entry.kind));
		if (configMemory.remember.trim() && !existingKinds.has('remember')) {
			this.create({
				scope: 'global',
				kind: 'remember',
				body: configMemory.remember.trim(),
				origin: 'imported',
			});
		}
		if (configMemory.never_suggest.trim() && !existingKinds.has('never_suggest')) {
			this.create({
				scope: 'global',
				kind: 'never_suggest',
				body: configMemory.never_suggest.trim(),
				origin: 'imported',
			});
		}
	}
}

export function projectFileToAttachment(file: ProjectFile): Attachment {
	return {
		id: file.id,
		path: file.path,
		name: file.name,
		kind: file.kind,
		mime: file.mime,
		sizeBytes: file.sizeBytes,
		textPath: file.textPath,
		textBytes: file.textBytes,
	};
}

function toProject(row: ProjectRow): Project {
	return projectSchema.parse({
		...row,
		memoryEnabled: row.memoryEnabled === 1,
	});
}

function toProjectFile(row: ProjectFileRow): ProjectFile {
	return projectFileSchema.parse(row);
}

function toPromptPreset(row: PromptPresetRow): PromptPreset {
	return promptPresetSchema.parse(row);
}

function toMemoryEntry(row: MemoryEntryRow): MemoryEntry {
	return memoryEntrySchema.parse({
		...row,
		enabled: row.enabled === 1,
	});
}

function chunkText(text: string): string[] {
	const maxChars = 4000;
	const chunks: string[] = [];
	for (let start = 0; start < text.length; start += maxChars) {
		const chunk = text.slice(start, start + maxChars).trim();
		if (chunk) chunks.push(chunk);
	}
	return chunks;
}

function toFtsQuery(value: string): string {
	return `"${value.trim().replaceAll('"', '""')}"`;
}

function normalizeLimit(
	value: number | undefined,
	defaultValue: number,
	maxValue: number,
): number {
	if (value === undefined) return defaultValue;
	return Math.min(Math.max(1, value), maxValue);
}
