import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { z } from 'zod';
import { loadConfig } from '$lib/server/config';
import { getDb } from '$lib/server/db/client';
import type * as schema from '$lib/server/db/schema';
import { PlanCardService, PlanService, TaskService } from '$lib/server/features/plans/plan';
import { ProjectService } from '$lib/server/features/projects/project';
import {
	LLMAdapterError,
	type LLMAdapter,
	type LLMMessage,
	type LLMStreamEvent,
} from '$lib/server/llm/adapter';
import { OllamaAdapter } from '$lib/server/llm/ollama';
import { countTokens } from '$lib/server/llm/tokens';
import { logRoutingDecision, routeModel, type RoutingDecision } from '$lib/server/llm/router';
import type { LLMParams, Plan, PlanCard, Project, Task, TaskStatus } from '$lib/shared/types';

type Db = BetterSQLite3Database<typeof schema>;
type GeneratedBy = 'model' | 'fallback';
type TaskDraft = {
	title: string;
	description: string | null;
	status: TaskStatus;
};

type GenerationResult<T> = {
	value: T;
	generatedBy: GeneratedBy;
	tokensIn: number;
	tokensOut: number;
	errorCode: string | null;
};

type ProjectExpansionOptions = {
	adapter?: LLMAdapter | null;
	requestTimeoutMs?: number;
};

export type ProjectExpansionResult = {
	routing: RoutingDecision;
	tasks: Task[];
	contextCards: number;
	generatedBy: GeneratedBy;
	generationError: string | null;
};

export type TaskExpansionResult = {
	routing: RoutingDecision;
	tasks: Task[];
	generatedBy: GeneratedBy;
	generationError: string | null;
};

export type AgentInstructionResult = {
	routing: RoutingDecision;
	markdown: string;
	generatedBy: GeneratedBy;
	generationError: string | null;
};

const taskDraftSchema = z.object({
	title: z.string().trim().min(1).max(160),
	description: z.string().trim().nullable().optional(),
	status: z.enum(['proposed', 'planned', 'in_progress', 'blocked', 'completed', 'archived'])
		.default('planned'),
});

const taskDraftsSchema = z.object({
	tasks: z.array(taskDraftSchema).min(1).max(12),
});

export class ProjectExpansionService {
	constructor(
		private readonly db: Db = getDb(),
		private readonly options: ProjectExpansionOptions = {},
	) {}

	async expandProject(input: {
		projectId: string;
		preferRemote?: boolean;
		highestQuality?: boolean;
		localOnly?: boolean;
		remoteApproved?: boolean;
	}): Promise<ProjectExpansionResult | null> {
		const projectService = new ProjectService(this.db);
		const project = projectService.get(input.projectId);
		if (!project?.planId) return null;
		const planId = project.planId;

		const config = loadConfig().config;
		const cards = relevantCards(planId, this.db);
		const plan = new PlanService(this.db).get(planId);
		const localOnly = input.localOnly === true || cards.some((card) => card.locked);
		const routing = routeModel({
			config,
			taskType: 'project_expansion',
			localOnly,
			preferRemote: input.preferRemote,
			highestQuality: input.highestQuality,
			remoteApproved: input.remoteApproved,
		});
		const generation = await this.generateProjectTaskDrafts({
			config,
			routing,
			plan,
			project,
			cards,
		});
		const service = new TaskService(this.db);
		const existingTitles = new Set(
			service.list({ projectId: project.id, includeArchived: true })
				.map((task) => task.title.toLowerCase()),
		);
		const tasks = generation.value
			.filter((draft) => !existingTitles.has(draft.title.toLowerCase()))
			.map((title, index) => service.create({
				planId,
				projectId: project.id,
				title: title.title,
				description: title.description,
				status: title.status,
				sortOrder: existingTitles.size + index,
			}));

		logRoutingDecision(routing, {
			tokensIn: generation.tokensIn,
			tokensOut: generation.tokensOut,
			errorCode: generation.errorCode,
		});
		return {
			routing,
			tasks,
			contextCards: cards.length,
			generatedBy: generation.generatedBy,
			generationError: generation.errorCode,
		};
	}

