import { promises as fs, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { intakeScanSchema } from '$lib/shared/schemas';
import type { IntakeScan, IntakeScanFile, IntakeScanFileKind, Plan, Project, Task } from '$lib/shared/types';
import { getDb } from '$lib/server/db/client';
import { loadConfig } from '$lib/server/config';
import type * as schema from '$lib/server/db/schema';
import { intakeScans } from '$lib/server/db/schema';
import { PlanService, TaskService } from '$lib/server/features/plans/plan';
import { ProjectService } from '$lib/server/features/projects/project';

type Db = BetterSQLite3Database<typeof schema>;
type ScanRow = typeof intakeScans.$inferSelect;

const IMAGE_EXTS = new Set([
	'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff',
	'.heic', '.heif', '.avif',
]);
const DOC_EXTS = new Set([
	'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
	'.odt', '.ods', '.odp', '.pages', '.numbers', '.key', '.epub',
]);
const TEXT_EXTS = new Set([
	'.txt', '.md', '.markdown', '.rst', '.org', '.tex', '.rtf',
]);
const CODE_EXTS = new Set([
	'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.rb', '.go',
	'.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.swift',
	'.kt', '.kts', '.vue', '.svelte', '.html', '.htm', '.css', '.scss',
	'.less', '.json', '.yaml', '.yml', '.toml', '.xml', '.sh', '.bash',
	'.zsh', '.fish', '.sql', '.graphql', '.proto', '.lua', '.r', '.R',
	'.dart', '.ex', '.exs', '.clj', '.hs',
]);
const DATA_EXTS = new Set([
	'.csv', '.tsv', '.sqlite', '.db', '.parquet', '.avro', '.ndjson', '.jsonl',
]);
const MEDIA_EXTS = new Set([
	'.mp4', '.mov', '.avi', '.mkv', '.webm', '.mp3', '.wav', '.flac',
	'.aac', '.ogg', '.m4a', '.m4v', '.wmv', '.wma',
]);

const IGNORED_DIRS = new Set([
	'node_modules', '.git', '.svn', '.hg', 'vendor', 'dist', 'build',
	'.next', '.nuxt', '__pycache__', '.venv', 'venv', 'env',
	'.DS_Store',
]);

export function classifyExt(ext: string): IntakeScanFileKind {
	const lower = ext.toLowerCase();
	if (IMAGE_EXTS.has(lower)) return 'image';
	if (DOC_EXTS.has(lower)) return 'document';
	if (TEXT_EXTS.has(lower)) return 'text';
	if (CODE_EXTS.has(lower)) return 'code';
	if (DATA_EXTS.has(lower)) return 'data';
	if (MEDIA_EXTS.has(lower)) return 'media';
	return 'other';
}

async function* walkDir(
	dir: string,
): AsyncGenerator<{ path: string; size: number }> {
	let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[];
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (IGNORED_DIRS.has(entry.name)) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walkDir(full);
		} else if (entry.isFile()) {
			try {
				const st = statSync(full);
				yield { path: full, size: st.size };
			} catch {
				yield { path: full, size: 0 };
			}
		}
	}
}

function walkDirSync(dir: string, out: { path: string; size: number }[]): void {
	let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[];
	try {
		entries = readdirSync(dir, { withFileTypes: true }) as { name: string; isDirectory(): boolean; isFile(): boolean }[];
	} catch {
		return;
	}
	for (const entry of entries) {
		if (IGNORED_DIRS.has(entry.name)) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			walkDirSync(full, out);
		} else if (entry.isFile()) {
			try {
				const st = statSync(full);
				out.push({ path: full, size: st.size });
			} catch {
				out.push({ path: full, size: 0 });
			}
		}
	}
}

