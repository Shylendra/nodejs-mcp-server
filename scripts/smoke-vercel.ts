import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { handleRequest } from "../index.js";

const server = createServer(handleRequest);

function listen(): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
}

function close(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function rpc(baseUrl: string, method: string, params?: unknown): Promise<unknown> {
  const response = await fetch(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers: {
      "Accept": "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(`${method} failed: ${JSON.stringify(body)}`);
  }
  return body.result;
}

const port = await listen();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const health = await fetch(`${baseUrl}/api/health`);
  if (!health.ok) {
    throw new Error(`health check failed with status ${health.status}`);
  }

  await rpc(baseUrl, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "vercel-smoke", version: "1.0.0" },
  });

  const toolsResult = (await rpc(baseUrl, "tools/list")) as { tools?: Array<{ name: string }> };
  const toolNames = toolsResult.tools?.map((tool) => tool.name) ?? [];
  for (const expected of ["echo", "calculate", "current_time", "random_number", "summarize_list"]) {
    if (!toolNames.includes(expected)) {
      throw new Error(`tools/list missing ${expected}; found ${toolNames.join(", ")}`);
    }
  }

  const promptsResult = (await rpc(baseUrl, "prompts/list")) as { prompts?: Array<{ name: string }> };
  const promptNames = promptsResult.prompts?.map((prompt) => prompt.name) ?? [];
  for (const expected of ["summarize", "code_review", "brainstorm"]) {
    if (!promptNames.includes(expected)) {
      throw new Error(`prompts/list missing ${expected}; found ${promptNames.join(", ")}`);
    }
  }

  const resourcesResult = (await rpc(baseUrl, "resources/list")) as { resources?: Array<{ uri: string }> };
  const resourceUris = resourcesResult.resources?.map((resource) => resource.uri) ?? [];
  for (const expected of ["config://app", "docs://about", "users://1"]) {
    if (!resourceUris.includes(expected)) {
      throw new Error(`resources/list missing ${expected}; found ${resourceUris.join(", ")}`);
    }
  }

  console.log("Vercel smoke test passed.");
} finally {
  await close();
}
