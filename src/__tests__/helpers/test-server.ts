/**
 * Test harness for FastMCP tool testing.
 *
 * FastMCP doesn't expose registered tools publicly, so we intercept `addTool`
 * calls to capture them. This lets us call tool `execute` handlers directly
 * with our mock Discord client, without needing a transport layer.
 *
 * Zod schema validation is run before execute (mirroring FastMCP's real behavior)
 * so that schema-level errors (invalid URLs, missing required fields) are caught
 * in tests exactly as they would be at runtime.
 */

import { FastMCP } from "fastmcp";
import type { ZodTypeAny } from "zod/v4";

// biome-ignore lint/suspicious/noExplicitAny: tool definitions have varied parameter shapes
type CapturedTool = { name: string; parameters: ZodTypeAny; execute: (args: any) => Promise<any> };

export function createTestServer(): {
	server: FastMCP;
	/** All tools captured during registration */
	tools: CapturedTool[];
	/** Find a tool by name, validate args against its schema, then call execute */
	callTool: (name: string, args?: Record<string, unknown>) => Promise<string>;
} {
	const server = new FastMCP({ name: "test-server", version: "0.0.0" });
	const tools: CapturedTool[] = [];

	// Intercept addTool to capture tool definitions
	const originalAddTool = server.addTool.bind(server);
	// biome-ignore lint/suspicious/noExplicitAny: wrapping generic method
	server.addTool = (tool: any) => {
		tools.push({ name: tool.name, parameters: tool.parameters, execute: tool.execute });
		return originalAddTool(tool);
	};

	return {
		server,
		tools,
		callTool: async (name: string, args: Record<string, unknown> = {}) => {
			const tool = tools.find((t) => t.name === name);
			if (!tool) {
				const available = tools.map((t) => t.name).join(", ");
				throw new Error(`Tool "${name}" not found. Available: ${available}`);
			}
			// Run Zod validation to mirror FastMCP's runtime behavior
			const parsed = tool.parameters.parse(args);
			const result = await tool.execute(parsed);
			return typeof result === "string" ? result : JSON.stringify(result);
		},
	};
}