const SENSITIVE_PATTERNS = /receipt|tax|bank|passport|ssn|credit|invoice|medical|health|insurance|contract|salary|payroll|financial|confidential|private|secret/i;
const CATEGORY_MAP: Array<{ pattern: RegExp; category: string }> = [
	{ pattern: /course|assignment|lecture|homework|exam|quiz|study|lesson|syllabus|curriculum/i, category: 'educational' },
	{ pattern: /receipt|invoice|tax|financial|bank|salary|payroll/i, category: 'financial' },
	{ pattern: /medical|health|insurance|prescription/i, category: 'medical' },
	{ pattern: /contract|legal|agreement|policy/i, category: 'legal' },
];

function isSensitive(filePath: string): boolean {
	return SENSITIVE_PATTERNS.test(filePath);
}

function classifyCategory(filePath: string): string {
	for (const { pattern, category } of CATEGORY_MAP) {
		if (pattern.test(filePath)) return category;
	}
	return 'other';
}

async function runScanBackground(id: string, folderPath: string): Promise<void> {
	const db = getDb();

	function isCancelled(): boolean {
		const row = db.select({ status: intakeScans.status })
			.from(intakeScans)
			.where(eq(intakeScans.id, id))
			.get();
		return row?.status === 'cancelled';
	}

	function patch(values: Partial<ScanRow>): void {
		db.update(intakeScans)
			.set({ ...values, updatedAt: Date.now() })
			.where(eq(intakeScans.id, id))
			.run();
	}

	try {
		// ── Phase 1: enumerating ──────────────────────────────────
		patch({ status: 'running', phase: 'enumerating' });

		const allPaths: { path: string; size: number }[] = [];
		let batchCount = 0;

		for await (const file of walkDir(folderPath)) {
			if (isCancelled()) return;

			allPaths.push(file);
			batchCount++;

			// Flush progress every 50 files
			if (batchCount % 50 === 0) {
				patch({ filesFound: allPaths.length });
				// Yield to event loop so the server can handle other requests
				await new Promise<void>((r) => setImmediate(r));
			}
		}

		patch({ filesFound: allPaths.length, phase: 'classifying' });

		if (isCancelled()) return;

		// ── Phase 2: classifying ──────────────────────────────────
		const result: IntakeScanFile[] = [];

		for (let i = 0; i < allPaths.length; i++) {
			if (i % 20 === 0) {
				if (isCancelled()) return;
				await new Promise<void>((r) => setImmediate(r));
			}

			const { path, size } = allPaths[i];
			const ext = extname(path).toLowerCase();
			const name = path.toLowerCase();
			result.push({
				id:                  randomUUID(),
				path:                relative(folderPath, path),
				size,
				kind:                classifyExt(ext),
				ext,
				sensitive:           isSensitive(name),
				category:            classifyCategory(name),
				reviewState:         'pending',
				proposedPlanName:    null,
				proposedProjectName: null,
			});

			if ((i + 1) % 50 === 0) {
				patch({ filesClassified: i + 1 });
			}
		}

		// ── Phase 3: completed ────────────────────────────────────
		const now = Date.now();
		db.update(intakeScans)
			.set({
				status:          'completed',
				phase:           'completed',
				filesFound:      allPaths.length,
				filesClassified: result.length,
				resultJson:      JSON.stringify(result),
				completedAt:     now,
				updatedAt:       now,
			})
			.where(eq(intakeScans.id, id))
			.run();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		patch({ status: 'failed', errorMessage: message });
	}
}

function toScan(row: ScanRow): IntakeScan {
	return intakeScanSchema.parse({
		id:              row.id,
		folderPath:      row.folderPath,
		status:          row.status,
		phase:           row.phase,
		filesFound:      row.filesFound,
		filesClassified: row.filesClassified,
		errorMessage:    row.errorMessage,
		result:          row.resultJson ? (JSON.parse(row.resultJson) as IntakeScanFile[]) : null,
		progress:        { phase: row.phase, scanned: row.filesClassified },
		createdAt:       row.createdAt,
		updatedAt:       row.updatedAt,
		cancelledAt:     row.cancelledAt,
		completedAt:     row.completedAt,
	});
}

export class IntakeScanService {
	constructor(private readonly db: Db = getDb()) {}

