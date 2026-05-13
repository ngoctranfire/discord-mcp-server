import { beforeEach, describe, expect, it, mock } from "bun:test";
import { UserError } from "fastmcp";
import { registerThreadTools } from "../../tools/threads";
import { createMockDiscordClient } from "../helpers/discord-mock";
import {
	CHANNEL_DEV_CHAT,
	CHANNEL_FORUM,
	GUILD_FIXTURE,
	MESSAGE_SIMPLE,
	THREAD_ACTIVE,
} from "../helpers/fixtures";
import { createTestServer } from "../helpers/test-server";

describe("thread tools", () => {
	let client: ReturnType<typeof createMockDiscordClient>;
	let callTool: ReturnType<typeof createTestServer>["callTool"];

	beforeEach(() => {
		client = createMockDiscordClient();
		const harness = createTestServer();
		registerThreadTools(harness.server, client, GUILD_FIXTURE.id);
		callTool = harness.callTool;
	});

	describe("list_threads", () => {
		it("returns active threads for a guild", async () => {
			const result = await callTool("list_threads", {
				guildId: GUILD_FIXTURE.id,
			});
			expect(result).toContain(THREAD_ACTIVE.name);
			expect(result).toContain(`ID: ${THREAD_ACTIVE.id}`);
			expect(result).toContain("🟢 Active");
		});
	});

	describe("create_thread", () => {
		it("creates a thread from a message", async () => {
			const result = await callTool("create_thread", {
				channelId: CHANNEL_DEV_CHAT.id,
				name: "New Discussion",
				messageId: MESSAGE_SIMPLE.id,
			});
			expect(result).toContain("✅");
			expect(result).toContain("Created thread");
			expect(result).toContain("New Discussion");
			expect(result).toContain("ID:");
			expect(result).toContain(MESSAGE_SIMPLE.id);
		});

		it("creates a standalone thread", async () => {
			const result = await callTool("create_thread", {
				channelId: CHANNEL_DEV_CHAT.id,
				name: "Standalone Thread",
			});
			expect(result).toContain("✅");
			expect(result).toContain("Created thread");
			expect(result).toContain("Standalone Thread");
			expect(result).toContain(`#${CHANNEL_DEV_CHAT.name}`);
		});

		it("requires message content for forum posts", async () => {
			try {
				await callTool("create_thread", {
					channelId: CHANNEL_FORUM.id,
					name: "Forum Post",
				});
				expect.unreachable("Should have thrown");
			} catch (e) {
				expect(e).toBeInstanceOf(UserError);
				expect((e as UserError).message).toContain("message is required");
			}
		});
	});

	describe("reply_to_thread", () => {
		it("sends a reply in a thread", async () => {
			const thread = await client.channels.fetch(THREAD_ACTIVE.id);
			const sendSpy = mock(() => Promise.resolve({ id: "new-reply-id", content: "Thread reply" }));
			thread.send = sendSpy;

			const result = await callTool("reply_to_thread", {
				threadId: THREAD_ACTIVE.id,
				message: "Thread reply",
			});
			expect(result).toContain("✅");
			expect(result).toContain("Reply sent");
			expect(result).toContain(THREAD_ACTIVE.name);
			expect(sendSpy).toHaveBeenCalledTimes(1);
		});

		it("sends embeds-only reply in a thread", async () => {
			const result = await callTool("reply_to_thread", {
				threadId: THREAD_ACTIVE.id,
				embeds: [{ image: { url: "https://example.com/photo.jpg" } }],
			});
			expect(result).toContain("✅");
			expect(result).toContain("Reply sent");
			expect(result).toContain(THREAD_ACTIVE.name);
		});

		it("sends reply with both text and embeds in a thread", async () => {
			const result = await callTool("reply_to_thread", {
				threadId: THREAD_ACTIVE.id,
				message: "Here's the image:",
				embeds: [{ title: "Photo", image: { url: "https://example.com/photo.jpg" } }],
			});
			expect(result).toContain("✅");
			expect(result).toContain("Reply sent");
		});

		it("rejects when neither message nor embeds are provided", async () => {
			await expect(callTool("reply_to_thread", { threadId: THREAD_ACTIVE.id })).rejects.toThrow();
		});

		it("rejects thread reply embed with malformed image URL", async () => {
			await expect(
				callTool("reply_to_thread", {
					threadId: THREAD_ACTIVE.id,
					embeds: [{ image: { url: "not-a-url" } }],
				}),
			).rejects.toThrow();
		});
	});

	describe("get_thread", () => {
		it("returns thread details with messages", async () => {
			const result = await callTool("get_thread", {
				threadId: THREAD_ACTIVE.id,
				messageCount: 10,
			});
			expect(result).toContain(`Thread: ${THREAD_ACTIVE.name}`);
			expect(result).toContain(`ID: ${THREAD_ACTIVE.id}`);
			expect(result).toContain("Archived: No");
			expect(result).toContain("Recent Messages");
		});
	});
});
