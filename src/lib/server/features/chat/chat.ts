import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
	chatSchema,
	llmParamsSchema,
	messageSchema,
} from '../../../shared/schemas';
import type { Chat, LLMParams, Message, MessageRole } from '../../../shared/types';
import { getDb, getSqlite } from '../../db/client';
import type * as schema from '../../db/schema';
import { chats, messages, personas } from '../../db/schema';

type Db = BetterSQLite3Database<typeof schema>;
type ChatRow = typeof chats.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
type MessageCompatRow = Omit<MessageRow, 'attachmentsJson'> & {
	attachmentsJson?: string | null;
};

let supportsAttachmentsColumn: boolean | null = null;

export type ListChatsInput = {
	archived?: boolean;
	includeArchived?: boolean;
	limit?: number;
	offset?: number;
};

export type CreateChatInput = {
	id?: string;
	title?: string;
	model?: string;
	personaId?: string;
	params?: Partial<LLMParams> | null;
};

export type UpdateChatInput = Partial<
	Pick<CreateChatInput, 'title' | 'personaId' | 'params'>
> & {
	model?: string | null;
	archived?: boolean;
};

export type ListMessagesInput = {
	beforeCreatedAt?: number;
	limit?: number;
};

export type CreateMessageInput = {
	id?: string;
	chatId: string;
	role: MessageRole;
	content: string;
	tokensIn?: number | null;
	tokensOut?: number | null;
	msToFirst?: number | null;
	msTotal?: number | null;
	createdAt?: number;
	summarized?: boolean;
	attachmentsJson?: string | null;
};

export class ChatService {
	private static listMessagesStmt: any = null;

	constructor(private readonly db: Db = getDb()) {
		this.initPreparedStatements();
	}

	private initPreparedStatements() {
		if (ChatService.listMessagesStmt || !this.hasAttachmentsColumn()) return;
		try {
			ChatService.listMessagesStmt = this.db
				.select()
				.from(messages)
				.where(
					and(
						eq(messages.chatId, sql.placeholder('chatId')),
						lt(messages.createdAt, sql.placeholder('beforeCreatedAt')),
					),
				)
				.orderBy(desc(messages.createdAt))
				.limit(sql.placeholder('limit'))
				.prepare('listMessages');
		} catch (error) {
			console.warn('Failed to prepare listMessages statement:', error);
		}
	}

	list(input: ListChatsInput = {}): Chat[] {
		const limit = normalizeLimit(input.limit, 50, 200);
		const offset = Math.max(0, input.offset ?? 0);

		const rows = input.includeArchived
			? this.db
					.select()
					.from(chats)
					.orderBy(desc(chats.updatedAt), desc(chats.createdAt))
					.limit(limit)
					.offset(offset)
					.all()
			: this.db
					.select()
					.from(chats)
					.where(eq(chats.archived, input.archived ? 1 : 0))
					.orderBy(desc(chats.updatedAt), desc(chats.createdAt))
					.limit(limit)
					.offset(offset)
					.all();

		return rows.map(toChat);
	}

	get(id: string): Chat | null {
		const row = this.db.select().from(chats).where(eq(chats.id, id)).get();
		return row ? toChat(row) : null;
	}

	create(input: CreateChatInput = {}): Chat {
		const now = Date.now();
		const id = input.id ?? randomUUID();
		const personaId = input.personaId ?? this.getDefaultPersonaId();

		this.db
			.insert(chats)
			.values({
				id,
				title: input.title ?? 'New chat',
				model: input.model ?? null,
				personaId,
				createdAt: now,
				updatedAt: now,
				archived: 0,
				paramsJson: serializeParams(input.params),
			})
			.run();

		const created = this.get(id);
		if (!created) {
			throw new Error(`Chat "${id}" was not created.`);
		}

		return created;
	}

