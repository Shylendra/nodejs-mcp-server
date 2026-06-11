import mcpHandler from "../api/mcp.ts";
import healthHandler from "../api/health.ts";

async function rpc(method: string, params?: unknown): Promise<unknown> {
  const response = await mcpHandler.fetch(
    new Request("https://example.test/api/mcp", {
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
    })
  );

  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(`${method} failed: ${JSON.stringify(body)}`);
  }
  return body.result;
}

const health = await healthHandler.fetch();
if (!health.ok) {
  throw new Error(`health check failed with status ${health.status}`);
}

await rpc("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "vercel-smoke", version: "1.0.0" },
});

const toolsResult = (await rpc("tools/list")) as { tools?: Array<{ name: string }> };
const toolNames = toolsResult.tools?.map((tool) => tool.name) ?? [];
for (const expected of ["echo", "calculate", "current_time", "random_number", "summarize_list"]) {
  if (!toolNames.includes(expected)) {
    throw new Error(`tools/list missing ${expected}; found ${toolNames.join(", ")}`);
  }
}

const promptsResult = (await rpc("prompts/list")) as { prompts?: Array<{ name: string }> };
const promptNames = promptsResult.prompts?.map((prompt) => prompt.name) ?? [];
for (const expected of ["summarize", "code_review", "brainstorm"]) {
  if (!promptNames.includes(expected)) {
    throw new Error(`prompts/list missing ${expected}; found ${promptNames.join(", ")}`);
  }
}

const resourcesResult = (await rpc("resources/list")) as { resources?: Array<{ uri: string }> };
const resourceUris = resourcesResult.resources?.map((resource) => resource.uri) ?? [];
for (const expected of ["config://app", "docs://about", "users://1"]) {
  if (!resourceUris.includes(expected)) {
    throw new Error(`resources/list missing ${expected}; found ${resourceUris.join(", ")}`);
  }
}

console.log("Vercel smoke test passed.");
