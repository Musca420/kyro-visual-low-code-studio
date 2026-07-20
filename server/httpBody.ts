import type { IncomingMessage } from "node:http";

export const MAX_JSON_BODY_BYTES = 20_000_000;

export async function readJsonBody(request: IncomingMessage, maxBytes = MAX_JSON_BODY_BYTES) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    size += chunk.length;
    if (size > maxBytes) throw new Error(`Request is too large (maximum ${maxBytes} bytes)`);
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
}
