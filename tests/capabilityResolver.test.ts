import { describe, expect, it } from "vitest";
import { proposalCoversCapabilityGap, resolveCapability } from "../src/capabilityResolver";
import { createGlobalCapabilityVersion, transitionGlobalCapability } from "../src/globalCapability";

describe("Kyro capability resolver", () => {
  it("returns unknown without typed requirements instead of guessing from words", () => {
    expect(resolveCapability({ request: "Change a button", targetPlatforms: ["web"] }).status).toBe("unknown");
    expect(resolveCapability({ request: "Photograph a comet", targetPlatforms: ["web"] }).status).toBe("unknown");
  });

  it("publishes the exact reusable capability proposal contract", () => {
    const result = resolveCapability({ requirements: [{ kind: "capability", id: "pdf_export" }], targetPlatforms: ["web"] });
    expect(result.capabilityProposalContract).toMatchObject({
      type: "object",
      required: expect.arrayContaining(["scope", "kind", "name", "generalizedIntent", "inputs", "outputs", "permissions", "dependencies", "validationTests", "activation"]),
      properties: { inputs: { type: "array" }, outputs: { type: "array" }, activation: { enum: ["passing_tests", "explicit_review"] } },
    });
    expect(result.registeredEffects).toEqual(["ui", "state", "data", "network", "filesystem", "native", "dependency"]);
  });

  it("covers only explicitly proposed capability effects", () => {
    const resolution = resolveCapability({ requirements: [{ kind: "capability", id: "pdf_export" }, { kind: "effect", id: "filesystem" }, { kind: "effect", id: "dependency" }], targetPlatforms: ["web"] });
    expect(proposalCoversCapabilityGap(resolution, { effects: ["filesystem", "dependency"] })).toBe(true);
    expect(proposalCoversCapabilityGap(resolution, { effects: ["filesystem"] })).toBe(false);
  });

  it("proves one registered operation", () => {
    const result = resolveCapability({ requirements: [{ kind: "operation", id: "set_component_style" }], targetPlatforms: ["web"] });
    expect(result.status).toBe("supported");
    expect(result.selectedOperations).toEqual(["set_component_style"]);
    expect(result.operationContracts).toHaveLength(1);
    expect(result.operationContracts[0]).toMatchObject({
      name: "set_component_style",
      args: { required: ["componentId", "property", "value"] },
    });
    expect(result.missingRequirements).toEqual([]);
  });

  it("returns the exact nested intent contract instead of making Codex guess arguments", () => {
    const result = resolveCapability({ requirements: [{ kind: "operation", id: "set_component_intent" }], targetPlatforms: ["web"] });
    expect(result.operationContracts[0]).toMatchObject({
      name: "set_component_intent",
      args: { required: ["componentId", "intent"] },
    });
  });

  it("proves a composition and its declared effect", () => {
    const result = resolveCapability({ requirements: [{ kind: "operation", id: "add_flow_node" }, { kind: "operation", id: "connect_nodes" }, { kind: "effect", id: "state" }], targetPlatforms: ["web"] });
    expect(result.status).toBe("composable");
    expect(result.supportedRequirements).toHaveLength(3);
  });

  it("reports partial, unsupported and unknown IDs honestly", () => {
    expect(resolveCapability({ requirements: [{ kind: "operation", id: "set_theme_token" }, { kind: "operation", id: "invented" }], targetPlatforms: ["web"] }).status).toBe("partial");
    const unsupported = resolveCapability({ requirements: [{ kind: "operation", id: "invented" }], targetPlatforms: ["web"] });
    expect(unsupported.status).toBe("unsupported");
    expect(unsupported.missingRequirements[0]).toMatchObject({ id: "invented" });
    expect(resolveCapability({ requirements: [{ kind: "effect", id: "teleport" }], targetPlatforms: ["web"] }).status).toBe("unsupported");
  });

  it("blocks a registered operation on an unsupported target platform", () => {
    const result = resolveCapability({ requirements: [{ kind: "operation", id: "compose_native_action" }], targetPlatforms: ["desktop"] });
    expect(result.status).toBe("unsupported");
    expect(result.blockedRequirements[0].reason).toMatch(/desktop/);
  });

  it("lists destructive confirmations before apply", () => {
    const result = resolveCapability({ requirements: [{ kind: "operation", id: "remove_component" }], targetPlatforms: ["web"] });
    expect(result.requiredConfirmations).toEqual(["remove_component"]);
  });

  it("selects global capabilities only with platform-specific runtime evidence", () => {
    const proposal = { scope: "global" as const, kind: "typed_module" as const, name: "Normalize records", generalizedIntent: "Normalize records consistently in every project", inputs: ["record"], outputs: ["record"], permissions: [], dependencies: [], validationTests: ["Normalizes a record"], activation: "passing_tests" as const, effects: ["data" as const], platforms: ["web" as const, "android" as const] };
    const draft = createGlobalCapabilityVersion(proposal, { jobId: "job", prompt: "Normalize" });
    const testing = transitionGlobalCapability(draft, "testing");
    const implemented = { ...testing, contract: { ...testing.contract, implementation: { ...testing.contract.implementation, reference: "module:normalize", status: "verified" as const } } };
    const environment = { platform: "web" as const, runtimeVersion: "0.1.0", dependencyVersions: {}, implementationHash: "c".repeat(64) };
    const active = transitionGlobalCapability(implemented, "active", [
      { id: "test", kind: "test", check: "Normalizes a record", passed: true, hash: "a".repeat(64), ...environment, createdAt: new Date().toISOString() },
      { id: "runtime", kind: "runtime", check: "Runs", passed: true, hash: "b".repeat(64), ...environment, createdAt: new Date().toISOString() },
    ]);
    const requirement = [{ kind: "capability" as const, id: active.capabilityId }];
    expect(resolveCapability({ requirements: requirement, targetPlatforms: ["web"] }, { globalCapabilities: [active] }).status).toBe("supported");
    const android = resolveCapability({ requirements: requirement, targetPlatforms: ["android"] }, { globalCapabilities: [active] });
    expect(android.status).toBe("unsupported");
    expect(android.blockedRequirements[0].reason).toMatch(/evidence.*android/i);
  });
});
