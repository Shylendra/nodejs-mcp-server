import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const expectedTools = ["echo", "calculate", "current_time", "random_number", "summarize_list"];
const expectedPrompts = ["summarize", "code_review", "brainstorm"];
const expectedResources = ["config://app", "docs://about", "users://1", "users://2", "users://3"];
const expectedTemplates = ["users://{id}", "greeting://{name}"];

function assertIncludes(actual, expected, label) {
  const missing = expected.filter((item) => !actual.includes(item));
  if (missing.length > 0) {
    throw new Error(`${label} missing: ${missing.join(", ")}. Found: ${actual.join(", ")}`);
  }
}

const client = new Client({ name: "nodejs-mcp-server-smoke", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/stdio.js"],
  cwd: process.cwd(),
  stderr: "pipe",
});

let stderr = "";
transport.stderr?.on("data", (chunk) => {
  stderr += chunk.toString();
});

try {
  await client.connect(transport);

  const [{ tools }, { resources }, { resourceTemplates }, { prompts }] = await Promise.all([
    client.listTools(),
    client.listResources(),
    client.listResourceTemplates(),
    client.listPrompts(),
  ]);

  assertIncludes(
    tools.map((tool) => tool.name),
    expectedTools,
    "tools"
  );
  assertIncludes(
    resources.map((resource) => resource.uri),
    expectedResources,
    "resources"
  );
  assertIncludes(
    resourceTemplates.map((template) => template.uriTemplate),
    expectedTemplates,
    "resource templates"
  );
  assertIncludes(
    prompts.map((prompt) => prompt.name),
    expectedPrompts,
    "prompts"
  );

  const echo = await client.callTool({ name: "echo", arguments: { text: "smoke-ok" } });
  if (echo.content?.[0]?.type !== "text" || echo.content[0].text !== "smoke-ok") {
    throw new Error("echo tool did not return the expected text");
  }

  const config = await client.readResource({ uri: "config://app" });
  const configText = config.contents?.[0]?.text;
  if (!configText || !JSON.parse(configText).features.tools) {
    throw new Error("config://app did not return the expected JSON payload");
  }

  console.log("Smoke test passed.");
} catch (err) {
  if (stderr.trim()) {
    console.error("Server stderr:");
    console.error(stderr.trim());
  }
  throw err;
} finally {
  await client.close();
}
