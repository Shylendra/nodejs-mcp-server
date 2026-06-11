import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "../src/server.js";

const allowedMethods = new Set(["GET", "POST", "DELETE", "OPTIONS"]);

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": process.env.MCP_CORS_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
  };
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }
  headers.set("Cache-Control", "no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return withCors(
    Response.json(body, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    })
  );
}

async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (!allowedMethods.has(request.method)) {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const { server } = createServer();

  try {
    await server.connect(transport);
    return withCors(await transport.handleRequest(request));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected MCP handler error";
    console.error("MCP handler failed:", err);
    return jsonResponse(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message },
        id: null,
      },
      { status: 500 }
    );
  }
}

export default {
  fetch: handleMcpRequest,
};
