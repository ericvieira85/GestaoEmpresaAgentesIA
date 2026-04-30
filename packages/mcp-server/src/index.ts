import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PaperclipApiClient } from "./client.js";
import { readConfigFromEnv, type PaperclipMcpConfig } from "./config.js";
import { createToolDefinitions, getToolsForRole } from "./tools.js";

export function createPaperclipMcpServer(config: PaperclipMcpConfig = readConfigFromEnv()) {
  const server = new McpServer({
    name: "paperclip",
    version: "0.1.0",
  });

  const client = new PaperclipApiClient(config);
  const allTools = createToolDefinitions(client);

  // Resolve the effective allowlist: explicit > role-based > all tools.
  const explicitAllowlist = config.allowedTools && config.allowedTools.length > 0
    ? new Set(config.allowedTools)
    : null;
  const roleAllowlist = explicitAllowlist === null ? getToolsForRole(config.agentRole) : null;
  const allowlist = explicitAllowlist ?? roleAllowlist;

  const tools = allowlist ? allTools.filter((t) => allowlist.has(t.name)) : allTools;
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.schema.shape, tool.execute);
  }

  return {
    server,
    tools,
    client,
  };
}

export async function runServer(config: PaperclipMcpConfig = readConfigFromEnv()) {
  const { server } = createPaperclipMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
