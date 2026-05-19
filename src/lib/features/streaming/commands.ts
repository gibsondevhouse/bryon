import { goto } from '$app/navigation';
import type { Chat, Message, Settings } from '$lib/shared/types';
import { parseCommand, helpText } from '$lib/shared/commands';

export type SlashCommandResult = {
	handled: boolean;
	error?: string;
	info?: string;
};

export type SlashCommandContext = {
	readonly chats: Chat[];
	readonly currentChatId: string | null;
	readonly messages: Message[];
	readonly settings: Settings | null;
	setChats: (chats: Chat[]) => void;
	createChat: () => Promise<string | null>;
	refreshChatList: () => Promise<void>;
};

export async function handleSlashCommand(
	ctx: SlashCommandContext,
	input: string,
): Promise<SlashCommandResult> {
	const parsed = parseCommand(input);
	if (parsed.kind === 'none') return { handled: false };
	if (parsed.kind === 'unknown') {
		return {
			handled: true,
			error: `Unknown command: /${parsed.name}. Type /help to see available commands.`,
		};
	}

	switch (parsed.name) {
		case 'help':
			return { handled: true, info: helpText };
		case 'new':
			void executeNewChat(ctx);
			return { handled: true };
		case 'clear':
			void executeClearChat(ctx);
			return { handled: true };
		case 'model':
			return await executeModelCommand(ctx, parsed.args);
		case 'export':
			executeExportChat(ctx);
			return { handled: true };
	}
}

async function executeNewChat(ctx: SlashCommandContext): Promise<void> {
	const id = await ctx.createChat();
	if (id) goto(`/chats/${id}`);
}

async function executeClearChat(ctx: SlashCommandContext): Promise<void> {
	if (!ctx.currentChatId) return;
	const current = ctx.chats.find((c) => c.id === ctx.currentChatId);
	const response = await fetch('/api/chats', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: current?.model,
		}),
	});
	if (response.ok) {
		const { chat }: { chat: Chat } = await response.json();
		ctx.setChats([chat, ...ctx.chats]);
		goto(`/chats/${chat.id}`);
	}
}

async function executeModelCommand(
	ctx: SlashCommandContext,
	args: string,
): Promise<SlashCommandResult> {
	if (!args) {
		const current = ctx.chats.find((c) => c.id === ctx.currentChatId);
		const pinned = current?.model;
		if (pinned) {
			return { handled: true, info: `Model pinned to: ${pinned}. Use /model reset to use the default chat model.` };
		}
		return {
			handled: true,
			info: `Model: ${ctx.settings?.llm.model ?? 'unknown'} (default). Use /model <name> to pin this chat.`,
		};
	}
	if (!ctx.currentChatId) {
		return { handled: true, error: 'Open a chat before switching models.' };
	}

	const newModel = args.trim();
	const isReset = newModel === 'reset';
	try {
		const response = await fetch(`/api/chats/${ctx.currentChatId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model: isReset ? null : newModel }),
		});
		if (!response.ok) {
			const err = await response.json().catch(() => null);
			return {
				handled: true,
				error:
					err?.error?.message ??
					`Failed to switch model (HTTP ${response.status}).`,
			};
		}
		const body = (await response.json().catch(() => null)) as
			| { chat?: Chat }
			| null;
		if (body?.chat) {
			ctx.setChats(
				ctx.chats.map((chat) =>
					chat.id === body.chat?.id ? body.chat : chat,
				),
			);
		}
		await ctx.refreshChatList();
		if (isReset) {
			return { handled: true, info: 'Model unpinned — will use the default chat model.' };
		}
		return { handled: true, info: `Model pinned to: ${newModel}` };
	} catch (error) {
		return {
			handled: true,
			error: (error as Error).message || 'Failed to switch model.',
		};
	}
}

function executeExportChat(ctx: SlashCommandContext): void {
	if (!ctx.currentChatId || ctx.messages.length === 0) return;
	const chat = ctx.chats.find((c) => c.id === ctx.currentChatId);
	const title = chat?.title ?? 'bryon-chat';
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.slice(0, 50);
	const date = new Date().toISOString().slice(0, 10);
	const lines = [
		`---`,
		`title: "${chat?.title}"`,
		`model: "${chat?.model ?? ctx.settings?.llm.model ?? 'unknown'}"`,
		`date: "${date}"`,
		`---\n`,
	];
	for (const msg of ctx.messages) {
		if (msg.role !== 'user' && msg.role !== 'assistant') continue;
		const label = msg.role === 'user' ? '**User:**' : '**Bryon:**';
		lines.push(`${label}\n${msg.content}\n`);
	}
	const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `bryon-${slug}-${date}.md`;
	a.click();
	URL.revokeObjectURL(url);
}
