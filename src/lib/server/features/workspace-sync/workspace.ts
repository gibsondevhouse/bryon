import { randomUUID } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { desc, eq, isNull } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { loadConfig } from '$lib/server/config';
import { getDb } from '$lib/server/db/client';
import {
	routingLogs,
	syncAuditFindings,
	workspaceCheckpoints,
} from '$lib/server/db/schema';
import { PlanCardService, PlanService, TaskService } from '$lib/server/features/plans/plan';
import { ProjectService } from '$lib/server/features/projects/project';
import type * as schema from '$lib/server/db/schema';

type Db = BetterSQLite3Database<typeof schema>;
type CheckpointRow = typeof workspaceCheckpoints.$inferSelect;
type AuditFindingRow = typeof syncAuditFindings.$inferSelect;
type RoutingLogRow = typeof routingLogs.$inferSelect;

export type WorkspaceCheckpoint = {
	id: string;
	description: string;
	path: string;
	snapshot: unknown;
	createdAt: number;
};

export type SyncAuditFinding = {
	id: string;
	checkpointId: string | null;
	severity: 'info' | 'warning' | 'error';
	code: string;
	message: string;
	path: string | null;
	resolvedAt: number | null;
	createdAt: number;
};

export type WorkspaceChangedFile = {
	path: string;
	kind: 'plan' | 'project' | 'state' | 'docs' | 'workflows' | 'prompts' | 'agents';
	status: 'missing' | 'changed' | 'current';
};

export type WorkspaceRoutingLog = {
	id: string;
	taskType: string;
	tier: number;
	model: string;
	remote: boolean;
	privacyDecision: string;
	tokensIn: number | null;
	tokensOut: number | null;
	errorCode: string | null;
	createdAt: number;
};

export class WorkspaceSyncService {
	constructor(private readonly db: Db = getDb()) {}

	getWorkspaceRoot(): string {
		return loadConfig().config.app.workspace_dir;
	}

	getBryonRoot(): string {
		return join(this.getWorkspaceRoot(), '.bryon');
	}

	listCheckpoints(limit = 25): WorkspaceCheckpoint[] {
		return this.db
			.select()
			.from(workspaceCheckpoints)
			.orderBy(desc(workspaceCheckpoints.createdAt))
			.limit(Math.min(Math.max(1, limit), 100))
			.all()
			.map(toCheckpoint);
	}

	listFindings(limit = 100): SyncAuditFinding[] {
		return this.db
			.select()
			.from(syncAuditFindings)
			.where(isNull(syncAuditFindings.resolvedAt))
			.orderBy(desc(syncAuditFindings.createdAt))
			.limit(Math.min(Math.max(1, limit), 500))
			.all()
			.map(toFinding);
	}

	listChangedFiles(): WorkspaceChangedFile[] {
		const root = this.getBryonRoot();
		return this.expectedWorkspaceFiles(root).map((file) => {
			if (!existsSync(file.path)) {
				return { path: file.path, kind: file.kind, status: 'missing' };
			}
			return {
				path: file.path,
				kind: file.kind,
				status: readFileSync(file.path, 'utf8') === file.content ? 'current' : 'changed',
			};
		});
	}

	listRoutingLogs(limit = 50): WorkspaceRoutingLog[] {
		return this.db
			.select()
			.from(routingLogs)
			.orderBy(desc(routingLogs.createdAt))
			.limit(Math.min(Math.max(1, limit), 200))
			.all()
			.map(toRoutingLog);
	}

	checkpoint(description: string): WorkspaceCheckpoint {
		const root = this.getBryonRoot();
		ensureWorkspaceDirs(root);
		this.writeWorkspaceFiles(root);

		const now = Date.now();
		const id = randomUUID();
		const path = join(root, 'checkpoints', `${new Date(now).toISOString().replaceAll(':', '-')}.md`);
		const snapshot = this.snapshot();
		atomicWrite(
			path,
			`# ${description}\n\nCreated: ${new Date(now).toISOString()}\n\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\`\n`,
		);
		this.db.insert(workspaceCheckpoints).values({
			id,
			description,
			path,
			snapshotJson: JSON.stringify(snapshot),
			createdAt: now,
		}).run();
		const row = this.db
			.select()
			.from(workspaceCheckpoints)
			.where(eq(workspaceCheckpoints.id, id))
			.get();
		if (!row) throw new Error('Checkpoint was not created.');
		return toCheckpoint(row);
	}

	audit(): SyncAuditFinding[] {
		const root = this.getBryonRoot();
		const now = Date.now();
		const findings: Array<Omit<SyncAuditFinding, 'id' | 'createdAt' | 'resolvedAt' | 'checkpointId'> & { checkpointId?: string | null }> = [];
		if (!existsSync(root)) {
			findings.push({
				severity: 'warning',
				code: 'BRYON_FOLDER_MISSING',
				message: '.bryon folder has not been created for this workspace.',
				path: root,
			});
		}
		for (const required of ['plan', 'projects', 'state', 'agents', 'docs', 'workflows', 'prompts', 'checkpoints']) {
			const path = join(root, required);
			if (!existsSync(path)) {
				findings.push({
					severity: 'warning',
					code: 'BRYON_SUBDIR_MISSING',
					message: `Missing .bryon/${required} directory.`,
					path,
				});
			}
		}
		for (const file of this.listChangedFiles()) {
			if (file.status === 'current') continue;
			findings.push({
				severity: file.status === 'missing' ? 'warning' : 'info',
				code: file.status === 'missing' ? 'BRYON_FILE_MISSING' : 'BRYON_FILE_STALE',
				message: `${file.kind} file is ${file.status}.`,
				path: file.path,
			});
		}

		this.db.transaction(() => {
			this.db.update(syncAuditFindings).set({ resolvedAt: now }).where(isNull(syncAuditFindings.resolvedAt)).run();
			for (const finding of findings) {
				this.db.insert(syncAuditFindings).values({
					id: randomUUID(),
					checkpointId: finding.checkpointId ?? null,
					severity: finding.severity,
					code: finding.code,
					message: finding.message,
					path: finding.path,
					resolvedAt: null,
					createdAt: now,
				}).run();
			}
		});

		return this.listFindings();
	}

