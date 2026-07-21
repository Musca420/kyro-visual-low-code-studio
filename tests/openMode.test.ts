import { describe, expect, it } from "vitest";
import { createGlobalCapabilityVersion } from "../src/globalCapability";
import { approveOpenModeDependency, chooseOpenModeResolution, startOpenMode, verifyOpenModeModule } from "../src/openMode";

const baseProposal = { scope: "global" as const, kind: "typed_module" as const, name: "Normalize names", generalizedIntent: "Normalize names across all Kyro projects", inputs: ["name"], outputs: ["normalized name"], permissions: [], dependencies: [], validationTests: ["Trims surrounding spaces"], activation: "passing_tests" as const, effects: ["data" as const], platforms: ["web" as const] };
const module = { id: "normalize", name: "Normalize names", description: "", inputType: "string" as const, outputType: "string" as const, operation: "trim" as const, config: {}, tests: [{ id: "trim", input: " Ada ", expected: "Ada" }] };
const report = (projectId: string, status: "verified" | "failed" = "verified") => ({ version: 1 as const, status, projectId, baseRevision: 1, finalRevision: 2, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), effects: ["graph" as const, "runtime" as const, "behavior" as const], stages: [] });

describe("Open Mode", () => {
  it("implements, verifies and registers a confined reusable module", async () => {
    const capability = createGlobalCapabilityVersion(baseProposal, { jobId: "job", prompt: "Normalize" });
    const selected = chooseOpenModeResolution(startOpenMode(capability, "project"), "local_module");
    const result = await verifyOpenModeModule(selected, capability, module, "tx-1", report("project"));
    expect(result.session.stage).toBe("completed");
    expect(result.capability.state).toBe("active");
    expect(result.implementation).toMatchObject({ capabilityId: capability.capabilityId, transactionId: "tx-1" });
  });

  it("records a failed verification without activating the capability", async () => {
    const capability = createGlobalCapabilityVersion(baseProposal, { jobId: "job", prompt: "Normalize" });
    const selected = chooseOpenModeResolution(startOpenMode(capability, "project"), "local_module");
    const result = await verifyOpenModeModule(selected, capability, { ...module, tests: [{ id: "bad", input: " Ada ", expected: "Grace" }] }, "tx-2", report("project"));
    expect(result.session.stage).toBe("failed");
    expect(result.capability.state).toBe("draft");
    expect(result.implementation).toBeNull();
  });

  it("requires an exact reviewed dependency and supports an explicit limitation", () => {
    const plugin = createGlobalCapabilityVersion({ ...baseProposal, kind: "plugin", name: "Signed delivery", dependencies: ["PDF package"] }, { jobId: "job", prompt: "Sign" });
    const approval = chooseOpenModeResolution(startOpenMode(plugin, "project"), "reviewed_plugin");
    expect(() => approveOpenModeDependency(approval, { name: "PDF package", version: "1.0.0", license: "MIT", risk: "medium", rollback: "Remove package", platforms: ["web"] })).toThrow(/exact package/i);
    const approved = approveOpenModeDependency(approval, { name: "@scope/pdf", version: "1.0.0", license: "MIT", risk: "medium", rollback: "Remove package", platforms: ["web"] });
    expect(approved.stage).toBe("implementation");
    expect(approved.events.at(-1)?.detail).toMatch(/no package has been installed/i);
    expect(approveOpenModeDependency(approval, { name: "pdf-lib", version: "1.0.0", license: "MIT", risk: "medium", rollback: "Remove package", platforms: ["web"] }).stage).toBe("implementation");
    expect(chooseOpenModeResolution(startOpenMode(plugin, "project"), "limitation").stage).toBe("completed");
  });
});
