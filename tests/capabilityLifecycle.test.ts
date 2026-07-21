import { describe, expect, it } from "vitest";
import { capabilityRollbackTarget, createGlobalCapabilityVersion, finalizeCapabilityMigration, globalCapabilitySchema, transitionGlobalCapability } from "../src/globalCapability";
import { nativeCapabilities, nativeCapabilityContracts } from "../src/nativeCapabilities";

const proposal = {
  scope: "global" as const,
  kind: "typed_module" as const,
  name: "Normalize contact data",
  generalizedIntent: "Normalize contact fields for any Kyro project",
  inputs: ["contact"],
  outputs: ["normalized contact"],
  permissions: [],
  dependencies: [],
  validationTests: ["Normalizes whitespace", "Preserves missing fields"],
  activation: "passing_tests" as const,
  effects: ["data" as const],
  platforms: ["web" as const, "android" as const],
};

const evidence = (kind: "test" | "runtime", check: string) => ({
  id: crypto.randomUUID(), kind, check, passed: true, hash: "a".repeat(64), createdAt: new Date().toISOString(),
});

describe("capability lifecycle", () => {
  it("keeps a capability inactive until its implementation and evidence pass", () => {
    const draft = createGlobalCapabilityVersion(proposal, { jobId: "job-1", prompt: "Normalize contacts" });
    expect(draft.state).toBe("draft");
    expect(() => transitionGlobalCapability(draft, "active")).toThrow(/cannot move/i);
    const testing = transitionGlobalCapability(draft, "testing");
    expect(() => transitionGlobalCapability(testing, "active", proposal.validationTests.map((check) => evidence("test", check)))).toThrow(/implementation/i);
    const implemented = { ...testing, contract: { ...testing.contract, implementation: { ...testing.contract.implementation, reference: "module:normalize-contact", status: "verified" as const } } };
    const active = transitionGlobalCapability(implemented, "active", [...proposal.validationTests.map((check) => evidence("test", check)), evidence("runtime", "Runs in the shared runtime")]);
    expect(active.state).toBe("active");
    expect(active.evidence).toHaveLength(3);
  });

  it("creates immutable successor versions with migration and rollback lineage", () => {
    const firstDraft = createGlobalCapabilityVersion(proposal, { jobId: "job-1", prompt: "First" });
    const firstTesting = transitionGlobalCapability(firstDraft, "testing");
    const firstImplemented = { ...firstTesting, contract: { ...firstTesting.contract, implementation: { ...firstTesting.contract.implementation, reference: "module:normalize-v1", status: "verified" as const } } };
    const first = transitionGlobalCapability(firstImplemented, "active", [...proposal.validationTests.map((check) => evidence("test", check)), evidence("runtime", "Runs")]);
    const second = createGlobalCapabilityVersion({ ...proposal, outputs: ["normalized contact", "warnings"] }, { jobId: "job-2", prompt: "Add warnings" }, first);
    expect(second.id).not.toBe(first.id);
    expect(second.capabilityId).toBe(first.capabilityId);
    expect(second.version).toBe("0.2.0");
    expect(second.previousVersion).toBe("0.1.0");
    expect(second.migrations[0]).toMatchObject({ strategy: "blocked", rollbackVersion: "0.1.0" });
    const testing = transitionGlobalCapability(second, "testing");
    const implemented = { ...testing, contract: { ...testing.contract, implementation: { ...testing.contract.implementation, reference: "module:normalize-v2", status: "verified" as const } } };
    const active = transitionGlobalCapability(implemented, "active", [...proposal.validationTests.map((check) => evidence("test", check)), evidence("runtime", "Runs")]);
    const migrated = finalizeCapabilityMigration(active, ["Rebind the added warnings output"]);
    expect(migrated.migrations[0].strategy).toBe("compatible");
    expect(capabilityRollbackTarget([first, migrated], migrated)).toBe(first);
  });

  it("blocks unverifiable legacy activation and contracts every built-in native capability", () => {
    const now = new Date().toISOString();
    const legacy = globalCapabilitySchema.parse({ ...proposal, id: crypto.randomUUID(), version: "0.1.0", state: "active", sourceJobId: "legacy", sourcePrompt: "legacy", createdAt: now, updatedAt: now });
    expect(legacy.state).toBe("blocked");
    expect(legacy.statusReason).toMatch(/requires contract verification/i);
    expect(() => globalCapabilitySchema.parse({ ...legacy, state: "active" })).toThrow(/verified implementation/i);
    expect(nativeCapabilityContracts).toHaveLength(nativeCapabilities.length);
    expect(nativeCapabilityContracts.every((contract) => contract.implementation.status === "verified" && contract.effects.includes("native"))).toBe(true);
  });
});
