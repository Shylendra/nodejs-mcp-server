import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Registers demonstration prompts on the given MCP server.
 *
 * Prompts are user-controlled, reusable message templates. A client typically
 * surfaces them as slash-commands or menu items. Each prompt declares arguments
 * (a Zod schema) and returns a list of messages to seed a conversation.
 */
export function registerPrompts(server: McpServer): string[] {
  // 1. A simple, single-message prompt with one required argument.
  server.registerPrompt(
    "summarize",
    {
      title: "Summarize Text",
      description: "Produces a prompt asking the model to summarize some text.",
      argsSchema: {
        text: z.string().describe("The text to summarize"),
        style: z
          .enum(["bullet", "paragraph", "tweet"])
          .default("paragraph")
          .describe("The desired summary style"),
      },
    },
    ({ text, style }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Summarize the following text as a ${style}:\n\n${text}`,
          },
        },
      ],
    })
  );

  // 2. A multi-message prompt that sets up a system-style instruction plus the
  //    user's request — useful for role-play / persona testing.
  server.registerPrompt(
    "code_review",
    {
      title: "Code Review",
      description: "Asks the model to review a code snippet for a given language.",
      argsSchema: {
        language: z.string().describe("The programming language of the snippet"),
        code: z.string().describe("The code to review"),
      },
    },
    ({ language, code }) => ({
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: "You are a meticulous senior engineer who gives concise, actionable code review feedback.",
          },
        },
        {
          role: "user",
          content: {
            type: "text",
            text: `Please review this ${language} code for bugs, style, and clarity:\n\n\`\`\`${language}\n${code}\n\`\`\``,
          },
        },
      ],
    })
  );

  // 3. An argument-free prompt — a fixed conversation starter.
  server.registerPrompt(
    "brainstorm",
    {
      title: "Brainstorm Ideas",
      description: "Kicks off a brainstorming session on any topic.",
      argsSchema: {
        topic: z.string().describe("The topic to brainstorm about"),
        count: z
          .string()
          .default("5")
          .describe("How many ideas to ask for (as a string)"),
      },
    },
    ({ topic, count }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Brainstorm ${count} creative ideas about: ${topic}. Number each idea.`,
          },
        },
      ],
    })
  );

  return ["summarize", "code_review", "brainstorm"];
}