	update(id: string, input: UpdateChatInput): Chat | null {
		const values: Partial<typeof chats.$inferInsert> = {
			updatedAt: Date.now(),
		};

		let hasChanges = false;
		if (input.title !== undefined) {
			values.title = input.title;
			hasChanges = true;
		}
		if (input.model !== undefined) {
			values.model = input.model;
			hasChanges = true;
		}
		if (input.personaId !== undefined) {
			values.personaId = input.personaId;
			hasChanges = true;
		}
		if (input.archived !== undefined) {
			values.archived = input.archived ? 1 : 0;
			hasChanges = true;
		}
		if (Object.hasOwn(input, 'params')) {
			values.paramsJson = serializeParams(input.params);
			hasChanges = true;
		}

		if (!hasChanges) return this.get(id);

		const result = this.db
			.update(chats)
			.set(values)
			.where(eq(chats.id, id))
			.run();

		if (result.changes === 0) return null;
		return this.get(id);
	}

	archive(id: string, archived = true): Chat | null {
		return this.update(id, { archived });
	}

	delete(id: string): boolean {
		const result = this.db.delete(chats).where(eq(chats.id, id)).run();
		return result.changes > 0;
	}

	listMessages(chatId: string, input: ListMessagesInput = {}): Message[] {
		const limit = normalizeLimit(input.limit, 100, 500);
		if (!this.hasAttachmentsColumn()) {
			return this.listMessagesCompat(chatId, input);
		}

		try {
			if (input.beforeCreatedAt === undefined) {
				const rows = this.db
					.select()
					.from(messages)
					.where(eq(messages.chatId, chatId))
					.orderBy(desc(messages.createdAt))
					.limit(limit)
					.all();
				return rows.reverse().map(toMessage);
			}

			if (!ChatService.listMessagesStmt) {
				return this.listMessagesCompat(chatId, input);
			}

			const rows = ChatService.listMessagesStmt.all({
				chatId,
				beforeCreatedAt: input.beforeCreatedAt,
				limit,
			});

			return rows.reverse().map(toMessage);
		} catch (error) {
			if (!isMissingAttachmentsColumnError(error)) throw error;
			supportsAttachmentsColumn = false;
			return this.listMessagesCompat(chatId, input);
		}
	}

	addMessage(input: CreateMessageInput): Message {
		const createdAt = input.createdAt ?? Date.now();
		const updatedAt = Date.now();
		const id = input.id ?? randomUUID();

		this.db.transaction((tx) => {
			const messageValues: typeof messages.$inferInsert = {
				id,
				chatId: input.chatId,
				role: input.role,
				content: input.content,
				tokensIn: input.tokensIn ?? null,
				tokensOut: input.tokensOut ?? null,
				msToFirst: input.msToFirst ?? null,
				msTotal: input.msTotal ?? null,
				createdAt,
				summarized: input.summarized ? 1 : 0,
				...(this.hasAttachmentsColumn()
					? { attachmentsJson: input.attachmentsJson ?? null }
					: {}),
			};

			try {
				tx.insert(messages).values(messageValues).run();
			} catch (error) {
				if (!isMissingAttachmentsColumnError(error)) throw error;
				supportsAttachmentsColumn = false;
				const fallbackValues: typeof messages.$inferInsert = {
					id,
					chatId: input.chatId,
					role: input.role,
					content: input.content,
					tokensIn: input.tokensIn ?? null,
					tokensOut: input.tokensOut ?? null,
					msToFirst: input.msToFirst ?? null,
					msTotal: input.msTotal ?? null,
					createdAt,
					summarized: input.summarized ? 1 : 0,
				};
				tx.insert(messages).values(fallbackValues).run();
			}

			tx.update(chats)
				.set({ updatedAt })
				.where(eq(chats.id, input.chatId))
				.run();
		});

		const created = this.getMessage(id);
		if (!created) {
			throw new Error(`Message "${id}" was not created.`);
		}

		return created;
	}

	getMessage(id: string): Message | null {
		if (!this.hasAttachmentsColumn()) {
			return this.getMessageCompat(id);
		}

		try {
			const row = this.db
				.select()
				.from(messages)
				.where(eq(messages.id, id))
				.get();

			return row ? toMessage(row) : null;
		} catch (error) {
			if (!isMissingAttachmentsColumnError(error)) throw error;
			supportsAttachmentsColumn = false;
			return this.getMessageCompat(id);
		}
	}