	async expandTask(input: {
		projectId: string;
		taskId: string;
		localOnly?: boolean;
		preferRemote?: boolean;
		highestQuality?: boolean;
		remoteApproved?: boolean;
	}): Promise<TaskExpansionResult | null> {
		const project = new ProjectService(this.db).get(input.projectId);
		const existingTask = new TaskService(this.db).get(input.taskId);
		if (!project?.planId || !existingTask || existingTask.projectId !== project.id) {
			return null;
		}
		const planId = project.planId;

		const config = loadConfig().config;
		const cards = relevantCards(planId, this.db);
		const localOnly = input.localOnly === true || cards.some((card) => card.locked);
		const routing = routeModel({
			config,
			taskType: 'project_expansion',
			localOnly,
			preferRemote: input.preferRemote,
			highestQuality: input.highestQuality,
			remoteApproved: input.remoteApproved,
		});
		const generation = await this.generateTaskDrafts({
			config,
			routing,
			project,
			task: existingTask,
			cards,
		});
		const taskService = new TaskService(this.db);
		const existingTitles = new Set(
			taskService.list({ projectId: project.id, includeArchived: true })
				.map((task) => task.title.toLowerCase()),
		);
		const tasks = generation.value
			.filter((draft) => !existingTitles.has(draft.title.toLowerCase()))
			.map((title, index) => taskService.create({
				planId,
				projectId: project.id,
				title: title.title,
				description: title.description,
				status: title.status,
				sortOrder: existingTitles.size + index,
			}));

		logRoutingDecision(routing, {
			tokensIn: generation.tokensIn,
			tokensOut: generation.tokensOut,
			errorCode: generation.errorCode,
		});
		return {
			routing,
			tasks,
			generatedBy: generation.generatedBy,
			generationError: generation.errorCode,
		};
	}

	async agentInstructions(input: {
		projectId: string;
		localOnly?: boolean;
		preferRemote?: boolean;
		highestQuality?: boolean;
		remoteApproved?: boolean;
	}): Promise<AgentInstructionResult | null> {
		const project = new ProjectService(this.db).get(input.projectId);
		if (!project?.planId) return null;
		const planId = project.planId;
		const plan = new PlanService(this.db).get(planId);
		const cards = relevantCards(planId, this.db);
		const tasks = new TaskService(this.db).list({ projectId: project.id });
		const config = loadConfig().config;
		const localOnly = input.localOnly === true || cards.some((card) => card.locked);
		const routing = routeModel({
			config,
			taskType: 'agent_instructions',
			localOnly,
			preferRemote: input.preferRemote,
			highestQuality: input.highestQuality,
			remoteApproved: input.remoteApproved,
		});
		const generation = await this.generateAgentInstructions({
			config,
			routing,
			plan,
			project,
			cards,
			tasks,
		});

		logRoutingDecision(routing, {
			tokensIn: generation.tokensIn,
			tokensOut: generation.tokensOut,
			errorCode: generation.errorCode,
		});
		return {
			routing,
			markdown: generation.value,
			generatedBy: generation.generatedBy,
			generationError: generation.errorCode,
		};
	}

	private async generateProjectTaskDrafts(input: {
		config: ReturnType<typeof loadConfig>['config'];
		routing: RoutingDecision;
		plan: Plan | null;
		project: Project;
		cards: PlanCard[];
	}): Promise<GenerationResult<TaskDraft[]>> {
		const fallback = fallbackProjectDrafts(input.project, input.cards);
		const prompt = projectExpansionPrompt(input.plan, input.project, input.cards);
		const model = await this.generateText(input.config, input.routing, prompt);
		if (!model.ok) {
			return fallbackGeneration(fallback, prompt, model.errorCode);
		}

		const parsed = parseTaskDrafts(model.text);
		if (!parsed.ok) {
			return fallbackGeneration(fallback, prompt, parsed.errorCode);
		}
		return {
			value: parsed.drafts,
			generatedBy: 'model',
			tokensIn: countTokens(messagesText(prompt)),
			tokensOut: model.tokensOut ?? countTokens(model.text),
			errorCode: null,
		};
	}

	private async generateTaskDrafts(input: {
		config: ReturnType<typeof loadConfig>['config'];
		routing: RoutingDecision;
		project: Project;
		task: Task;
		cards: PlanCard[];
	}): Promise<GenerationResult<TaskDraft[]>> {
		const fallback = fallbackTaskDrafts(input.task);
		const prompt = taskExpansionPrompt(input.project, input.task, input.cards);
		const model = await this.generateText(input.config, input.routing, prompt);
		if (!model.ok) {
			return fallbackGeneration(fallback, prompt, model.errorCode);
		}

		const parsed = parseTaskDrafts(model.text);
		if (!parsed.ok) {
			return fallbackGeneration(fallback, prompt, parsed.errorCode);
		}
		return {
			value: parsed.drafts,
			generatedBy: 'model',
			tokensIn: countTokens(messagesText(prompt)),
			tokensOut: model.tokensOut ?? countTokens(model.text),
			errorCode: null,
		};
	}

