import { describe, expect, it } from "vitest";
import { operationDefinitions, operationNameSet, operationRequiresConfirmation } from "../src/agentRegistry";

describe("Kyro agent operation registry", () => {
  it("owns unique operations, domains and destructive confirmation", () => {
    expect(new Set(operationDefinitions.map(([name]) => name)).size).toBe(operationDefinitions.length);
    expect(operationNameSet.has("apply_editor_transaction")).toBe(false);
    expect(operationRequiresConfirmation("remove_component")).toBe(true);
    expect(operationRequiresConfirmation("set_component_property")).toBe(false);
  });
});
