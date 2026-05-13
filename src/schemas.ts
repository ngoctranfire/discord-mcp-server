import { z } from "zod/v4";

/**
 * Shared Zod schemas for Discord embed objects and reusable parameter definitions.
 * Imported by message, webhook, and thread tool registrations to keep them DRY.
 */

export const EmbedSchema = z.object({
	title: z.string().optional().describe("Title of the embed."),
	description: z.string().optional().describe("Description text."),
	url: z.string().url().optional().describe("URL the title links to."),
	color: z
		.number()
		.int()
		.optional()
		.describe("Embed colour as a decimal integer (e.g. 0xFF0000 → 16711680)."),
	image: z
		.object({ url: z.string().url().describe("URL of the full-size image.") })
		.optional()
		.describe("Large image displayed at the bottom of the embed."),
	thumbnail: z
		.object({ url: z.string().url().describe("URL of the thumbnail.") })
		.optional()
		.describe("Small image displayed in the top-right corner."),
	fields: z
		.array(
			z.object({
				name: z.string().describe("Field label."),
				value: z.string().describe("Field content."),
				inline: z
					.boolean()
					.optional()
					.describe("Whether this field sits inline with adjacent fields."),
			}),
		)
		.max(25)
		.optional()
		.describe("Up to 25 name/value field pairs."),
});

/**
 * `embeds` parameter accepted by send_message, send_webhook_message, and reply_to_thread.
 * Up to 10 embeds per message (Discord API limit).
 */
export const embedsParam = z
	.array(EmbedSchema)
	.max(10)
	.optional()
	.describe(
		"Up to 10 Discord embed objects. Each embed can include a title, description, image URL, " +
			"thumbnail URL, colour, fields, and a clickable link. " +
			"Use image.url / thumbnail.url to display photos inline without uploading files.",
	);
