import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../src/server.js";

type VercelRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
};

const allowedMethods = new Set(["GET", "POST", "DELETE", "OPTIONS"]);

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", process.env.MCP_CORS_ORIGIN ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Cache-Control", "no-store");
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  if (!res.headersSent) {
    setCorsHeaders(res);
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
  }
  res.end(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: ServerResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!req.method || !allowedMethods.has(req.method)) {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const { server } = createServer();

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected MCP handler error";
    console.error("MCP handler failed:", err);

    if (!res.headersSent) {
      sendJson(
        res,
        500,
        {
          jsonrpc: "2.0",
          error: { code: -32603, message },
          id: null,
        }
      );
      return;
    }

    if (!res.writableEnded) {
      res.end();
    }
  }
}
