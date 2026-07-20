import { describe, expect, it } from "vitest";
import planSchema from "../server/agent-plan.schema.json";
import { operationNames } from "../src/agentRegistry";
import { parseAgentPlan } from "../src/agentPlan";

describe("structured Codex plan", () => {
  it("matches the operation registry and rejects invented tools", () => {
    const enumValues = planSchema.properties.operations.items.properties.type.enum;
    expect(enumValues).toEqual(operationNames);
    expect(parseAgentPlan(JSON.stringify({ summary: "Rename", skill: "kyro-design", operations: [{ type: "set_component_property", pageId: null, argsJson: JSON.stringify({ componentId: "title", property: "name", value: "Hero" }) }], checks: ["Name changes"], confirmations: [], alreadySatisfied: false, capabilityProposal: null }))).toBeTruthy();
    expect(parseAgentPlan(JSON.stringify({ summary: "Bad", skill: "x", operations: [{ type: "edit_everything", pageId: null, argsJson: "{}" }], checks: [], confirmations: [], alreadySatisfied: false, capabilityProposal: null }))).toBeUndefined();
    expect(parseAgentPlan(JSON.stringify({ summary: "Add a reusable signer", skill: "kyro-extensions", operations: [], checks: ["Sandbox tests"], confirmations: ["Review dependencies"], alreadySatisfied: false, capabilityProposal: { scope: "global", kind: "plugin", name: "Signed document delivery", generalizedIntent: "Create, sign and deliver a generated document", inputs: ["document data"], outputs: ["delivery result"], permissions: ["network", "secrets"], dependencies: ["reviewed PDF and SMTP packages"], validationTests: ["Reject missing signing credentials"], activation: "explicit_review" } }))).toBeTruthy();
    expect(parseAgentPlan(JSON.stringify({ summary: "Already done", skill: "kyro-data", operations: [], checks: ["Binding exists"], confirmations: [], alreadySatisfied: true, capabilityProposal: null }))).toBeTruthy();
    expect(parseAgentPlan(JSON.stringify({ summary: "Wrong node", skill: "kyro-actions", operations: [{ type: "add_flow_node", pageId: null, argsJson: JSON.stringify({ flowId: "save", node: { id: "save", type: "data-create" } }) }], checks: [], confirmations: [], alreadySatisfied: false, capabilityProposal: null }))).toBeUndefined();
    expect(parseAgentPlan(JSON.stringify({ summary: "Wrong path", skill: "kyro-actions", operations: [{ type: "connect_nodes", pageId: null, argsJson: JSON.stringify({ flowId: "save", source: "a", target: "b", path: "invalid" }) }], checks: [], confirmations: [], alreadySatisfied: false, capabilityProposal: null }))).toBeUndefined();
    expect(parseAgentPlan(JSON.stringify({ summary: "Nothing", skill: "x", operations: [], checks: [], confirmations: [], alreadySatisfied: false, capabilityProposal: null }))).toBeUndefined();
  });
});
