# nodejs-mcp-server

A **fully featured but simple** [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server, written in TypeScript with the official [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk).

It demonstrates all three core MCP primitives - **tools**, **resources**, and **prompts** - with **no authentication**, so you can point any MCP client at it and start testing immediately.

It supports two transports out of the box:

- **stdio** - for desktop clients (Claude Desktop, MCP Inspector launching a subprocess).
- **Streamable HTTP** - for HTTP-based clients, with session management.

---

## What's inside

### Tools (model-controlled actions)

| Tool | Description |
| --- | --- |
| `echo` | Echoes text back - a connectivity check. |
| `calculate` | `add` / `subtract` / `multiply` / `divide` on two numbers (with divide-by-zero handling). |
| `current_time` | Current server time in any IANA timezone. Returns **structured output**. |
| `random_number` | Random integer in an inclusive `[min, max]` range. |
| `summarize_list` | Count / sum / min / max / mean of a list of numbers. Returns **structured output**. |

### Resources (application-controlled, read-only data)

| URI | Description |
| --- | --- |
| `config://app` | Static JSON server config and feature flags. |
| `docs://about` | Static Markdown "about" document. |
| `users://{id}` | Templated resource backed by an in-memory store (ids `1`-`3`), with **listing**. |
| `greeting://{name}` | Templated resource returning a personalized greeting. |

### Prompts (user-controlled message templates)

| Prompt | Arguments | Description |
| --- | --- | --- |
| `summarize` | `text`, `style` | Ask the model to summarize text as a bullet list / paragraph / tweet. |
| `code_review` | `language`, `code` | Multi-message prompt asking for a code review. |
| `brainstorm` | `topic`, `count` | Kick off a brainstorming session. |

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Build the TypeScript
npm run build

# 3a. Run over stdio (default)
npm start

# 3b. ...or run over Streamable HTTP
npm run start:http
```

> **Requires Node.js >= 18.**

### Development (no build step, auto-reload)

```bash
npm run dev:stdio   # stdio transport with tsx watch
npm run dev:http    # HTTP transport with tsx watch
```

---

## Testing

Run the local smoke test to build the server, start it over stdio, and verify the expected tools, resources, resource templates, prompts, and a couple of basic calls:

```bash
npm run test:smoke
```

### Testing with the MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is the easiest way to poke at the server:

```bash
# Launches the Inspector and this server (stdio) together
npm run inspect
```

For the **HTTP** transport, start the server (`npm run start:http`) then open the Inspector and connect with:

- **Transport type:** `Streamable HTTP`
- **URL:** `http://127.0.0.1:3000/mcp`

---

## Using it with Claude Desktop

Add this to your `claude_desktop_config.json` (use the **absolute** path to `dist/stdio.js`):

```json
{
  "mcpServers": {
    "nodejs-mcp-server": {
      "command": "node",
      "args": ["C:\\Users\\Shylendra\\git\\nodejs-mcp-server\\dist\\stdio.js"]
    }
  }
}
```

Restart Claude Desktop, and the server's tools, resources, and prompts will appear.

---

## HTTP transport details

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/mcp` | JSON-RPC requests (`initialize` + all subsequent calls). |
| `GET` | `/mcp` | Server-Sent Events stream for server-to-client notifications. |
| `DELETE` | `/mcp` | Terminate a session. |
| `GET` | `/health` | Plain health check (not part of MCP). |

Sessions are tracked via the `Mcp-Session-Id` response/request header. The HTTP server binds to `127.0.0.1` by default, and the port defaults to **3000**. Both can be overridden:

```bash
PORT=3100 npm run start:http                 # macOS / Linux
HOST=0.0.0.0 PORT=3100 npm run start:http    # macOS / Linux, public interface
$env:PORT=3100; npm run start:http           # Windows PowerShell
$env:HOST="0.0.0.0"; npm run start:http      # Windows PowerShell, public interface
```

> **No authentication is applied.** Binding to `0.0.0.0` or `::` will print a warning and should only be used behind trusted network controls.

### Example: raw HTTP handshake with `curl`

```bash
curl -i -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}'
```

The response includes an `Mcp-Session-Id` header - pass it back as a request header on subsequent calls.

---

## Project layout

```text
src/
|-- server.ts      # Builds the McpServer and registers everything
|-- tools.ts       # Tool definitions
|-- resources.ts   # Static + templated resource definitions
|-- prompts.ts     # Prompt definitions
|-- stdio.ts       # stdio transport entry point
`-- http.ts        # Streamable HTTP transport entry point
```

To add your own capability, edit the matching `register*` function in `tools.ts`, `resources.ts`, or `prompts.ts` - they each receive the `McpServer` instance and call `server.registerTool` / `registerResource` / `registerPrompt`.

---

## Notes

- **No authentication.** This server is intended for local testing and learning only - do not expose it to untrusted networks.
- When using stdio, **never** write to `stdout` - it is reserved for the JSON-RPC protocol. Diagnostics go to `stderr` (`console.error`).

## License

MIT
