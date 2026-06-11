import { hostname } from "node:os";
import type { ServerCatalog } from "./server.js";

/** ANSI helpers (no dependency). Disabled automatically when not a TTY. */
const useColor = process.stderr.isTTY;
const c = (code: string, s: string) => (useColor ? `[${code}m${s}[0m` : s);
const bold = (s: string) => c("1", s);
const dim = (s: string) => c("2", s);
const cyan = (s: string) => c("36", s);
const green = (s: string) => c("32", s);

function section(title: string, items: string[]): string {
  const header = `${bold(title)} ${dim(`(${items.length})`)}`;
  const lines = items.map((i) => `    ${green("•")} ${i}`);
  return [`  ${header}`, ...lines].join("\n");
}

/**
 * Prints a detailed, human-readable startup banner to stderr.
 *
 * stderr is used deliberately: for the stdio transport, stdout is reserved for
 * the JSON-RPC protocol and must never carry log output.
 *
 * @param catalog   What the server registered (name, version, inventory).
 * @param transport How the server is reachable — describes the connection.
 */
export function printBanner(
  catalog: ServerCatalog,
  transport:
    | { kind: "stdio" }
    | { kind: "http"; host: string; port: number; mcpUrl: string; healthUrl: string }
): void {
  const { name, version, tools, resources, prompts } = catalog;

  const lines: string[] = [];
  lines.push("");
  lines.push(cyan("┌─────────────────────────────────────────────────────────┐"));
  lines.push(cyan("│") + bold("  Model Context Protocol server is running              ") + cyan("│"));
  lines.push(cyan("└─────────────────────────────────────────────────────────┘"));
  lines.push("");
  lines.push(`  ${bold("Server")}      ${name} ${dim("v" + version)}`);
  lines.push(`  ${bold("Host")}        ${hostname()}`);
  lines.push(`  ${bold("PID")}         ${process.pid}`);
  lines.push(`  ${bold("Node")}        ${process.version}`);
  lines.push(`  ${bold("Auth")}        ${dim("none (test server — do not expose publicly)")}`);
  lines.push("");

  if (transport.kind === "stdio") {
    lines.push(`  ${bold("Transport")}   stdio ${dim("(JSON-RPC over stdin/stdout)")}`);
    lines.push(`  ${dim("Connect by launching this process from an MCP client,")}`);
    lines.push(`  ${dim("e.g. Claude Desktop or: npx @modelcontextprotocol/inspector node dist/stdio.js")}`);
  } else {
    lines.push(`  ${bold("Transport")}   Streamable HTTP`);
    lines.push(`  ${bold("Endpoint")}    ${cyan(transport.mcpUrl)}  ${dim("(POST / GET / DELETE)")}`);
    lines.push(`  ${bold("Health")}      ${cyan(transport.healthUrl)}  ${dim("(GET)")}`);
    lines.push(`  ${bold("Listening")}   host ${transport.host}  ·  port ${transport.port}`);
    lines.push("");
    lines.push(`  ${dim("Inspector: transport \"Streamable HTTP\", URL " + transport.mcpUrl)}`);
    lines.push(`  ${dim("Quick check: curl " + transport.healthUrl)}`);
  }

  lines.push("");
  lines.push(`  ${bold("Capabilities")}`);
  lines.push(section("Tools", tools));
  lines.push(section("Resources", resources));
  lines.push(section("Prompts", prompts));
  lines.push("");
  lines.push(dim("  Press Ctrl+C to stop."));
  lines.push("");

  process.stderr.write(lines.join("\n") + "\n");
}