	private async generateAgentInstructions(input: {
		config: ReturnType<typeof loadConfig>['config'];
		routing: RoutingDecision;
		plan: Plan | null;
		project: Project;
		cards: PlanCard[];
		tasks: Task[];
	}): Promise<GenerationResult<string>> {
		const fallback = fallbackAgentInstructions(input.plan, input.project, input.cards, input.tasks);
		const prompt = agentInstructionPrompt(input.plan, input.project, input.cards, input.tasks);
		const model = await this.generateText(input.config, input.routing, prompt);
		if (!model.ok) {
			return fallbackGeneration(fallback, prompt, model.errorCode);
		}
		const markdown = model.text.trim();
		if (!markdown || markdown.length < 40) {
			return fallbackGeneration(fallback, prompt, 'MODEL_OUTPUT_EMPTY');
		}
		return {
			value: markdown,
			generatedBy: 'model',
			tokensIn: countTokens(messagesText(prompt)),
			tokensOut: model.tokensOut ?? countTokens(markdown),
			errorCode: null,
		};
	}

	private async generateText(
		config: ReturnType<typeof loadConfig>['config'],
		routing: RoutingDecision,
		messages: LLMMessage[],
	): Promise<
		| { ok: true; text: string; tokensOut: number | null }
		| { ok: false; errorCode: string }
	> {
		if (routing.blocked) return { ok: false, errorCode: 'ROUTING_BLOCKED' };
		if (routing.tier === 4) return { ok: false, errorCode: 'DIRECT_GEMINI_UNIMPLEMENTED' };
		const adapter = this.options.adapter === undefined
			? new OllamaAdapter({ baseUrl: config.llm.base_url, defaultParams: config.llm.params as LLMParams })
			: this.options.adapter;
		if (!adapter) return { ok: false, errorCode: 'MODEL_GENERATION_DISABLED' };

		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort('Project expansion timed out.'),
			this.options.requestTimeoutMs ?? 20_000,
		);
		try {
			const stream = await adapter.stream({
				model: routing.model,
				messages,
				params: {
					...config.llm.params,
					temperature: Math.min(config.llm.params.temperature, 0.7),
					num_predict: Math.min(config.llm.params.num_predict, 768),
				},
				signal: controller.signal,
				thinking: false,
			});
			const collected = await collectText(stream);
			return { ok: true, text: collected.text, tokensOut: collected.tokensOut };
		} catch (error) {
			if (error instanceof LLMAdapterError) {
				return { ok: false, errorCode: error.code };
			}
			if (controller.signal.aborted) return { ok: false, errorCode: 'MODEL_GENERATION_TIMEOUT' };
			return { ok: false, errorCode: 'MODEL_GENERATION_FAILED' };
		} finally {
			clearTimeout(timeout);
		}
	}
}

function relevantCards(planId: string, db: Db): PlanCard[] {
	const service = new PlanCardService(db);
	return service
		.list({ planId, includeArchived: false })
		.filter((card) => card.contextWeight !== 'never');
}

function expansionDescription(projectDescription: string | null, cards: PlanCard[]): string | null {
	const context = cards.find((card) => card.series === '100' || card.series === '300');
	return [
		projectDescription,
		context ? `Plan context: ${context.title}` : null,
	].filter(Boolean).join('\n\n') || null;
}

function fallbackProjectDrafts(project: Project, cards: PlanCard[]): TaskDraft[] {
	const sourceTitles = cards
		.filter((card) => card.series === '900')
		.map((card) => card.title)
		.slice(0, 4);
	const titles = sourceTitles.length
		? sourceTitles
		: [
				`Define done state for ${project.name}`,
				`Collect source material for ${project.name}`,
				`Execute first checkpoint for ${project.name}`,
			];
	return titles.map((title) => ({
		title,
		description: expansionDescription(project.description, cards),
		status: 'planned',
	}));
}

function fallbackTaskDrafts(task: Task): TaskDraft[] {
	return [
		`Prepare: ${task.title}`,
		`Do: ${task.title}`,
		`Review: ${task.title}`,
	].map((title) => ({
		title,
		description: `Expanded from task: ${task.title}`,
		status: 'planned',
	}));
}

function fallbackAgentInstructions(
	plan: Plan | null,
	project: Project,
	cards: PlanCard[],
	tasks: Task[],
): string {
	return [
		`# Agent Instructions: ${project.name}`,
		'',
		`Plan: ${plan?.name ?? 'Unknown'}`,
		project.description ? `Outcome: ${project.description}` : null,
		'',
		'## Context',
		...cards.slice(0, 8).map((card) => `- ${card.series}: ${card.title}`),
		'',
		'## Tasks',
		...(tasks.length ? tasks.map((task) => `- [ ] ${task.title}`) : ['- [ ] Define the first concrete task.']),
		'',
		'## Operating Rules',
		'- Preserve local-only content boundaries.',
		'- Write down decisions before changing project direction.',
		'- Produce checkpointable work.',
	].filter((line): line is string => line !== null).join('\n');
}

