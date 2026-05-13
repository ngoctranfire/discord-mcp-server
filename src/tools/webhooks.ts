import type { Client, TextChannel } from "discord.js";
import type { FastMCP } from "fastmcp";
import { z } from "zod/v4";
import { embedsParam } from "../schemas.ts";
import { withDiscordErrorHandling } from "../utils.ts";

export function registerWebhookTools(
	server: FastMCP,
	client: Client,
	_defaultGuildId?: string,
): void {
	server.addTool({
		name: "list_webhooks",
		description: "List all webhooks in a Discord channel.",
		parameters: z.object({
			channelId: z.string().describe("ID of the channel to list webhooks for."),
		}),
		execute: async (args) => {
			return withDiscordErrorHandling(async () => {
				const channel = await client.channels.fetch(args.channelId);
				if (!channel || !("fetchWebhooks" in channel)) {
					return `Channel ${args.channelId} does not support webhooks.`;
				}

				const webhooks = await (channel as TextChannel).fetchWebhooks();
				if (webhooks.size === 0) {
					return "No webhooks found in this channel.";
				}

				const lines = webhooks.map(
					(wh) =>
						`• ${wh.name} (ID: ${wh.id})\n  URL: ${wh.url}\n  Created by: ${wh.owner && "tag" in wh.owner ? wh.owner.tag : "Unknown"}`,
				);

				return `**Webhooks (${webhooks.size}):**\n${lines.join("\n\n")}`;
			});
		},
	});

	server.addTool({
		name: "create_webhook",
		description: "Create a new webhook for a Discord channel.",
		parameters: z.object({
			channelId: z.string().describe("ID of the channel to create the webhook in."),
			name: z.string().describe("Display name for the webhook."),
		}),
		execute: async (args) => {
			return withDiscordErrorHandling(async () => {
				const channel = await client.channels.fetch(args.channelId);
				if (!channel || !("createWebhook" in channel)) {
					return `Channel ${args.channelId} does not support webhooks.`;
				}

				const webhook = await (channel as TextChannel).createWebhook({
					name: args.name,
				});

				return `✅ Created webhook "${args.name}" (ID: ${webhook.id})\nURL: ${webhook.url}`;
			});
		},
	});

	server.addTool({
		name: "delete_webhook",
		description: "Delete a webhook by its ID.",
		parameters: z.object({
			webhookId: z.string().describe("ID of the webhook to delete."),
		}),
		execute: async (args) => {
			return withDiscordErrorHandling(async () => {
				const webhook = await client.fetchWebhook(args.webhookId);
				const name = webhook.name;
				await webhook.delete();
				return `✅ Deleted webhook "${name}" (ID: ${args.webhookId})`;
			});
		},
	});

	server.addTool({
		name: "send_webhook_message",
		description:
			"Send a message through a Discord webhook. Supports custom username, avatar, and embeds. " +
			"At least one of `message` or `embeds` must be provided.",
		parameters: z
			.object({
				webhookUrl: z.string().url().describe("Full webhook URL."),
				message: z
					.string()
					.optional()
					.describe(
						"Message content to send (max 2000 characters). Optional if embeds are provided.",
					),
				username: z.string().optional().describe("Override display name for this message."),
				avatarUrl: z.string().url().optional().describe("Override avatar URL for this message."),
				embeds: embedsParam,
			})
			.refine((data) => data.message || (data.embeds && data.embeds.length > 0), {
				message: "At least one of `message` or `embeds` must be provided.",
			}),
		execute: async (args) => {
			return withDiscordErrorHandling(async () => {
				// Parse webhook URL to extract ID and token
				const match = args.webhookUrl.match(/discord(?:app)?\.com\/api\/webhooks\/(\d+)\/(.+)/);
				if (!match) {
					return "Invalid webhook URL format. Expected: https://discord.com/api/webhooks/{id}/{token}";
				}

				const [, webhookId, webhookToken] = match;
				const webhook = await client.fetchWebhook(webhookId, webhookToken);

				await webhook.send({
					content: args.message || undefined,
					username: args.username,
					avatarURL: args.avatarUrl,
					embeds: args.embeds,
				});

				return `✅ Message sent via webhook "${webhook.name}"`;
			});
		},
	});

	server.addTool({
		name: "edit_webhook",
		description: "Edit an existing webhook's name or channel.",
		parameters: z.object({
			webhookId: z.string().describe("ID of the webhook to edit."),
			name: z.string().optional().describe("New name for the webhook."),
			channelId: z.string().optional().describe("Move webhook to this channel."),
		}),
		execute: async (args) => {
			return withDiscordErrorHandling(async () => {
				const webhook = await client.fetchWebhook(args.webhookId);

				const updates: Record<string, string> = {};
				if (args.name) updates.name = args.name;
				if (args.channelId) updates.channel = args.channelId;

				if (Object.keys(updates).length === 0) {
					return "No changes specified. Provide at least a new name or channelId.";
				}

				await webhook.edit(updates);
				return `✅ Updated webhook "${webhook.name}" (ID: ${args.webhookId})`;
			});
		},
	});
}
