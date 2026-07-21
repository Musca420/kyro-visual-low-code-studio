import { describe, expect, it } from "vitest";
import { resolveCapability } from "../src/capabilityResolver";
import { createGlobalCapabilityVersion, transitionGlobalCapability } from "../src/globalCapability";

describe("Kyro capability resolver", () => {
  it("keeps Codex in charge and composes registered graph operations", () => {
    const result = resolveCapability({ request: "Save this form", domains: ["actions", "data"] });
    expect(result.codexRequired).toBe(false);
    expect(result.strategy).toBe("compose_visual_graph");
    expect(result.registeredOperations).toContain("add_flow_node");
    expect(result.registeredOperations).toContain("create_data_source");
    expect(result.fallback.doesNotBlockOnMissingSkill).toBe(true);
  });

  it("turns a pure transformation gap into a tested reusable module candidate", () => {
    const result = resolveCapability({ request: "Transform records", domains: ["actions"], prefersModule: true });
    expect(result.strategy).toBe("tested_typed_module");
    expect(result.learningCandidate).toMatchObject({ kind: "typed_module", activationRequiresPassingTests: true });
  });

  it("requires review for external packages and forbids app-specific learning", () => {
    const result = resolveCapability({ request: "Scan a sensor", domains: ["extensions"], capabilityIds: ["bluetooth.scan"], requiresExternal: true });
    expect(result.strategy).toBe("reviewed_extension");
    expect(result.status).toBe("extension_required");
    expect(result.learningCandidate).toMatchObject({ kind: "plugin", installationRequiresApproval: true, generalizeFromIntent: true });
    expect(result.learningCandidate.rule).toMatch(/never hard-code/i);
  });

  it("reuses an active global capability across projects", () => {
    const proposal = { scope: "global" as const, kind: "typed_module" as const, name: "Signed document delivery", generalizedIntent: "Generate and sign PDF documents for delivery", inputs: ["document"], outputs: ["signed document"], permissions: [], dependencies: [], validationTests: ["Signs a document"], activation: "passing_tests" as const, effects: ["data" as const], platforms: ["web" as const] };
    const draft = createGlobalCapabilityVersion(proposal, { jobId: "job", prompt: "Sign" });
    const testing = transitionGlobalCapability(draft, "testing");
    const implemented = { ...testing, contract: { ...testing.contract, implementation: { ...testing.contract.implementation, reference: "module:sign", status: "verified" as const } } };
    const active = transitionGlobalCapability(implemented, "active", [
      { id: "test", kind: "test", check: "Signs a document", passed: true, hash: "a".repeat(64), createdAt: new Date().toISOString() },
      { id: "runtime", kind: "runtime", check: "Runs", passed: true, hash: "b".repeat(64), createdAt: new Date().toISOString() },
    ]);
    const result = resolveCapability({ request: "Sign a document", capabilityIds: [active.capabilityId] }, { globalCapabilities: [active] });
    expect(result.strategy).toBe("reuse_global_capability");
    expect(result.globalCapabilities).toHaveLength(1);
  });
});
