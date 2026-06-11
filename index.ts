import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import healthHandler from "./api/health.js";
import mcpHandler from "./api/mcp.js";

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/api/mcp" || url.pathname === "/mcp") {
    await mcpHandler(req, res);
    return;
  }

  if (url.pathname === "/api/health" || url.pathname === "/health") {
    healthHandler(req, res);
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("nodejs-mcp-server\n\nMCP endpoint: /api/mcp\nHealth endpoint: /api/health\n");
}

const isMain = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;

if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  createServer(handleRequest).listen(port, () => {
    console.error(`nodejs-mcp-server listening on http://127.0.0.1:${port}`);
  });
}