	list(opts: { includeCompleted?: boolean; limit?: number } = {}): IntakeScan[] {
		const limit = Math.min(Math.max(1, opts.limit ?? 50), 100);
		const query = this.db
			.select()
			.from(intakeScans)
			.orderBy(desc(intakeScans.createdAt))
			.limit(limit);

		const rows = opts.includeCompleted
			? query.all()
			: query
				.where(inArray(intakeScans.status, ['queued', 'running', 'completed', 'cancelled', 'failed']))
				.all();

		return rows.map(toScan);
	}

	listActive(): IntakeScan[] {
		const rows = this.db
			.select()
			.from(intakeScans)
			.where(inArray(intakeScans.status, ['queued', 'running']))
			.orderBy(desc(intakeScans.createdAt))
			.all();
		return rows.map(toScan);
	}

	get(id: string): IntakeScan | null {
		const row = this.db
			.select()
			.from(intakeScans)
			.where(eq(intakeScans.id, id))
			.get();
		return row ? toScan(row) : null;
	}

	create(folderPath: string): IntakeScan {
		const now = Date.now();
		const id = randomUUID();

		this.db.insert(intakeScans).values({
			id,
			folderPath,
			status:          'queued',
			phase:           'queued',
			filesFound:      0,
			filesClassified: 0,
			createdAt:       now,
			updatedAt:       now,
		}).run();

		const scan = this.get(id);
		if (!scan) throw new Error('Failed to create intake scan');

		// Fire-and-forget — runner updates the DB directly
		setImmediate(() => void runScanBackground(id, folderPath));

		return scan;
	}

	cancel(id: string): IntakeScan | null {
		const existing = this.get(id);
		if (!existing) return null;
		if (existing.status === 'completed' || existing.status === 'failed') {
			return existing;
		}

		const now = Date.now();
		this.db.update(intakeScans)
			.set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
			.where(
				and(
					eq(intakeScans.id, id),
					inArray(intakeScans.status, ['queued', 'running']),
				),
			)
			.run();

		return this.get(id);
	}

	remove(id: string): boolean {
		const result = this.db.delete(intakeScans)
			.where(eq(intakeScans.id, id))
			.run();
		return result.changes > 0;
	}
}

// ── IntakeService (extends IntakeScanService with file review + organize) ────

export type OrganizeResult = {
	fileCount: number;
	createdPlans: Plan[];
	createdProjects: Project[];
	createdTasks: Task[];
	checkpointPath: string;
};

export class IntakeService {
	private readonly db: Db;
	private readonly scans: IntakeScanService;

	constructor(db: Db = getDb()) {
		this.db = db;
		this.scans = new IntakeScanService(db);
	}

	get(id: string): IntakeScan | null {
		return this.scans.get(id);
	}

	getScan(id: string): IntakeScan | null {
		return this.scans.get(id);
	}

	/** Starts an async (fire-and-forget) intake scan and returns immediately. */
	startScan(folderPath: string): IntakeScan {
		return this.scans.create(folderPath);
	}

	/** Runs a synchronous scan and waits for completion before returning. */
	scanFolder(folderPath: string): IntakeScan {
		const id = randomUUID();
		const now = Date.now();
		const db = this.db;

		db.insert(intakeScans).values({
			id, folderPath,
			status:          'running',
			phase:           'enumerating',
			filesFound:      0,
			filesClassified: 0,
			createdAt:       now,
			updatedAt:       now,
		}).run();

		const allPaths: { path: string; size: number }[] = [];
		walkDirSync(folderPath, allPaths);

		const result: IntakeScanFile[] = allPaths.map(({ path, size }) => {
			const ext = extname(path).toLowerCase();
			const name = path.toLowerCase();
			return {
				id:                  randomUUID(),
				path:                relative(folderPath, path),
				size,
				kind:                classifyExt(ext),
				ext,
				sensitive:           isSensitive(name),
				category:            classifyCategory(name),
				reviewState:         'pending' as const,
				proposedPlanName:    null,
				proposedProjectName: null,
			};
		});

		const done = Date.now();
		db.update(intakeScans).set({
			status:          'completed',
			phase:           'completed',
			filesFound:      allPaths.length,
			filesClassified: result.length,
			resultJson:      JSON.stringify(result),
			completedAt:     done,
			updatedAt:       done,
		}).where(eq(intakeScans.id, id)).run();

		const scan = this.scans.get(id);
		if (!scan) throw new Error('Failed to create intake scan');
		return scan;
	}

