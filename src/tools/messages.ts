import type { Client, TextChannel } from "discord.js";
import type { FastMCP } from "fastmcp";
import { z } from "zod/v4";
import { embedsParam } from "../schemas.ts";
import { formatMessage, withDiscordErrorHandling } from "../utils.ts";

export function registerMessageTools(
	server: FastMCP,
	client: Client,
	_defaultGuildId?: string,
): void {
	server.addTool({
		name: "send_message",
		description:
			"Send a message to a Discord channel. Supports plain text and embeds (images, titles, " +
			"descriptions, fields). At least one of `message` or `embeds` must be provided. " +
			"Returns the sent message ID.",
		parameters: z
			.object({
				channelId: z.string().describe("ID of the channel to send the message to."),
				message: z
					.string()
					.optional()
					.describe("Text content to send (max 2000 characters). Optional if embeds are provided."),
				embeds: embedsParam,
			})
			.refine((data) => data.message || (data.embeds && data.embeds.length > 0), {
				message: "At least one of `message` or `embeds` must be provided.",
			}),
		execute: async (args) => {
			return withDiscordErrorHandling(async () => {
				const channel = await client.channels.fetch(args.channelId);
				if (!channel?.isTextBased() || !("send" in channel)) {
					return `Channel ${args.channelId} is not a text channel or cannot receive messages.`;
				}

				const sent = await (channel as TextChannel).send({
					content: args.message || undefined,
					embeds: args.embeds,
				});
				return `✅ Message sent (ID: ${sent.id}) in #${(channel as TextChannel).name}`;
			});
		},
	});

	server.addTool({
		name: "read_messages",
		description:
			"Read recent messages from a Discord channel. Returns messages with author, timestamp, and content.",
		parameters: z.object({
			channelId: z.string().describe("ID of the channel to read messages from."),
			count: z
				.number()
				.int()
				.min(1)
				.max(100)
				.optional()
				.default(50)
				.describe("Number of messages to read (1-100, default 50)."),
		}),
		execute: async (args) => {
			return withDiscordErrorHandling(async () => {
				const channel = await client.channels.fetch(args.channelId);
				if (!channel?.isTextBased() || !("messages" in channel)) {
					return `Channel ${args.channelId} is not a text channel.`;
				}

				const messages = await (channel as TextChannel).messages.fetch({
					limit: args.count,
				});

				if (messages.size === 0) {
					return "No messages found in this channel.";
				}

				const formatted = messages
					.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
					.map(formatMessage);

				return `**Messages in #${(channel as TextChannel).name} (${messages.size}):**\n\n${formatted.join("\n")}`;
			});
		},
	});

	server.addTool({
		name: "edit_message",
		description: "Edit a message previously sent by the bot in a Discord channel.",
		parameters: z.object({
			channelId: z.string().describe("ID of the channel containing the message."),
			messageId: z.string().describe("ID of the message to edit."),
			newMessage: z.string().describe("New content for the message (max 2000 characters)."),
		}),
		execute: async (args) => {
			return withDiscordErrorHandling(async () => {
				const channel = await client.channels.fetch(args.channelId);
				if (!channel?.isTextBased() || !("messages" in channel)) {
					return `Channel ${args.channelId} is not a text channel.`;
				}

				const message = await (channel as TextChannel).messages.fetch(args.messageId);
				if (message.author.id !== client.user?.id) {
					return "Cannot edit messages from other users. The bot can only edit its own messages.";
				}

				await message.edit(args.newMessage);
				return `✅ Message ${args.messageId} edited successfully.`;
			});
		},
	});

	server.addTool({
		name: "delete_message",
		description:
			"Delete a message from a Discord channel. Bot can delete its own messages or others if it has Manage Messages permission.",
		parameters: z.object({
			channelId: z.string().describe("ID of the channel containing the message."),
			messageId: z.string().describe("ID of the message to delete."),
		}),
		execute: async (args) => {
			return withDiscordErrorHandling(async () => {
				const channel = await client.channels.fetch(args.channelId);
				if (!channel?.isTextBased() || !("messages" in channel)) {
					return `Channel ${args.channelId} is not a text channel.`;
				}

				const message = await (channel as TextChannel).messages.fetch(args.messageId);
				await message.delete();
				return `✅ Message ${args.messageId} deleted successfully.`;
			});
		},
	});

	server.addTool({
		name: "add_reaction",
		description: "Add an emoji reaction to a message in a Discord channel.",
		parameters: z.object({
			channelId: z.string().describe("ID of the channel containing the message."),
			messageId: z.string().describe("ID of the message to react to."),
			emoji: z.string().describe("Emoji to react with (e.g., '👍', '🎉', or custom emoji name)."),
		}),
		execute: async (args) => {
			return withDiscordErrorHandling(async () => {
				const channel = await client.channels.fetch(args.channelId);
				if (!channel?.isTextBased() || !("messages" in channel)) {
					return `Channel ${args.channelId} is not a text channel.`;
				}

				const message = await (channel as TextChannel).messages.fetch(args.messageId);
				await message.react(args.emoji);
				return `✅ Added reaction ${args.emoji} to message ${args.messageId}.`;
			});
		},
	});

	server.addTool({
		name: "remove_reaction",
		description: "Remove the bot's emoji reaction from a message.",
		parameters: z.object({
			channelId: z.string().describe("ID of the channel containing the message."),
			messageId: z.string().describe("ID of the message to remove reaction from."),
			emoji: z.string().describe("Emoji to remove (e.g., '👍', '🎉')."),
		}),
		execute: async (args) => {
			return withDiscordErrorHandling(async () => {
				const channel = await client.channels.fetch(args.channelId);
				if (!channel?.isTextBased() || !("messages" in channel)) {
					return `Channel ${args.channelId} is not a text channel.`;
				}

				const message = await (channel as TextChannel).messages.fetch(args.messageId);
				await message.reactions.cache.get(args.emoji)?.users.remove(client.user?.id);
				return `✅ Removed reaction ${args.emoji} from message ${args.messageId}.`;
			});
		},
	});
}