	sync(description = 'Workspace sync'): WorkspaceCheckpoint {
		return this.checkpoint(description);
	}

	private writeWorkspaceFiles(root: string): void {
		for (const file of this.expectedWorkspaceFiles(root)) {
			atomicWrite(file.path, file.content);
		}
	}

	private expectedWorkspaceFiles(root: string): Array<{
		path: string;
		kind: WorkspaceChangedFile['kind'];
		content: string;
	}> {
		const files: Array<{
			path: string;
			kind: WorkspaceChangedFile['kind'];
			content: string;
		}> = [];
		const plans = new PlanService(this.db).list({ includeArchived: true, limit: 200 });
		const cardService = new PlanCardService(this.db);
		const projectService = new ProjectService(this.db);
		const taskService = new TaskService(this.db);

		for (const plan of plans) {
			const planRoot = join(root, 'plan');
			files.push({
				path: join(planRoot, 'README.md'),
				kind: 'plan',
				content: `# ${plan.name}\n\n${plan.summary ?? ''}\n`,
			});
			for (const series of ['100', '200', '300', '400', '500', '600', '700', '800', '900', '1000'] as const) {
				const cards = cardService.list({ planId: plan.id, series, includeArchived: false });
				files.push({
					path: join(planRoot, `${series}-${seriesTitle(series)}.md`),
					kind: 'plan',
					content: `# ${series} ${seriesTitle(series)}\n\n${cards.map((card) => `## ${card.title}\n\n${card.body}`).join('\n\n')}\n`,
				});
			}

			for (const project of projectService.list({ planId: plan.id, includeArchived: true })) {
				const safeName = slug(project.name);
				const projectRoot = join(root, 'projects', safeName);
				files.push({
					path: join(projectRoot, 'summary.md'),
					kind: 'project',
					content: `# ${project.name}\n\n${project.description ?? ''}\n`,
				});
				const tasks = taskService.list({ projectId: project.id, includeArchived: true });
				files.push({
					path: join(projectRoot, 'tasks.md'),
					kind: 'project',
					content: `# Tasks\n\n${tasks.map((task) => `- [${task.status === 'completed' ? 'x' : ' '}] ${task.title} (${task.status})`).join('\n')}\n`,
				});
				files.push({
					path: join(projectRoot, 'decisions.md'),
					kind: 'project',
					content: '# Decisions\n\n',
				});
			}
		}

		files.push({
			path: join(root, 'state', 'changelog.md'),
			kind: 'state',
			content: `# Changelog\n\nLast sync: ${new Date().toISOString().slice(0, 10)}\n`,
		});
		files.push({ path: join(root, 'docs', 'README.md'), kind: 'docs', content: '# Docs\n\n' });
		files.push({ path: join(root, 'workflows', 'README.md'), kind: 'workflows', content: '# Workflows\n\n' });
		files.push({ path: join(root, 'prompts', 'README.md'), kind: 'prompts', content: '# Prompts\n\n' });
		files.push({ path: join(root, 'agents', 'README.md'), kind: 'agents', content: '# Agents\n\n' });
		return files;
	}

	private snapshot() {
		return {
			plans: new PlanService(this.db).list({ includeArchived: true, limit: 200 }),
			projects: new ProjectService(this.db).list({ includeArchived: true, limit: 500 }),
		};
	}
}

function ensureWorkspaceDirs(root: string): void {
	for (const dir of [
		'plan',
		'projects',
		'state',
		'agents',
		'docs',
		'workflows',
		'prompts',
		'checkpoints',
	]) {
		mkdirSync(join(root, dir), { recursive: true });
	}
}

function atomicWrite(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
	writeFileSync(tempPath, content, 'utf8');
	renameSync(tempPath, path);
}

function toCheckpoint(row: CheckpointRow): WorkspaceCheckpoint {
	return {
		id: row.id,
		description: row.description,
		path: row.path,
		snapshot: JSON.parse(row.snapshotJson),
		createdAt: row.createdAt,
	};
}

function toFinding(row: AuditFindingRow): SyncAuditFinding {
	return {
		id: row.id,
		checkpointId: row.checkpointId,
		severity: row.severity,
		code: row.code,
		message: row.message,
		path: row.path,
		resolvedAt: row.resolvedAt,
		createdAt: row.createdAt,
	};
}

function toRoutingLog(row: RoutingLogRow): WorkspaceRoutingLog {
	return {
		id: row.id,
		taskType: row.taskType,
		tier: row.tier,
		model: row.model,
		remote: row.remote === 1,
		privacyDecision: row.privacyDecision,
		tokensIn: row.tokensIn,
		tokensOut: row.tokensOut,
		errorCode: row.errorCode,
		createdAt: row.createdAt,
	};
}

function seriesTitle(series: string): string {
	switch (series) {
		case '100':
			return 'purpose';
		case '200':
			return 'context';
		case '300':
			return 'goals';
		case '400':
			return 'rules';
		case '500':
			return 'standards';
		case '600':
			return 'tools';
		case '700':
			return 'workflows';
		case '800':
			return 'projects';
		case '900':
			return 'actions';
		case '1000':
			return 'review';
		default:
			return 'section';
	}
}

function slug(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
}