	/** Returns all classified files for a completed scan. */
	listFiles(scanId: string): IntakeScanFile[] {
		const scan = this.scans.get(scanId);
		return scan?.result ?? [];
	}

	updateFileReview(input: {
		scanId: string;
		fileId: string;
		reviewState?: 'pending' | 'included' | 'excluded';
		localOnly?: boolean;
		category?: string;
		proposedPlanName?: string | null;
		proposedProjectName?: string | null;
	}): IntakeScanFile | null {
		const scan = this.scans.get(input.scanId);
		if (!scan?.result) return null;

		const idx = scan.result.findIndex(
			(f) => f.id === input.fileId || f.path === input.fileId,
		);
		if (idx === -1) return null;

		const updated = { ...scan.result[idx] };
		if (input.reviewState !== undefined) updated.reviewState = input.reviewState;
		if (input.category !== undefined) updated.category = input.category;
		if ('proposedPlanName' in input) updated.proposedPlanName = input.proposedPlanName ?? null;
		if ('proposedProjectName' in input) updated.proposedProjectName = input.proposedProjectName ?? null;

		const newResult = [...scan.result];
		newResult[idx] = updated;

		this.db.update(intakeScans)
			.set({ resultJson: JSON.stringify(newResult), updatedAt: Date.now() })
			.where(eq(intakeScans.id, input.scanId))
			.run();

		return updated;
	}

	organizeScan(input: {
		scanId: string;
		mode: 'copy' | 'move';
		checkpointDescription?: string;
	}): OrganizeResult | null {
		const scan = this.scans.get(input.scanId);
		if (!scan) return null;

		const includedFiles = (scan.result ?? []).filter(
			(f) => f.reviewState === 'included',
		);

		const planSvc     = new PlanService(this.db);
		const projectSvc  = new ProjectService(this.db);
		const taskSvc     = new TaskService(this.db);

		const createdPlans: Plan[]    = [];
		const createdProjects: Project[] = [];
		const createdTasks: Task[]    = [];

		// Group by plan name → project name
		const planMap = new Map<string, Plan>();
		const projectMap = new Map<string, Project>();

		for (const file of includedFiles) {
			const planName    = file.proposedPlanName    ?? 'Inbox';
			const projectName = file.proposedProjectName ?? 'Uncategorised';

			let plan = planMap.get(planName);
			if (!plan) {
				plan = planSvc.create({ name: planName, status: 'active' });
				planMap.set(planName, plan);
				createdPlans.push(plan);
			}

			const projKey = `${planName}::${projectName}`;
			let project = projectMap.get(projKey);
			if (!project) {
				project = projectSvc.create({ name: projectName, planId: plan.id, status: 'planned' });
				projectMap.set(projKey, project);
				createdProjects.push(project);
			}

			const task = taskSvc.create({
				planId:    plan.id,
				projectId: project.id,
				title:     file.path,
				status:    'proposed',
			});
			createdTasks.push(task);
		}

		// Write a lightweight checkpoint JSON to the workspace .bryon dir
		const { config } = loadConfig();
		const checkpointDir = join(config.app.workspace_dir, '.bryon', 'checkpoints');
		mkdirSync(checkpointDir, { recursive: true });
		const checkpointPath = join(checkpointDir, `intake-${scan.id}.json`);
		writeFileSync(checkpointPath, JSON.stringify({
			scanId:   scan.id,
			plans:    createdPlans.map((p) => p.id),
			projects: createdProjects.map((p) => p.id),
			tasks:    createdTasks.map((t) => t.id),
		}, null, 2), 'utf8');

		return {
			fileCount: includedFiles.length,
			createdPlans,
			createdProjects,
			createdTasks,
			checkpointPath,
		};
	}
}
