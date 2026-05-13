/**
 * Discord.js mock factory — creates mock Client, Guild, Channel objects
 * that implement just enough of the discord.js interface for our MCP tools.
 *
 * Uses Map-backed collections that support filter/sort/map/values/size
 * so the real tool handler logic can run against these without special casing.
 */

import {
	ALL_CHANNELS,
	ALL_ROLES,
	BOT_USER,
	GUILD_FIXTURE,
	GUILD_MEMBER,
	MESSAGE_FROM_BOT,
	MESSAGE_SIMPLE,
	MESSAGE_WITH_ATTACHMENTS,
	OWNER_FIXTURE,
	THREAD_ACTIVE,
	THREAD_ARCHIVED,
	WEBHOOK_GITHUB,
	WEBHOOK_MONITORING,
} from "./fixtures";

// ─── Collection Mock ────────────────────────────────────────────────────────
// discord.js Collection extends Map with extra methods like filter, sort, map.

export function createCollection<V>(entries: Array<[string, V]> = []): MockCollection<V> {
	const map = new Map(entries);
	return {
		get: (key: string) => map.get(key),
		has: (key: string) => map.has(key),
		set: (key: string, val: V) => {
			map.set(key, val);
			return map;
		},
		delete: (key: string) => map.delete(key),
		get size() {
			return map.size;
		},
		values: () => map.values(),
		entries: () => map.entries(),
		forEach: (fn: (value: V, key: string) => void) => map.forEach(fn),
		filter: (fn: (value: V, key: string) => boolean) => {
			const filtered = Array.from(map.entries()).filter(([k, v]) => fn(v, k));
			return createCollection(filtered);
		},
		sort: (fn: (a: V, b: V) => number) => {
			const sorted = Array.from(map.entries()).sort(([, a], [, b]) => fn(a, b));
			return createCollection(sorted);
		},
		map: <R>(fn: (value: V, key: string) => R): R[] => {
			return Array.from(map.entries()).map(([k, v]) => fn(v, k));
		},
		find: (fn: (value: V) => boolean) => {
			for (const v of map.values()) {
				if (fn(v)) return v;
			}
			return undefined;
		},
	};
}

interface MockCollection<V> {
	delete: (key: string) => boolean;
	entries: () => IterableIterator<[string, V]>;
	filter: (fn: (value: V, key: string) => boolean) => MockCollection<V>;
	find: (fn: (value: V) => boolean) => V | undefined;
	forEach: (fn: (value: V, key: string) => void) => void;
	get: (key: string) => V | undefined;
	has: (key: string) => boolean;
	map: <R>(fn: (value: V, key: string) => R) => R[];
	set: (key: string, val: V) => Map<string, V>;
	readonly size: number;
	sort: (fn: (a: V, b: V) => number) => MockCollection<V>;
	values: () => IterableIterator<V>;
}

