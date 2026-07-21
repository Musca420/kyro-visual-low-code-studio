import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";

const children: ReturnType<typeof spawn>[] = [];
const servers: Server[] = [];

afterEach(() => {
  for (const child of children.splice(0)) child.kill();
  for (const server of servers.splice(0)) server.close();
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

async function connect(liveUrl = "http://127.0.0.1:1", token = "") {
  const script = resolve(process.cwd(), "server/kyroMcp.mjs");
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, KYRO_LIVE_URL: liveUrl, KYRO_AGENT_TOKEN: token },
    stdio: ["pipe", "pipe", "pipe"],
  });
  children.push(child);
  request(child, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
  const initialized = await response(child, 1);
  expect(initialized.error).toBeUndefined();
  request(child, { jsonrpc: "2.0", method: "notifications/initialized" });
  return child;
}

async function bridge(options: { projectId?: string; statusProjectId?: string; expired?: boolean; approvedCapabilityProposal?: Record<string, unknown> } = {}) {
  const projectId = options.projectId ?? "project-a", audits: Record<string, unknown>[] = [], registrations: Record<string, unknown>[] = [], statusQueries: string[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const send = (status: number, value: unknown) => { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(value)); };
    if (url.pathname === "/api/live/status") { statusQueries.push(url.search); return send(200, { projectId: options.statusProjectId ?? projectId, pageId: "home", revision: 3 }); }
    if (request.headers.authorization !== "Bearer test-token") return send(401, { error: "bad token" });
    if (url.pathname === "/api/agent/authorization") return send(200, {
      jobId: "job-1", projectId, clientId: "client-1", revision: 3, deadlineAt: new Date(Date.now() + (options.expired ? -1_000 : 60_000)).toISOString(),
      mode: options.approvedCapabilityProposal ? "apply" : "plan",
      ...(options.approvedCapabilityProposal ? { approvedCapabilityProposal: options.approvedCapabilityProposal } : {}),
    });
    if (url.pathname === "/api/agent/context") return send(200, { project: { id: projectId, revision: 3 }, contextBytes: 64 });
    if (url.pathname === "/api/agent/operations") return send(200, { version: 1, operations: [{ name: "add_component", description: "Add component", args: { type: "object" }, limitations: [], effects: ["ui"], permissions: ["graph:write"], platforms: ["web"], support: "stable" }] });
    if (url.pathname === "/api/agent/capability") return send(200, { status: "supported", supportedRequirements: [{ kind: "operation", id: "add_component" }], selectedOperations: ["add_component"] });
    if (url.pathname === "/api/live/tools/get_build_preflight") return send(200, { target: "web", revision: 3, blockers: [] });
    if (url.pathname === "/api/live/tools/register_global_capability") {
      let body = ""; request.on("data", (chunk) => body += chunk); request.on("end", () => { registrations.push(JSON.parse(body)); send(202, { id: "capability-command", status: "applied", result: { state: "draft", version: "0.1.0" } }); }); return;
    }
    if (url.pathname === "/api/agent/mcp-audit") {
      let body = ""; request.on("data", (chunk) => body += chunk); request.on("end", () => { audits.push(JSON.parse(body)); send(200, { ok: true }); }); return;
    }
    return send(404, { error: "missing route" });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test bridge did not start");
  return { url: `http://127.0.0.1:${address.port}`, audits, registrations, statusQueries };
}

