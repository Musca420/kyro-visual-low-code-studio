import { describe, expect, it } from "vitest";
import { operationCatalog, operationNames, operationNameSet, operationRequiresConfirmation, validateOperationArguments } from "../src/agentRegistry";

describe("Kyro agent operation registry", () => {
  it("owns unique operations, domains and destructive confirmation", () => {
    expect(new Set(operationNames).size).toBe(operationNames.length);
    expect(operationNameSet.has("apply_editor_transaction")).toBe(false);
    expect(operationRequiresConfirmation("remove_component")).toBe(true);
    expect(operationRequiresConfirmation("set_component_property")).toBe(false);
  });

  it("publishes one complete machine-readable contract for every operation", () => {
    expect(operationCatalog.map((item) => item.name)).toEqual(operationNames);
    for (const item of operationCatalog) {
      expect(item.description).toBeTruthy();
      expect(item.platforms.length).toBeGreaterThan(0);
      expect(item.effects.length).toBeGreaterThan(0);
      expect(item.verifies.length).toBeGreaterThan(0);
      expect(item.args).toMatchObject({ type: "object" });
    }
  });

  it("rejects invented flow-node configuration before a transaction is approved", () => {
    const node = (type: string, config: Record<string, string>) => ({ id: type, type, label: type, position: { x: 0, y: 0 }, config });
    expect(() => validateOperationArguments("create_flow", { flow: {
      id: "flow", name: "Create task", edges: [],
      nodes: [node("event", {}), node("readInput", { formId: "form", fields: "text,dueDate" })],
    } })).toThrow();
    expect(() => validateOperationArguments("create_flow", { flow: {
      id: "flow", name: "Create task", edges: [],
      nodes: [node("event", {}), node("validate", { field: "text", required: "true", minLength: "3", message: "Invalid" })],
    } })).toThrow();
    expect(validateOperationArguments("create_flow", { flow: {
      id: "flow", name: "Create task", edges: [],
      nodes: [node("event", {}), node("validate", { field: "text", rule: "minLength", value: "3", message: "Invalid" })],
    } })).toBeTruthy();
  });

  it("rejects visual state names inside product intent", () => {
    expect(() => validateOperationArguments("set_component_intent", { componentId: "button", intent: { role: "primary", requiredStates: ["enabled"] } })).toThrow();
    expect(validateOperationArguments("set_component_intent", { componentId: "button", intent: { role: "primary", requiredStates: ["loading", "error"] } })).toBeTruthy();
  });

  it("rejects invented or untyped flow-node patch configuration", () => {
    expect(() => validateOperationArguments("update_flow_node", { flowId: "flow", nodeId: "validate", patch: { config: { field: "text", rule: "length", min: 3, max: 80 } } })).toThrow();
    expect(validateOperationArguments("update_flow_node", { flowId: "flow", nodeId: "validate", patch: { config: { field: "text", rule: "maxLength", value: "80", message: "Too long" } } })).toBeTruthy();
  });
});