// ─── Channel Mock ───────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: mock factory needs flexible types
function createMockChannel(fixture: (typeof ALL_CHANNELS)[number]): any {
	const isText = fixture.type === 0 || fixture.type === 5; // GuildText or GuildAnnouncement
	const isVoice = fixture.type === 2;
	const isCategory = fixture.type === 4;
	const isForum = fixture.type === 15;

	const messages = createCollection([
		[MESSAGE_SIMPLE.id, createMockMessage(MESSAGE_SIMPLE)],
		[MESSAGE_WITH_ATTACHMENTS.id, createMockMessage(MESSAGE_WITH_ATTACHMENTS)],
		[MESSAGE_FROM_BOT.id, createMockMessage(MESSAGE_FROM_BOT)],
	]);

	const activeThreads = createCollection([[THREAD_ACTIVE.id, createMockThread(THREAD_ACTIVE)]]);
	const archivedThreads = createCollection([
		[THREAD_ARCHIVED.id, createMockThread(THREAD_ARCHIVED)],
	]);

	const webhooks = createCollection([
		[WEBHOOK_GITHUB.id, createMockWebhook(WEBHOOK_GITHUB)],
		[WEBHOOK_MONITORING.id, createMockWebhook(WEBHOOK_MONITORING)],
	]);

	return {
		id: fixture.id,
		name: fixture.name,
		type: fixture.type,
		position: fixture.position,
		parentId: fixture.parentId,
		guildId: fixture.guildId,

		isTextBased: () => isText || isForum,
		isVoiceBased: () => isVoice,
		isThread: () => false,

		// Text channel features
		...(isText
			? {
					send: async (content: string | { content?: string; embeds?: unknown[] }) => ({
						id: `new-msg-${Date.now()}`,
						content: typeof content === "string" ? content : (content.content ?? ""),
					}),
					messages: {
						fetch: async (opts?: { limit?: number } | string) => {
							if (typeof opts === "string") {
								const msg = messages.get(opts);
								if (!msg) throw new Error("Unknown Message");
								return msg;
							}
							return messages;
						},
					},
					threads: {
						fetchActive: async () => ({ threads: activeThreads }),
						fetchArchived: async () => ({ threads: archivedThreads }),
						create: async (opts: { name: string; type?: number }) => ({
							id: `new-thread-${Date.now()}`,
							name: opts.name,
							send: async () => ({}),
						}),
					},
					fetchWebhooks: async () => webhooks,
					createWebhook: async (opts: { name: string }) => ({
						id: `new-webhook-${Date.now()}`,
						name: opts.name,
						url: `https://discord.com/api/webhooks/new-webhook-${Date.now()}/token`,
					}),
					delete: async () => {},
					setParent: async () => {},
				}
			: {}),

		// Voice channel features
		...(isVoice
			? {
					delete: async () => {},
					setParent: async () => {},
				}
			: {}),

		// Category features
		...(isCategory
			? {
					delete: async () => {},
				}
			: {}),

		// Forum channel features
		...(isForum
			? {
					threads: {
						create: async (opts: { name: string; message: { content: string } }) => ({
							id: `new-forum-post-${Date.now()}`,
							name: opts.name,
						}),
					},
					delete: async () => {},
					setParent: async () => {},
				}
			: {}),
	};
}

// ─── Message Mock ───────────────────────────────────────────────────────────

function createMockMessage(
	fixture: typeof MESSAGE_SIMPLE | typeof MESSAGE_WITH_ATTACHMENTS | typeof MESSAGE_FROM_BOT,
	// biome-ignore lint/suspicious/noExplicitAny: mock factory returns untyped discord.js shape
): any {
	return {
		id: fixture.id,
		content: fixture.content,
		author: fixture.author,
		createdAt: fixture.createdAt,
		createdTimestamp: fixture.createdTimestamp,
		attachments: fixture.attachments,
		embeds: fixture.embeds,
		edit: async (content: string) => ({ ...fixture, content }),
		delete: async () => {},
		react: async () => {},
		startThread: async (opts: { name: string }) => ({
			id: `new-thread-from-msg-${Date.now()}`,
			name: opts.name,
			send: async () => ({}),
		}),
		reactions: {
			cache: createCollection([
				[
					"👍",
					{
						users: {
							remove: async () => {},
						},
					},
				],
			]),
		},
	};
}

// ─── Thread Mock ────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: mock factory
function createMockThread(fixture: typeof THREAD_ACTIVE | typeof THREAD_ARCHIVED): any {
	const threadMessages = createCollection([[MESSAGE_SIMPLE.id, createMockMessage(MESSAGE_SIMPLE)]]);

	return {
		id: fixture.id,
		name: fixture.name,
		archived: fixture.archived,
		messageCount: fixture.messageCount,
		memberCount: fixture.memberCount,
		parentId: fixture.parentId,
		createdAt: fixture.createdAt,
		type: fixture.type,
		parent: { name: "dev-chat" },

		isThread: () => true,
		isTextBased: () => true,

		send: async (content: string | { content?: string; embeds?: unknown[] }) => ({
			id: `new-thread-msg-${Date.now()}`,
			content: typeof content === "string" ? content : (content.content ?? ""),
		}),
		messages: {
			fetch: async () => threadMessages,
		},
	};
}