	markMessagesSummarized(ids: string[]): number {
		if (ids.length === 0) return 0;

		const result = this.db
			.update(messages)
			.set({ summarized: 1 })
			.where(inArray(messages.id, ids))
			.run();

		return result.changes;
	}

	private getDefaultPersonaId(): string {
		const row = this.db
			.select({ id: personas.id })
			.from(personas)
			.orderBy(asc(personas.createdAt), asc(personas.name))
			.limit(1)
			.get();

		if (!row) {
			throw new Error('Cannot create a chat before a persona exists.');
		}

		return row.id;
	}

	private listMessagesCompat(chatId: string, input: ListMessagesInput = {}): Message[] {
		const sqlite = getSqlite();
		const limit = normalizeLimit(input.limit, 100, 500);
		const params: Array<string | number> = [chatId];
		let where = 'chat_id = ?';
		if (input.beforeCreatedAt !== undefined) {
			where += ' AND created_at < ?';
			params.push(input.beforeCreatedAt);
		}
		params.push(limit);

		const rows = sqlite
			.prepare(
				`SELECT
					id,
					chat_id AS chatId,
					role,
					content,
					tokens_in AS tokensIn,
					tokens_out AS tokensOut,
					ms_to_first AS msToFirst,
					ms_total AS msTotal,
					created_at AS createdAt,
					summarized,
					NULL AS attachmentsJson
				FROM messages
				WHERE ${where}
				ORDER BY created_at DESC
				LIMIT ?`,
			)
			.all(...params) as MessageCompatRow[];

		return rows.reverse().map(toMessage);
	}

	private getMessageCompat(id: string): Message | null {
		const sqlite = getSqlite();
		const row = sqlite
			.prepare(
				`SELECT
					id,
					chat_id AS chatId,
					role,
					content,
					tokens_in AS tokensIn,
					tokens_out AS tokensOut,
					ms_to_first AS msToFirst,
					ms_total AS msTotal,
					created_at AS createdAt,
					summarized,
					NULL AS attachmentsJson
				FROM messages
				WHERE id = ?
				LIMIT 1`,
			)
			.get(id) as MessageCompatRow | undefined;

		return row ? toMessage(row) : null;
	}

	private hasAttachmentsColumn(): boolean {
		if (supportsAttachmentsColumn !== null) return supportsAttachmentsColumn;
		try {
			const rows = getSqlite()
				.prepare('PRAGMA table_info("messages")')
				.all() as Array<{ name: string }>;
			supportsAttachmentsColumn = rows.some((row) => row.name === 'attachments_json');
			return supportsAttachmentsColumn;
		} catch {
			supportsAttachmentsColumn = false;
			return false;
		}
	}
}

function toChat(row: ChatRow): Chat {
	return chatSchema.parse({
		...row,
		archived: row.archived === 1,
		params: parseParams(row.paramsJson),
	});
}

function toMessage(row: MessageCompatRow): Message {
	return messageSchema.parse({
		...row,
		summarized: row.summarized === 1,
	});
}

function parseParams(value: string | null): Partial<LLMParams> | null {
	if (!value) return null;
	return llmParamsSchema.partial().parse(JSON.parse(value));
}

function serializeParams(
	value: Partial<LLMParams> | null | undefined,
): string | null {
	if (!value) return null;
	return JSON.stringify(llmParamsSchema.partial().parse(value));
}

function normalizeLimit(
	value: number | undefined,
	defaultValue: number,
	maxValue: number,
): number {
	if (value === undefined) return defaultValue;
	return Math.min(Math.max(1, value), maxValue);
}


function isMissingAttachmentsColumnError(error: unknown): boolean {
	return (
		error instanceof Error &&
		/no such column:\s*"?attachments_json"?/i.test(error.message)
	);
}
