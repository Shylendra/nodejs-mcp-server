#!/usr/bin/env node
import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "./server.js";
import { printBanner } from "./banner.js";

/**
 * Entry point for the Streamable HTTP transport.
 *
 * Exposes the MCP server over HTTP at `POST/GET/DELETE /mcp`, with session
 * management via the `Mcp-Session-Id` header. No authentication is applied —
 * this is intended for local testing only.
 *
 * Try it with the MCP Inspector (Transport: "Streamable HTTP",
 * URL: http://localhost:3000/mcp) or any MCP HTTP client.
 */
const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.use(express.json());

// Track a transport per active session id so follow-up requests reuse state.
const transports: Record<string, StreamableHTTPServerTransport> = {};

// Handle JSON-RPC requests (initialize + all subsequent calls).
app.post("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    // Reuse the transport for an established session.
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New initialization request — create a fresh server + transport.
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports[id] = transport;
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
    };

    const { server } = createServer();
    await server.connect(transport);
  } else {
    // Invalid: no session id and not an initialize request.
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: no valid session ID provided" },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

// Reusable handler for the GET (server-sent events) and DELETE (teardown) verbs.
async function handleSessionRequest(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
}

// GET opens the SSE stream the server uses to push notifications.
app.get("/mcp", handleSessionRequest);

// DELETE terminates a session.
app.delete("/mcp", handleSessionRequest);

// A plain health-check endpoint (not part of MCP).
app.get("/health", (_req, res) => {
  res.json({ status: "ok", sessions: Object.keys(transports).length });
});

const HOST = process.env.HOST ?? "localhost";

const httpServer = app.listen(PORT, () => {
  // Build a server once just to obtain the capability inventory for the banner.
  const { catalog } = createServer();
  printBanner(catalog, {
    kind: "http",
    host: HOST,
    port: PORT,
    mcpUrl: `http://${HOST}:${PORT}/mcp`,
    healthUrl: `http://${HOST}:${PORT}/health`,
  });
});

// Without this handler a port conflict prints a raw stack trace and no banner —
// surface a clear, actionable message instead.
httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n  ✖ Cannot start: port ${PORT} is already in use.\n` +
        `    Another process is listening on http://${HOST}:${PORT}.\n` +
        `    Start on a different port, e.g.:\n` +
        `      PORT=3100 npm run start:http          (macOS / Linux)\n` +
        `      $env:PORT=3100; npm run start:http    (Windows PowerShell)\n`
    );
  } else {
    console.error("\n  ✖ Failed to start HTTP server:", err.message, "\n");
  }
  process.exit(1);
});