// ─── Webhook Mock ───────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: mock factory
function createMockWebhook(fixture: typeof WEBHOOK_GITHUB | typeof WEBHOOK_MONITORING): any {
	return {
		id: fixture.id,
		name: fixture.name,
		url: fixture.url,
		owner: fixture.owner,
		channelId: fixture.channelId,
		delete: async () => {},
		send: async (content?: string | { content?: string; embeds?: unknown[] }) => ({
			id: `new-webhook-msg-${Date.now()}`,
			content: typeof content === "string" ? content : (content?.content ?? ""),
		}),
		edit: async () => ({}),
	};
}

// ─── Role Mock ──────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: mock factory
function createMockRole(fixture: (typeof ALL_ROLES)[number]): any {
	return {
		id: fixture.id,
		name: fixture.name,
		hexColor: fixture.hexColor,
		position: fixture.position,
		hoist: fixture.hoist,
		mentionable: fixture.mentionable,
		members: createCollection(Array.from(fixture.members.entries())),
		edit: async () => {},
		delete: async () => {},
	};
}

// ─── Guild Mock ─────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: mock factory
function createMockGuild(): any {
	const channelEntries = ALL_CHANNELS.map(
		(ch) => [ch.id, createMockChannel(ch)] as [string, ReturnType<typeof createMockChannel>],
	);

	const roleEntries = ALL_ROLES.map(
		(r) => [r.id, createMockRole(r)] as [string, ReturnType<typeof createMockRole>],
	);

	const guild = {
		...GUILD_FIXTURE,
		channels: {
			cache: createCollection(channelEntries),
			create: async (opts: { name: string; type: number; parent?: string; topic?: string }) => {
				const newChannel = {
					id: `new-channel-${Date.now()}`,
					name: opts.name,
					type: opts.type,
				};
				return newChannel;
			},
			fetchActiveThreads: async () => ({
				threads: createCollection([[THREAD_ACTIVE.id, createMockThread(THREAD_ACTIVE)]]),
			}),
		},
		roles: {
			cache: createCollection(roleEntries),
			create: async (opts: {
				name: string;
				color?: string;
				hoist?: boolean;
				mentionable?: boolean;
			}) => ({
				id: `new-role-${Date.now()}`,
				name: opts.name,
				hexColor: opts.color || "#000000",
			}),
		},
		members: {
			fetch: async () => ({
				...GUILD_MEMBER,
				user: GUILD_MEMBER.user,
				roles: GUILD_MEMBER.roles,
			}),
		},
		fetch: async () => guild,
		fetchOwner: async () => ({
			user: OWNER_FIXTURE,
		}),
	};

	return guild;
}

// ─── Client Mock ────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: mock factory
export function createMockDiscordClient(): any {
	const guild = createMockGuild();

	// Flat map of all channels (guild channels + threads) for client.channels.fetch
	const allChannelEntries = ALL_CHANNELS.map(
		(ch) => [ch.id, createMockChannel(ch)] as [string, unknown],
	);
	// Add threads
	allChannelEntries.push(
		[THREAD_ACTIVE.id, createMockThread(THREAD_ACTIVE)],
		[THREAD_ARCHIVED.id, createMockThread(THREAD_ARCHIVED)],
	);

	const channelMap = new Map(allChannelEntries);

	return {
		user: BOT_USER,
		guilds: {
			cache: createCollection([[GUILD_FIXTURE.id, guild]]),
		},
		channels: {
			fetch: async (id: string) => {
				const ch = channelMap.get(id);
				if (!ch) return null;
				return ch;
			},
		},
		fetchWebhook: async (id: string, _token?: string) => {
			if (id === WEBHOOK_GITHUB.id) return createMockWebhook(WEBHOOK_GITHUB);
			if (id === WEBHOOK_MONITORING.id) return createMockWebhook(WEBHOOK_MONITORING);
			// For send_webhook_message with token
			return {
				id,
				name: "Dynamic Webhook",
				send: async (content?: string | { content?: string; embeds?: unknown[] }) => ({
					id: `new-webhook-msg-${Date.now()}`,
					content: typeof content === "string" ? content : (content?.content ?? ""),
				}),
				edit: async () => ({}),
				delete: async () => {},
			};
		},
	};
}
