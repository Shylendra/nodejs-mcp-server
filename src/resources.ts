import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * A tiny in-memory "database" used to back the dynamic resources below.
 * In a real server this might be a file system, a SQL table, or an API.
 */
const USERS: Record<string, { id: string; name: string; role: string }> = {
  "1": { id: "1", name: "Ada Lovelace", role: "engineer" },
  "2": { id: "2", name: "Alan Turing", role: "researcher" },
  "3": { id: "3", name: "Grace Hopper", role: "admiral" },
};

/**
 * Registers demonstration resources on the given MCP server.
 *
 * Resources are application-controlled, read-only data the client can fetch by
 * URI. They come in two flavours:
 *   - Static resources: a fixed URI (e.g. `config://app`).
 *   - Templated resources: a URI template with variables (e.g. `users://{id}`),
 *     optionally with a `list` callback so clients can enumerate instances.
 */
export function registerResources(server: McpServer): string[] {
  // 1. A static resource — server configuration as JSON.
  server.registerResource(
    "app-config",
    "config://app",
    {
      title: "Application Config",
      description: "Static server configuration and feature flags.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              name: "nodejs-mcp-server",
              version: "1.0.0",
              features: { tools: true, resources: true, prompts: true, auth: false },
            },
            null,
            2
          ),
        },
      ],
    })
  );

  // 2. A static plain-text resource — a help / about document.
  server.registerResource(
    "about",
    "docs://about",
    {
      title: "About This Server",
      description: "Human-readable description of what this server provides.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: [
            "# nodejs-mcp-server",
            "",
            "A demonstration MCP server exposing example **tools**, **resources**,",
            "and **prompts** with no authentication. Use it to test MCP clients.",
          ].join("\n"),
        },
      ],
    })
  );

  // 3. A templated resource backed by the in-memory user store, with listing.
  server.registerResource(
    "user",
    new ResourceTemplate("users://{id}", {
      // The `list` callback lets clients enumerate every concrete resource
      // that matches this template.
      list: async () => ({
        resources: Object.values(USERS).map((u) => ({
          uri: `users://${u.id}`,
          name: u.name,
          description: `${u.name} (${u.role})`,
          mimeType: "application/json",
        })),
      }),
    }),
    {
      title: "User Record",
      description: "A single user record looked up by id.",
      mimeType: "application/json",
    },
    async (uri, { id }) => {
      const user = USERS[String(id)];
      if (!user) {
        throw new Error(`User "${id}" not found.`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(user, null, 2),
          },
        ],
      };
    }
  );

  // 4. A templated resource that echoes a path segment — handy for testing
  //    how clients render dynamic, parameterized URIs.
  server.registerResource(
    "greeting",
    new ResourceTemplate("greeting://{name}", { list: undefined }),
    {
      title: "Greeting",
      description: "Generates a personalized greeting for the given name.",
      mimeType: "text/plain",
    },
    async (uri, { name }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: `Hello, ${name}! Welcome to the MCP test server.`,
        },
      ],
    })
  );

  return ["config://app", "docs://about", "users://{id}", "greeting://{name}"];
}
