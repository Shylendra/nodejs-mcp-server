import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Registers a set of demonstration tools on the given MCP server.
 *
 * Tools are model-controlled actions the client (an LLM) can invoke. Each tool
 * declares a Zod input schema; the SDK validates arguments before your handler
 * runs and exposes the schema to clients as JSON Schema.
 */
export function registerTools(server: McpServer): string[] {
  // 1. A trivial echo tool — the "hello world" of MCP.
  server.registerTool(
    "echo",
    {
      title: "Echo",
      description: "Echoes back the text you send. Useful as a connectivity check.",
      inputSchema: {
        text: z.string().describe("The text to echo back"),
      },
    },
    async ({ text }) => ({
      content: [{ type: "text", text }],
    })
  );

  // 2. A calculator demonstrating numeric input, enums, and error handling.
  server.registerTool(
    "calculate",
    {
      title: "Calculator",
      description: "Performs a basic arithmetic operation on two numbers.",
      inputSchema: {
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe("The arithmetic operation to perform"),
        a: z.number().describe("The first operand"),
        b: z.number().describe("The second operand"),
      },
    },
    async ({ operation, a, b }) => {
      let result: number;
      switch (operation) {
        case "add":
          result = a + b;
          break;
        case "subtract":
          result = a - b;
          break;
        case "multiply":
          result = a * b;
          break;
        case "divide":
          if (b === 0) {
            // Tools report failures by returning isError, not by throwing —
            // this lets the model see and recover from the error.
            return {
              isError: true,
              content: [{ type: "text", text: "Error: division by zero is undefined." }],
            };
          }
          result = a / b;
          break;
      }
      return {
        content: [{ type: "text", text: `${a} ${operation} ${b} = ${result}` }],
      };
    }
  );

  // 3. A tool that returns structured content alongside a text summary.
  server.registerTool(
    "current_time",
    {
      title: "Current Time",
      description: "Returns the current server time in the requested timezone.",
      inputSchema: {
        timezone: z
          .string()
          .default("UTC")
          .describe("An IANA timezone name, e.g. 'America/New_York'. Defaults to UTC."),
      },
      outputSchema: {
        iso: z.string().describe("ISO 8601 timestamp"),
        timezone: z.string(),
        formatted: z.string(),
      },
    },
    async ({ timezone }) => {
      const now = new Date();
      let formatted: string;
      try {
        formatted = new Intl.DateTimeFormat("en-US", {
          dateStyle: "full",
          timeStyle: "long",
          timeZone: timezone,
        }).format(now);
      } catch {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: unknown timezone "${timezone}".` }],
        };
      }
      const structuredContent = {
        iso: now.toISOString(),
        timezone,
        formatted,
      };
      return {
        structuredContent,
        content: [{ type: "text", text: formatted }],
      };
    }
  );

  // 4. A random-number generator showing constrained numeric inputs.
  server.registerTool(
    "random_number",
    {
      title: "Random Number",
      description: "Generates a random integer in an inclusive range.",
      inputSchema: {
        min: z.number().int().default(0).describe("Inclusive lower bound"),
        max: z.number().int().default(100).describe("Inclusive upper bound"),
      },
    },
    async ({ min, max }) => {
      if (min > max) {
        return {
          isError: true,
          content: [{ type: "text", text: "Error: min must be <= max." }],
        };
      }
      const value = Math.floor(Math.random() * (max - min + 1)) + min;
      return { content: [{ type: "text", text: String(value) }] };
    }
  );

  // 5. A tool that fans out to multiple content blocks (text list).
  server.registerTool(
    "summarize_list",
    {
      title: "Summarize List",
      description: "Counts items and reports basic statistics about a list of numbers.",
      inputSchema: {
        numbers: z.array(z.number()).min(1).describe("A non-empty list of numbers"),
      },
      outputSchema: {
        count: z.number(),
        sum: z.number(),
        min: z.number(),
        max: z.number(),
        mean: z.number(),
      },
    },
    async ({ numbers }) => {
      const sum = numbers.reduce((acc, n) => acc + n, 0);
      const stats = {
        count: numbers.length,
        sum,
        min: Math.min(...numbers),
        max: Math.max(...numbers),
        mean: sum / numbers.length,
      };
      return {
        structuredContent: stats,
        content: [
          {
            type: "text",
            text: `count=${stats.count} sum=${stats.sum} min=${stats.min} max=${stats.max} mean=${stats.mean}`,
          },
        ],
      };
    }
  );

  return ["echo", "calculate", "current_time", "random_number", "summarize_list"];
}
