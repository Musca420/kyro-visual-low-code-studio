#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const base = (process.env.KYRO_LIVE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const agentToken = process.env.KYRO_AGENT_TOKEN || "";
const server = new McpServer({ name: "kyro-live", version: "1.0.0" });
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
let applied = false;

async function json(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  const value = await response.json();
  if (!response.ok) throw new Error(`${value.error || "Kyro Bridge request failed"} (HTTP ${response.status})`);
  return value;
}

async function status() { return json(`${base}/api/live/status`); }
async function authorization() {
  if (!agentToken) throw new Error("Kyro agent authorization is unavailable");
  return json(`${base}/api/agent/authorization`, { headers: { authorization: `Bearer ${agentToken}` } });
}
async function tool(name, args = {}) {
  const live = await status();
  let result = await json(`${base}/api/live/tools/${name}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId: live.projectId, pageId: live.pageId, revision: live.revision, args }),
  });
  if (result.transactionId) for (let attempt = 0; attempt < 120 && result.status === "pending"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    result = await json(`${base}/api/live/transactions/${encodeURIComponent(result.transactionId)}`);
  }
  if (result.status === "pending" || result.status === "error") throw new Error(result.error || `Kyro ${name} did not complete`);
  if (result.tool === "apply_editor_transaction" && Number.isInteger(result.revision)) {
    let live = await status();
    for (let attempt = 0; attempt < 80 && Number(live.revision) <= Number(result.revision); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      live = await status();
    }
    if (Number(live.revision) <= Number(result.revision)) throw new Error("Kyro applied the transaction but did not publish the next graph revision");
    result = { ...result, finalRevision: live.revision };
  }
  return result;
}

const text = (value) => ({ content: [{ type: "text", text: JSON.stringify(value) }] });

async function applyApproved(operations) {
  const permission = await authorization();
  const approvedOperations = permission.mode === "apply" ? permission.approvedOperations : undefined;
  if (!approvedOperations) throw new Error("Kyro mutations are unavailable during planning");
  if (applied) throw new Error("The approved Kyro transaction was already applied");
  if (JSON.stringify(canonical(operations)) !== JSON.stringify(canonical(approvedOperations))) throw new Error("Codex attempted operations outside the approved plan");
  applied = true;
  return tool("apply_editor_transaction", { operations });
}

async function registerApprovedCapability(proposal) {
  const permission = await authorization();
  const approved = permission.mode === "apply" ? permission.approvedCapabilityProposal : undefined;
  if (!approved) throw new Error("No global Kyro capability proposal was approved");
  if (applied) throw new Error("The approved Kyro transaction was already applied");
  if (JSON.stringify(canonical(proposal)) !== JSON.stringify(canonical(approved))) throw new Error("Codex attempted to register a capability outside the approved proposal");
  applied = true;
  return tool("register_global_capability", proposal);
}

function previewContent(transaction, evidence = {}) {
  const result = transaction.result || {};
  const match = String(result.dataUrl || "").match(/^data:(image\/[^;]+);base64,(.+)$/s);
  if (!match) throw new Error("Kyro preview did not return an image");
  return [
    { type: "image", mimeType: match[1], data: match[2] },
    { type: "text", text: JSON.stringify({ ...evidence, width: result.width, height: result.height, previewTransactionId: transaction.id }) },
  ];
}

server.registerTool("kyro_get_context", {
  description: "Read the compact indexed slice for the current Kyro selection without scanning project files.",
  inputSchema: {},
}, async () => text(await json(`${base}/api/agent/context`)));

server.registerTool("kyro_resolve_capability", {
  description: "Read missing capabilities, requirements and alternatives. This tool never changes the project.",
  inputSchema: { request: z.string().max(4000).optional() },
}, async ({ request }) => {
  if (!agentToken) throw new Error("Kyro agent authorization is unavailable");
  return text(await json(`${base}/api/agent/capability`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${agentToken}` },
    body: JSON.stringify({ request: request || "" }),
  }));
});

server.registerTool("kyro_apply_operations", {
  description: "Apply the already approved Kyro operations as one visual transaction.",
  inputSchema: { operations: z.array(z.object({ type: z.string(), pageId: z.string().optional(), args: z.record(z.string(), z.unknown()).optional() })).min(1).max(50) },
}, async ({ operations }) => {
  return text(await applyApproved(operations));
});

server.registerTool("kyro_apply_verified_transaction", {
  description: "Apply the exact approved Kyro operations once, wait for the next graph revision, validate, and capture the visual preview as one atomic verification round.",
  inputSchema: { operations: z.array(z.object({ type: z.string(), pageId: z.string().optional(), args: z.record(z.string(), z.unknown()).optional() })).min(1).max(50) },
}, async ({ operations }) => {
  const transaction = await applyApproved(operations);
  const validation = await tool("validate_project");
  const preview = await tool("capture_preview");
  return { content: previewContent(preview, { transactionId: transaction.id, finalRevision: transaction.finalRevision, validation }) };
});

server.registerTool("kyro_register_global_capability", {
  description: "Register the exact approved capability as an inactive, versioned global Kyro draft. This never installs code or dependencies.",
  inputSchema: {
    proposal: z.object({
      scope: z.literal("global"), kind: z.enum(["reusable_flow", "typed_module", "plugin"]), name: z.string(), generalizedIntent: z.string(),
      inputs: z.array(z.string()), outputs: z.array(z.string()), permissions: z.array(z.string()), dependencies: z.array(z.string()),
      validationTests: z.array(z.string()).min(1), activation: z.enum(["passing_tests", "explicit_review"]),
    }),
  },
}, async ({ proposal }) => text(await registerApprovedCapability(proposal)));

server.registerTool("kyro_validate", {
  description: "Validate the active visual project and return actionable errors.", inputSchema: {},
}, async () => text(await tool("validate_project")));

server.registerTool("kyro_capture_preview", {
  description: "Open and capture the current Kyro preview so Codex can inspect the result visually.", inputSchema: {},
}, async () => {
  const transaction = await tool("capture_preview");
  return { content: previewContent(transaction) };
});

server.registerTool("kyro_undo", {
  description: "Undo the most recent Kyro visual transaction.", inputSchema: {},
}, async () => {
  if ((await authorization()).mode !== "apply") throw new Error("Kyro undo is unavailable during planning");
  return text(await tool("undo_last_transaction"));
});

await server.connect(new StdioServerTransport());