function projectExpansionPrompt(plan: Plan | null, project: Project, cards: PlanCard[]): LLMMessage[] {
	return [
		{
			role: 'system',
			content: [
				'You are Bryon, a local-first planning engine.',
				'Return only JSON. Do not wrap the JSON in markdown.',
				'Schema: {"tasks":[{"title":"short imperative task","description":"one or two useful sentences","status":"planned"}]}',
				'Generate 3 to 6 concrete next tasks. Preserve local-only privacy constraints.',
			].join('\n'),
		},
		{
			role: 'user',
			content: JSON.stringify({
				plan: plan ? { name: plan.name, summary: plan.summary, status: plan.status } : null,
				project: {
					name: project.name,
					description: project.description,
					status: project.status,
				},
				contextCards: cards.map(cardForPrompt),
			}, null, 2),
		},
	];
}

function taskExpansionPrompt(project: Project, task: Task, cards: PlanCard[]): LLMMessage[] {
	return [
		{
			role: 'system',
			content: [
				'You are Bryon, a local-first planning engine.',
				'Return only JSON. Do not wrap the JSON in markdown.',
				'Schema: {"tasks":[{"title":"short imperative subtask","description":"specific execution note","status":"planned"}]}',
				'Generate 3 to 5 subtasks that make the source task directly actionable.',
			].join('\n'),
		},
		{
			role: 'user',
			content: JSON.stringify({
				project: {
					name: project.name,
					description: project.description,
					status: project.status,
				},
				task: {
					title: task.title,
					description: task.description,
					status: task.status,
				},
				contextCards: cards.map(cardForPrompt),
			}, null, 2),
		},
	];
}

function agentInstructionPrompt(
	plan: Plan | null,
	project: Project,
	cards: PlanCard[],
	tasks: Task[],
): LLMMessage[] {
	return [
		{
			role: 'system',
			content: [
				'You write concise Markdown agent instruction files for a local-first workspace.',
				'Return only Markdown. Include sections: Goal, Context, Tasks, Rules, Output.',
				'Do not include hidden reasoning or implementation commentary.',
			].join('\n'),
		},
		{
			role: 'user',
			content: JSON.stringify({
				plan: plan ? { name: plan.name, summary: plan.summary, status: plan.status } : null,
				project: {
					name: project.name,
					description: project.description,
					status: project.status,
				},
				contextCards: cards.map(cardForPrompt),
				tasks: tasks.map((task) => ({
					title: task.title,
					description: task.description,
					status: task.status,
				})),
			}, null, 2),
		},
	];
}

function cardForPrompt(card: PlanCard) {
	return {
		series: card.series,
		title: card.title,
		body: card.body,
		contextWeight: card.contextWeight,
		locked: card.locked,
	};
}

async function collectText(stream: ReadableStream<LLMStreamEvent>): Promise<{ text: string; tokensOut: number | null }> {
	const reader = stream.getReader();
	let text = '';
	let tokensOut: number | null = null;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value?.type === 'token') text += value.delta;
			if (value?.type === 'done') tokensOut = value.tokensOut ?? countTokens(text);
		}
	} finally {
		reader.releaseLock();
	}
	return { text, tokensOut };
}

function parseTaskDrafts(raw: string): { ok: true; drafts: TaskDraft[] } | { ok: false; errorCode: string } {
	const parsedJson = parseJsonObject(raw);
	if (!parsedJson.ok) return { ok: false, errorCode: parsedJson.errorCode };
	const parsed = taskDraftsSchema.safeParse(parsedJson.value);
	if (!parsed.success) return { ok: false, errorCode: 'MODEL_OUTPUT_SCHEMA_INVALID' };
	return {
		ok: true,
		drafts: parsed.data.tasks.map((task) => ({
			title: task.title,
			description: task.description ?? null,
			status: task.status,
		})),
	};
}

function parseJsonObject(raw: string): { ok: true; value: unknown } | { ok: false; errorCode: string } {
	const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const candidate = fenced?.[1] ?? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
	if (!candidate.trim()) return { ok: false, errorCode: 'MODEL_OUTPUT_JSON_MISSING' };
	try {
		return { ok: true, value: JSON.parse(candidate) };
	} catch {
		return { ok: false, errorCode: 'MODEL_OUTPUT_JSON_INVALID' };
	}
}

function fallbackGeneration<T>(
	value: T,
	messages: LLMMessage[],
	errorCode: string,
): GenerationResult<T> {
	const output = typeof value === 'string' ? value : JSON.stringify(value);
	return {
		value,
		generatedBy: 'fallback',
		tokensIn: countTokens(messagesText(messages)),
		tokensOut: countTokens(output),
		errorCode,
	};
}

function messagesText(messages: LLMMessage[]): string {
	return messages.map((message) => `${message.role}: ${message.content}`).join('\n');
}
