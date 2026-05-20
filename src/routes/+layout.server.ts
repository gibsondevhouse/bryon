import type { LayoutServerLoad } from './$types';
import { loadConfig } from '$lib/server/config';
import { ChatService } from '$lib/server/features/chat/chat';
import { ProjectService } from '$lib/server/features/projects/project';
import { PlanService } from '$lib/server/features/plans/plan';
import type { Chat } from '$lib/shared/types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { config, configPath, parseError } = loadConfig();
	const chatService = new ChatService();
	const projectService = new ProjectService();
	const planService = new PlanService();
	const chats = chatService.list({ limit: 50 });
	const projects = projectService.list();
	const plans = planService.list({ limit: 100 });

	return {
		chats: chats.map((chat) => withResolvedModel(chat, config.llm.model)),
		projects,
		plans,
		settings: config,
		configPath,
		configParseError: parseError?.message ?? locals.configParseError,
		ollamaReachable: locals.ollamaReachable,
	};
};

function withResolvedModel(chat: Chat, defaultModel: string): Chat {
	return {
		...chat,
		resolvedModel: chat.model ?? defaultModel,
		modelSource: chat.model ? 'chat_pin' : 'global_default',
	};
}
