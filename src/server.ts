import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

/** Identity and inventory of a created server, for logging / banners. */
export interface ServerCatalog {
  name: string;
  version: string;
  tools: string[];
  resources: string[];
  prompts: string[];
}

/**
 * Creates a fully configured MCP server instance with all tools, resources,
 * and prompts registered. The server is transport-agnostic — connect it to a
 * stdio or HTTP transport (see stdio.ts / http.ts).
 *
 * Returns both the server and a `catalog` describing what was registered, so
 * the entry points can print a useful startup banner.
 */
export function createServer(): { server: McpServer; catalog: ServerCatalog } {
  const name = "nodejs-mcp-server";
  const version = "1.0.0";

  const server = new McpServer(
    {
      name,
      version,
    },
    {
      // Advertise the capabilities we implement so clients can discover them.
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        logging: {},
      },
      instructions:
        "A demonstration MCP server with example tools, resources, and prompts. " +
        "No authentication is required. Intended for testing MCP clients.",
    }
  );

  const catalog: ServerCatalog = {
    name,
    version,
    tools: registerTools(server),
    resources: registerResources(server),
    prompts: registerPrompts(server),
  };

  return { server, catalog };
}
