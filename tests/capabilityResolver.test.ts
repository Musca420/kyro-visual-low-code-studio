import { describe, expect, it } from "vitest";
import { resolveCapability } from "../src/capabilityResolver";

describe("Kyro capability resolver", () => {
  it("keeps Codex in charge and composes registered graph operations", () => {
    const result = resolveCapability("When this button is tapped, validate the form and save a record");
    expect(result.codexRequired).toBe(true);
    expect(result.strategy).toBe("compose_visual_graph");
    expect(result.registeredOperations).toContain("add_flow_node");
    expect(result.registeredOperations).toContain("create_data_source");
    expect(result.fallback.doesNotBlockOnMissingSkill).toBe(true);
  });

  it("turns a pure transformation gap into a tested reusable module candidate", () => {
    const result = resolveCapability("Normalize and extract a value from each record");
    expect(result.strategy).toBe("tested_typed_module");
    expect(result.learningCandidate).toMatchObject({ kind: "typed_module", activationRequiresPassingTests: true });
  });

  it("requires review for external packages and forbids app-specific learning", () => {
    const result = resolveCapability("Use a Bluetooth SDK plugin to scan a sensor");
    expect(result.strategy).toBe("reviewed_extension");
    expect(result.status).toBe("extension_required");
    expect(result.learningCandidate).toMatchObject({ kind: "plugin", installationRequiresApproval: true, generalizeFromIntent: true });
    expect(result.learningCandidate.rule).toMatch(/never hard-code/i);
  });

  it("reuses an active global capability across projects", () => {
    const result = resolveCapability("Generate and sign a PDF document", { globalCapabilities: [{ state: "active", generalizedIntent: "Generate and sign PDF documents for delivery" }] });
    expect(result.strategy).toBe("reuse_global_capability");
    expect(result.globalCapabilities).toHaveLength(1);
  });
});
