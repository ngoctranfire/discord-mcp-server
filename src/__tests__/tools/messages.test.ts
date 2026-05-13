import { beforeEach, describe, expect, it, mock } from "bun:test";
import { registerMessageTools } from "../../tools/messages";
import { createMockDiscordClient } from "../helpers/discord-mock";
import {
	CHANNEL_GENERAL,
	MESSAGE_FROM_BOT,
	MESSAGE_SIMPLE,
	REGULAR_USER,
} from "../helpers/fixtures";
import { createTestServer } from "../helpers/test-server";

describe("message tools", () => {
	let client: ReturnType<typeof createMockDiscordClient>;
	let callTool: ReturnType<typeof createTestServer>["callTool"];

	beforeEach(() => {
		client = createMockDiscordClient();
		const harness = createTestServer();
		registerMessageTools(harness.server, client);
		callTool = harness.callTool;
	});

	describe("send_message", () => {
		it("sends a message and returns confirmation with ID", async () => {
			const result = await callTool("send_message", {
				channelId: CHANNEL_GENERAL.id,
				message: "Hello from test!",
			});
			expect(result).toContain("✅");
			expect(result).toContain("Message sent");
			expect(result).toContain("ID:");
			expect(result).toContain(`#${CHANNEL_GENERAL.name}`);
		});

		it("sends embeds-only message with image URL", async () => {
			const result = await callTool("send_message", {
				channelId: CHANNEL_GENERAL.id,
				embeds: [{ image: { url: "https://example.com/photo.jpg" } }],
			});
			expect(result).toContain("✅");
			expect(result).toContain("Message sent");
			expect(result).toContain(`#${CHANNEL_GENERAL.name}`);
		});

		it("sends message with both text and multiple image embeds", async () => {
			const result = await callTool("send_message", {
				channelId: CHANNEL_GENERAL.id,
				message: "Check these out:",
				embeds: [
					{ title: "Photo 1", image: { url: "https://example.com/1.jpg" } },
					{ title: "Photo 2", image: { url: "https://example.com/2.jpg" } },
				],
			});
			expect(result).toContain("✅");
			expect(result).toContain("Message sent");
		});

		it("sends embed with all optional fields", async () => {
			const result = await callTool("send_message", {
				channelId: CHANNEL_GENERAL.id,
				embeds: [
					{
						title: "My Title",
						description: "Some description",
						url: "https://example.com",
						color: 16734003,
						image: { url: "https://example.com/img.jpg" },
						thumbnail: { url: "https://example.com/thumb.jpg" },
						fields: [{ name: "Field 1", value: "Value 1", inline: true }],
					},
				],
			});
			expect(result).toContain("✅");
		});

		it("rejects when neither message nor embeds are provided", async () => {
			await expect(callTool("send_message", { channelId: CHANNEL_GENERAL.id })).rejects.toThrow();
		});

		it("rejects embed with malformed image URL", async () => {
			await expect(
				callTool("send_message", {
					channelId: CHANNEL_GENERAL.id,
					embeds: [{ image: { url: "not-a-url" } }],
				}),
			).rejects.toThrow();
		});

		it("rejects embed with empty image URL", async () => {
			await expect(
				callTool("send_message", {
					channelId: CHANNEL_GENERAL.id,
					embeds: [{ image: { url: "" } }],
				}),
			).rejects.toThrow();
		});
	});

	describe("read_messages", () => {
		it("returns formatted messages with author details", async () => {
			const result = await callTool("read_messages", {
				channelId: CHANNEL_GENERAL.id,
				count: 10,
			});
			expect(result).toContain(`Messages in #${CHANNEL_GENERAL.name}`);
			expect(result).toContain(REGULAR_USER.username);
			expect(result).toContain(MESSAGE_SIMPLE.content);
		});
	});

	describe("edit_message", () => {
		it("edits a bot message and confirms", async () => {
			// Spy on the edit method
			const channel = await client.channels.fetch(CHANNEL_GENERAL.id);
			const msg = await channel.messages.fetch(MESSAGE_FROM_BOT.id);
			const editSpy = mock(() => Promise.resolve({ ...msg, content: "Updated content" }));
			msg.edit = editSpy;

			const result = await callTool("edit_message", {
				channelId: CHANNEL_GENERAL.id,
				messageId: MESSAGE_FROM_BOT.id,
				newMessage: "Updated content",
			});
			expect(result).toContain("✅");
			expect(result).toContain("edited successfully");
			expect(result).toContain(MESSAGE_FROM_BOT.id);
			expect(editSpy).toHaveBeenCalledTimes(1);
		});

		it("refuses to edit non-bot message", async () => {
			const result = await callTool("edit_message", {
				channelId: CHANNEL_GENERAL.id,
				messageId: MESSAGE_SIMPLE.id,
				newMessage: "Trying to edit",
			});
			expect(result).toContain("Cannot edit messages from other users");
		});
	});

	describe("delete_message", () => {
		it("deletes a message and confirms", async () => {
			const channel = await client.channels.fetch(CHANNEL_GENERAL.id);
			const msg = await channel.messages.fetch(MESSAGE_SIMPLE.id);
			const deleteSpy = mock(() => Promise.resolve());
			msg.delete = deleteSpy;

			const result = await callTool("delete_message", {
				channelId: CHANNEL_GENERAL.id,
				messageId: MESSAGE_SIMPLE.id,
			});
			expect(result).toContain("✅");
			expect(result).toContain("deleted successfully");
			expect(result).toContain(MESSAGE_SIMPLE.id);
			expect(deleteSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("add_reaction", () => {
		it("adds a reaction and confirms with emoji", async () => {
			const channel = await client.channels.fetch(CHANNEL_GENERAL.id);
			const msg = await channel.messages.fetch(MESSAGE_SIMPLE.id);
			const reactSpy = mock(() => Promise.resolve());
			msg.react = reactSpy;

			const result = await callTool("add_reaction", {
				channelId: CHANNEL_GENERAL.id,
				messageId: MESSAGE_SIMPLE.id,
				emoji: "🎉",
			});
			expect(result).toContain("✅");
			expect(result).toContain("🎉");
			expect(result).toContain(MESSAGE_SIMPLE.id);
			expect(reactSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("remove_reaction", () => {
		it("removes a reaction and confirms", async () => {
			const result = await callTool("remove_reaction", {
				channelId: CHANNEL_GENERAL.id,
				messageId: MESSAGE_SIMPLE.id,
				emoji: "👍",
			});
			expect(result).toContain("✅");
			expect(result).toContain("Removed reaction");
			expect(result).toContain("👍");
			expect(result).toContain(MESSAGE_SIMPLE.id);
		});
	});
});
