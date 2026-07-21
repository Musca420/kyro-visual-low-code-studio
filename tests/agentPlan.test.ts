import { describe, expect, it } from "vitest";
import { agentPlanJsonSchema, parseAgentPlan } from "../src/agentPlan";
import { operationCatalog, operationNames, validateOperationArguments } from "../src/agentRegistry";

const plan = (operations: unknown[], overrides: Record<string, unknown> = {}) => ({
  summary: "Change the project", skill: "kyro-design",
  requirements: (operations as { type: string }[]).map((operation) => ({ kind: "operation", id: operation.type })),
  targetPlatforms: ["web"], operations, checks: ["Preview renders"], confirmations: [], alreadySatisfied: false, capabilityProposal: null, ...overrides,
});

describe("structured Codex plan", () => {
  it("derives the output schema from the operation registry and rejects invented tools", () => {
    expect(JSON.stringify(agentPlanJsonSchema)).toContain("set_component_property");
    expect(parseAgentPlan(JSON.stringify(plan([{ type: "set_component_property", pageId: null, args: { componentId: "title", property: "name", value: "Hero" } }])))).toBeTruthy();
    expect(parseAgentPlan(JSON.stringify(plan([{ type: "edit_everything", pageId: null, args: {} }])))).toBeUndefined();
  });

  it("requires typed requirements and target platforms", () => {
    const operation = { type: "set_theme_token", pageId: null, args: { token: "accent", value: "#0ff" } };
    expect(parseAgentPlan(JSON.stringify(plan([operation], { requirements: [] })))).toBeUndefined();
    expect(parseAgentPlan(JSON.stringify(plan([operation], { targetPlatforms: [] })))).toBeUndefined();
    expect(parseAgentPlan(JSON.stringify(plan([operation], { requirements: [{ kind: "effect", id: "ui" }] })))).toBeUndefined();
  });

  it("keeps legacy argsJson as read-only compatibility", () => {
    const legacy = { summary: "Rename", skill: "kyro-design", operations: [{ type: "set_component_property", pageId: null, argsJson: JSON.stringify({ componentId: "title", property: "name", value: "Hero" }) }], checks: [], confirmations: [], alreadySatisfied: false, capabilityProposal: null };
    expect(parseAgentPlan(JSON.stringify(legacy))?.operations[0].args).toMatchObject({ componentId: "title" });
  });

  it("normalizes harmless planner metadata without weakening typed operations", () => {
    const generated = { summary: "Rename", requirements: [{ kind: "operation", id: "set_component_property" }], targetPlatforms: ["web"], operations: [{ type: "set_component_property", pageId: "home", args: { componentId: "title", property: "label", value: "Build clearly." } }], observableCriteria: ["Heading changes"], alreadySatisfied: false, capabilityProposal: null };
    expect(parseAgentPlan(JSON.stringify(generated))).toMatchObject({ skill: "kyro-live-context", checks: ["Heading changes"], confirmations: [] });
    expect(parseAgentPlan(JSON.stringify({ ...generated, skill: ["kyro-live-context", "kyro-design"] }))).toMatchObject({ skill: "kyro-live-context + kyro-design" });
  });

  it("accepts an evidence-backed no-op without inventing a requirement", () => {
    expect(parseAgentPlan(JSON.stringify(plan([], { requirements: [], alreadySatisfied: true })))).toMatchObject({ operations: [], requirements: [], alreadySatisfied: true });
  });

  it("normalizes confirmation messages without weakening a capability proposal", () => {
    const proposal = { scope: "global", kind: "typed_module", name: "Export document", generalizedIntent: "Export structured content as a document", inputs: ["record"], outputs: ["file"], permissions: ["file:download"], dependencies: [], validationTests: ["Creates a valid file"], activation: "explicit_review", effects: ["filesystem"], platforms: ["web"] };
    expect(parseAgentPlan(JSON.stringify(plan([], { requirements: [{ kind: "capability", id: "document_export" }], confirmations: [{ message: "Review first" }], capabilityProposal: proposal })))).toMatchObject({ confirmations: ["Review first"], capabilityProposal: proposal });
  });

  it("accepts descriptive typed capability outputs returned by Codex", () => {
    const proposal = {
      scope: "global", kind: "typed_module", name: "PDF Summary Export v1",
      generalizedIntent: "Generate and download a PDF summary for an input record.",
      inputs: ["record: object", "title: string", "filename: string"],
      outputs: ["pdfBlob: Blob(application/pdf)", "filename: string", "error: missing_input|render_failed|dependency_unavailable|download_blocked|unsupported_platform"],
      permissions: ["browser download initiated by user action"], dependencies: ["Reviewed PDF implementation pending approval"],
      validationTests: ["Generates a non-empty application/pdf blob"], activation: "explicit_review",
      effects: ["ui", "filesystem", "dependency"], platforms: ["web"],
    };
    expect(parseAgentPlan(JSON.stringify(plan([], { requirements: [], capabilityProposal: proposal })))?.capabilityProposal).toEqual(proposal);
  });

  it("preflights arguments and destructive confirmation for every operation", () => {
    expect(operationCatalog.map((item) => item.name)).toEqual(operationNames);
    expect(() => validateOperationArguments("reorder_component", { componentId: "button" })).toThrow();
    expect(() => validateOperationArguments("reorder_component", { componentId: "button", afterComponentId: "copy" })).not.toThrow();
    expect(() => validateOperationArguments("remove_component", { componentId: "button", confirmed: false })).toThrow();
    expect(() => validateOperationArguments("update_data_source", { sourceId: "tasks", patch: { schema: { id: "string", dueDate: "datetime" } } })).not.toThrow();
    expect(() => validateOperationArguments("update_data_source", { sourceId: "tasks", patch: { schema: { dueDate: "datetime?" } } })).toThrow();
    expect(() => validateOperationArguments("create_flow", { flow: { id: "save", name: "Save" } })).toThrow();
  });

  it("rejects unsupported component, flow-node and native action types", () => {
    expect(parseAgentPlan(JSON.stringify(plan([{ type: "add_component", pageId: null, args: { componentType: "invented" } }])))).toBeUndefined();
    expect(parseAgentPlan(JSON.stringify(plan([{ type: "add_flow_node", pageId: null, args: { flowId: "f", node: { id: "n", type: "invented" } } }])))).toBeUndefined();
    expect(parseAgentPlan(JSON.stringify(plan([{ type: "add_flow_node", pageId: null, args: { flowId: "f", node: { id: "n", type: "nativeAction", config: { capability: "camera", action: "teleport" } } } }])))).toBeUndefined();
  });
});
