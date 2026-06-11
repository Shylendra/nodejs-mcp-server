#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { printBanner } from "./banner.js";

/**
 * Entry point for the stdio transport.
 *
 * The server speaks JSON-RPC over stdin/stdout. This is the transport used by
 * desktop clients such as Claude Desktop and the MCP Inspector when launching
 * the server as a subprocess.
 *
 * IMPORTANT: never write logs to stdout here — it is reserved for the protocol.
 * Use stderr (console.error) for any diagnostics.
 */
async function main(): Promise<void> {
  const { server, catalog } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  printBanner(catalog, { kind: "stdio" });
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
