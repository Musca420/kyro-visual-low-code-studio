import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const children: ReturnType<typeof spawn>[] = [];

afterEach(() => {
  for (const child of children.splice(0)) child.kill();
});

function request(child: ReturnType<typeof spawn>, message: object) {
  child.stdin!.write(`${JSON.stringify(message)}\n`);
}

function response(child: ReturnType<typeof spawn>, id: number) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => reject(new Error(`MCP response ${id} timed out`)), 5_000);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const value = JSON.parse(line) as Record<string, unknown>;
        if (value.id === id) {
          clearTimeout(timeout);
          child.stdout!.off("data", onData);
          resolve(value);
        }
      }
    };
    child.stdout!.on("data", onData);
  });
}

async function connect() {
  const script = resolve(process.cwd(), "server/kyroMcp.mjs");
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, KYRO_LIVE_URL: "http://127.0.0.1:1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  children.push(child);
  request(child, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
  const initialized = await response(child, 1);
  expect(initialized.error).toBeUndefined();
  request(child, { jsonrpc: "2.0", method: "notifications/initialized" });
  return child;
}

describe("Kyro live MCP", () => {
  it("publishes the compact agent tool surface", async () => {
    const child = await connect();
    request(child, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const listed = await response(child, 2);
    const names = ((listed.result as { tools: { name: string }[] }).tools).map((tool) => tool.name);
    expect(names).toEqual([
      "kyro_get_context",
      "kyro_resolve_capability",
      "kyro_apply_operations",
      "kyro_apply_verified_transaction",
      "kyro_register_global_capability",
      "kyro_validate",
      "kyro_capture_preview",
      "kyro_undo",
    ]);
  });

  it("rejects visual mutations without a live job authorization", async () => {
    const child = await connect();
    request(child, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "kyro_apply_operations", arguments: { operations: [{ type: "set_component_text", args: { text: "No" } }] } },
    });
    const called = await response(child, 3);
    const result = called.result as { isError?: boolean; content?: { text?: string }[] };
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toMatch(/agent authorization is unavailable/i);
  });
});
