import { describe, expect, it } from "vitest";
import { makeComponent, createProject, type Project } from "../src/model";
import { applyProjectTransaction } from "../src/projectCore";
import { executeProjectTransaction, type ProjectTransactionRecord, type TransactionRepository } from "../src/transactionEngine";
import { verificationAdapters, verifyProjectTransaction, type VerificationAdapters } from "../src/verification";
import type { EditorOperation } from "../src/editorOperations";

const projectWithPage = () => {
  const project = createProject("Verification fixture");
  return { ...project, pages: [{ id: "home", name: "Home", path: "/", components: [makeComponent("title")] }] } as Project;
};

const request = (project: Project, type: string, args: Record<string, unknown>) => ({
  transactionId: crypto.randomUUID(), actor: "manual" as const, projectId: project.id,
  pageId: "home", baseRevision: project.revision, operations: [{ type, args }],
  authorization: { kind: "user" as const },
});

const changed = (project: Project, type: string, args: Record<string, unknown>) => {
  const transaction = request(project, type, args);
  return { transaction, after: applyProjectTransaction(project, transaction).project };
};

const throwing = (stage: keyof VerificationAdapters): VerificationAdapters => ({
  ...verificationAdapters,
  [stage]: () => { throw new Error(`${stage} adapter rejected the revision`); },
});

describe("Transaction Verification", () => {
  it("selects stages from declared operation effects and hashes reproducible evidence", async () => {
    const before = projectWithPage();
    const { transaction, after } = changed(before, "set_component_style", {
      componentId: before.pages[0].components[0].id, property: "color", value: "#123456", breakpoint: "desktop",
    });
    const report = await verifyProjectTransaction(before, after, transaction.operations);
    expect(report.status).toBe("verified");
    expect(report.effects).toEqual(["graph", "runtime", "visual"]);
    expect(report.stages.map(({ name, status }) => [name, status])).toEqual([
      ["validation", "passed"], ["runtime", "passed"], ["behavior", "skipped"],
      ["visual", "passed"], ["build", "skipped"],
    ]);
    expect(report.stages.filter((stage) => stage.status === "passed").every((stage) => stage.evidence[0].hash?.length === 64)).toBe(true);
  });

  it("reports validation and each required adapter failure without claiming verification", async () => {
    const before = projectWithPage();
    const visual = changed(before, "set_component_style", {
      componentId: before.pages[0].components[0].id, property: "color", value: "#123456", breakpoint: "desktop",
    });
    const behavior = changed(before, "add_flow", { flowId: "flow", name: "Flow" });
    const build = changed(before, "set_export_config", { patch: { target: "pwa" } });

    const invalidRevision = await verifyProjectTransaction(before, { ...visual.after, revision: before.revision } as Project, visual.transaction.operations);
    expect(invalidRevision.stages.find((stage) => stage.name === "validation")?.status).toBe("failed");
    for (const [stage, fixture] of [["runtime", visual], ["visual", visual], ["behavior", behavior], ["build", build]] as const) {
      const report = await verifyProjectTransaction(before, fixture.after, fixture.transaction.operations, throwing(stage));
      expect(report.status).toBe("failed");
      expect(report.stages.find((item) => item.name === stage)).toMatchObject({ required: true, status: "failed" });
    }
  });

  it("persists failed evidence and leaves the Graph unchanged when verification rejects", async () => {
    const before = projectWithPage(), records = new Map<string, ProjectTransactionRecord>();
    let persistedRevision = before.revision;
    const repository: TransactionRepository = {
      async get(id) { return records.get(id); },
      async commit(record) { persistedRevision = record.finalRevision!; records.set(record.id, record); return record; },
      async saveFailed(record) { records.set(record.id, record); return record; },
    };
    const mutation = request(before, "set_component_style", {
      componentId: before.pages[0].components[0].id, property: "color", value: "#123456", breakpoint: "desktop",
    });
    const rejectVisual = (current: Project, next: Project, operations: EditorOperation[]) =>
      verifyProjectTransaction(current, next, operations, throwing("visual"));

    await expect(executeProjectTransaction(before, mutation, repository, rejectVisual)).rejects.toThrow(/Verification failed \(visual\)/);
    expect(before.revision).toBe(0);
    expect(persistedRevision).toBe(0);
    expect(records.get(mutation.transactionId)).toMatchObject({ status: "failed", verification: { status: "failed" } });
  });
});