async function call(child: ReturnType<typeof spawn>, id: number, name: string, args: object = {}) {
  request(child, { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
  return response(child, id);
}

describe("Kyro live MCP", () => {
  it("publishes the compact agent tool surface", async () => {
    const child = await connect();
    request(child, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const listed = await response(child, 2);
    const tools = (listed.result as { tools: { name: string; _meta?: Record<string, unknown> }[] }).tools;
    const names = tools.map((tool) => tool.name);
    expect(names).toEqual([
      "kyro_describe_tools",
      "kyro_get_context",
      "kyro_plan",
      "kyro_resolve_capability",
      "kyro_apply_operations",
      "kyro_apply_verified_transaction",
      "kyro_register_global_capability",
      "kyro_validate",
      "kyro_verify",
      "kyro_build_preflight",
      "kyro_capture_preview",
      "kyro_undo",
    ]);
    expect(tools.every((tool) => {
      const access = tool._meta?.["kyro/access"] as { shell?: boolean; network?: string } | undefined;
      return tool._meta?.["kyro/contractVersion"] === 1
        && typeof tool._meta?.["kyro/output"] === "string"
        && access?.shell === false && access.network === "loopback";
    })).toBe(true);
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

  it("audits typed planning and rejects wrong scope, expired authorization, and operation excess", async () => {
    const active = await bridge(), child = await connect(active.url, "test-token");
    const described = await call(child, 10, "kyro_describe_tools");
    const describedText = ((described.result as { content: { text: string }[] }).content[0].text);
    expect(describedText).toContain('"description":"Add component"');
    expect(describedText).toContain('"platforms":["web"]');
    const planned = await call(child, 4, "kyro_plan", { request: "description only", requirements: [{ kind: "operation", id: "add_component" }], targetPlatforms: ["web"] });
    expect((planned.result as { isError?: boolean }).isError).not.toBe(true);
    const discovery = await call(child, 11, "kyro_plan", { request: "discover typed IDs", requirements: [], targetPlatforms: ["web"] });
    expect((discovery.result as { isError?: boolean }).isError).not.toBe(true);
    expect(active.statusQueries).toContain("?projectId=project-a&clientId=client-1");
    expect(active.audits).toEqual([
      { tool: "kyro_describe_tools", result: "allowed", detail: "started" },
      { tool: "kyro_describe_tools", result: "allowed", detail: "completed" },
      { tool: "kyro_plan", result: "allowed", detail: "started" },
      { tool: "kyro_plan", result: "allowed", detail: "completed" },
      { tool: "kyro_plan", result: "allowed", detail: "started" },
      { tool: "kyro_plan", result: "allowed", detail: "completed" },
    ]);
    const preflight = await call(child, 8, "kyro_build_preflight");
    expect((preflight.result as { isError?: boolean }).isError).not.toBe(true);

    const wrong = await bridge({ statusProjectId: "project-b" }), wrongChild = await connect(wrong.url, "test-token");
    expect((await call(wrongChild, 5, "kyro_get_context")).result).toMatchObject({ isError: true });
    const expired = await bridge({ expired: true }), expiredChild = await connect(expired.url, "test-token");
    expect((await call(expiredChild, 6, "kyro_get_context")).result).toMatchObject({ isError: true });

    const operations = Array.from({ length: 51 }, (_, index) => ({ type: "set_project_property", args: { property: "name", value: String(index) } }));
    expect((await call(child, 7, "kyro_apply_operations", { operations })).result).toMatchObject({ isError: true });
    expect(active.audits).toEqual([
      { tool: "kyro_describe_tools", result: "allowed", detail: "started" },
      { tool: "kyro_describe_tools", result: "allowed", detail: "completed" },
      { tool: "kyro_plan", result: "allowed", detail: "started" },
      { tool: "kyro_plan", result: "allowed", detail: "completed" },
      { tool: "kyro_plan", result: "allowed", detail: "started" },
      { tool: "kyro_plan", result: "allowed", detail: "completed" },
      { tool: "kyro_build_preflight", result: "allowed", detail: "started" },
      { tool: "kyro_build_preflight", result: "allowed", detail: "completed" },
    ]);
  });

  it("registers only the exact approved versioned capability proposal", async () => {
    const proposal = { scope: "global", kind: "typed_module", name: "Normalize contact data", generalizedIntent: "Normalize contacts in every Kyro project", inputs: ["contact"], outputs: ["normalized contact"], permissions: [], dependencies: [], validationTests: ["Normalizes whitespace"], activation: "passing_tests", effects: [], platforms: ["web"] };
    const active = await bridge({ approvedCapabilityProposal: proposal }), child = await connect(active.url, "test-token");
    const called = await call(child, 9, "kyro_register_global_capability", { proposal: Object.fromEntries(Object.entries(proposal).filter(([key]) => !["effects", "platforms"].includes(key))) });
    expect((called.result as { isError?: boolean }).isError).not.toBe(true);
    expect(active.registrations).toHaveLength(1);
    expect(active.registrations[0]).toMatchObject({ args: { effects: [], platforms: ["web"] } });
  });
});
