import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

const MAX_LOG_BODY_CHARS = Number(process.env.MCP_LOG_BODY_LIMIT ?? 4000);
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "x-api-key",
]);
const SENSITIVE_KEYS = /(?:api[-_]?key|authorization|cookie|password|secret|token)/i;

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike | undefined };

type RequestWithBody = IncomingMessage & {
  body?: unknown;
};

interface RequestLogOptions {
  body?: unknown;
}

interface ResponseCapture {
  chunks: Buffer[];
  truncated: boolean;
  bytes: number;
  capturedBytes: number;
}

function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>): void {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      event,
      ...fields,
    })
  );
}

function redactHeader(name: string, value: string | string[] | undefined): string | string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return SENSITIVE_HEADERS.has(name.toLowerCase()) ? "[redacted]" : value;
}

function redactValue(value: unknown, seen = new WeakSet<object>()): JsonLike | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen) ?? null);
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }
    seen.add(value);

    const redacted: Record<string, JsonLike | undefined> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      redacted[key] = SENSITIVE_KEYS.test(key) ? "[redacted]" : redactValue(nestedValue, seen);
    }
    return redacted;
  }

  return String(value);
}

function limit(value: string): { value: string; truncated: boolean } {
  if (value.length <= MAX_LOG_BODY_CHARS) {
    return { value, truncated: false };
  }
  return {
    value: value.slice(0, MAX_LOG_BODY_CHARS),
    truncated: true,
  };
}

function formatBody(body: unknown): { body?: JsonLike | string; bodyTruncated?: boolean } {
  if (body === undefined) {
    return {};
  }

  const redacted = redactValue(body);
  if (typeof redacted === "string") {
    const limited = limit(redacted);
    return { body: limited.value, bodyTruncated: limited.truncated || undefined };
  }

  const serialized = JSON.stringify(redacted);
  const limited = limit(serialized);
  if (limited.truncated) {
    return { body: limited.value, bodyTruncated: true };
  }

  return { body: redacted, bodyTruncated: undefined };
}

function parseResponseBody(capture: ResponseCapture, contentTypeHeader: number | string | string[] | undefined) {
  if (capture.chunks.length === 0) {
    return {};
  }

  const contentType = Array.isArray(contentTypeHeader)
    ? contentTypeHeader.join(";")
    : String(contentTypeHeader ?? "");

  if (contentType.includes("text/event-stream")) {
    return { responseBody: "[stream]" };
  }

  const raw = Buffer.concat(capture.chunks).toString("utf8");
  const limited = limit(raw);
  if (contentType.includes("application/json")) {
    try {
      return {
        responseBody: redactValue(JSON.parse(limited.value)),
        responseBodyTruncated: capture.truncated || limited.truncated || undefined,
      };
    } catch {
      return {
        responseBody: limited.value,
        responseBodyTruncated: capture.truncated || limited.truncated || undefined,
      };
    }
  }

  return {
    responseBody: limited.value,
    responseBodyTruncated: capture.truncated || limited.truncated || undefined,
  };
}

function clientIp(req: IncomingMessage): string | undefined {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor[0]) {
    return forwardedFor[0].split(",")[0]?.trim();
  }
  return req.socket.remoteAddress;
}

function captureResponse(res: ServerResponse): ResponseCapture {
  const capture: ResponseCapture = { chunks: [], truncated: false, bytes: 0, capturedBytes: 0 };
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  function captureChunk(chunk: unknown): void {
    if (!chunk) {
      return;
    }

    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    capture.bytes += buffer.length;
    if (capture.capturedBytes >= MAX_LOG_BODY_CHARS) {
      capture.truncated = true;
      return;
    }

    const remaining = Math.max(MAX_LOG_BODY_CHARS - capture.capturedBytes, 0);
    capture.chunks.push(buffer.subarray(0, remaining));
    capture.capturedBytes += Math.min(buffer.length, remaining);
    if (buffer.length > remaining) {
      capture.truncated = true;
    }
  }

  res.write = ((chunk: unknown, ...args: unknown[]) => {
    captureChunk(chunk);
    return originalWrite(chunk as never, ...(args as []));
  }) as typeof res.write;

  res.end = ((chunk?: unknown, ...args: unknown[]) => {
    captureChunk(chunk);
    return originalEnd(chunk as never, ...(args as []));
  }) as typeof res.end;

  return capture;
}

export function logRequestStart(
  req: RequestWithBody,
  requestId: string,
  options: RequestLogOptions = {}
): void {
  log("info", "http.request", {
    requestId,
    method: req.method,
    url: req.url,
    client: {
      ip: clientIp(req),
      userAgent: req.headers["user-agent"],
      host: req.headers.host,
      origin: req.headers.origin,
      referer: req.headers.referer,
    },
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([name, value]) => [name, redactHeader(name, value)])
    ),
    ...formatBody(options.body ?? req.body),
  });
}

export function observeResponse(req: RequestWithBody, res: ServerResponse, requestId = randomUUID()): string {
  const startedAt = process.hrtime.bigint();
  const capture = captureResponse(res);

  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    log("info", "http.response", {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      bytes: capture.bytes,
      headers: Object.fromEntries(
        Object.entries(res.getHeaders()).map(([name, value]) => [name, redactHeader(name, value as string)])
      ),
      ...parseResponseBody(capture, res.getHeader("content-type")),
    });
  });

  res.once("close", () => {
    if (!res.writableEnded) {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      log("warn", "http.response_aborted", {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        bytes: capture.bytes,
      });
    }
  });

  return requestId;
}

export function logRequestError(
  req: IncomingMessage,
  requestId: string | undefined,
  err: unknown,
  message = "request handler failed"
): void {
  log("error", "http.error", {
    requestId,
    method: req.method,
    url: req.url,
    message,
    error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
  });
}
