import { describe, expect, it } from "vitest";
import { createProject } from "../src/model";
import { executeProjectTransaction, rollbackProjectTransaction, type ProjectTransactionRecord, type TransactionRepository } from "../src/transactionEngine";

function repository(initialRevision = 0) {
  const records = new Map<string, ProjectTransactionRecord>();
  let revision = initialRevision;
  const value: TransactionRepository = {
    async get(id) { return records.get(id); },
    async commit(record) {
      const existing = records.get(record.id);
      if (existing) return existing;
      if (record.baseRevision !== revision) throw new Error("persisted project revision changed");
      revision = record.finalRevision!;
      records.set(record.id, record);
      return record;
    },
    async saveFailed(record) {
      const existing = records.get(record.id);
      if (existing) return existing;
      records.set(record.id, record);
      return record;
    },
  };
  return { value, records, revision: () => revision };
}

const request = (projectId: string, id: string, baseRevision: number, value: string) => ({
  transactionId: id, actor: "manual" as const, projectId, pageId: "home", baseRevision,
  operations: [{ type: "set_project_property", args: { property: "name", value } }],
  authorization: { kind: "user" as const },
});

describe("Project Transaction Engine", () => {
  it("replays the same transaction idempotently without a second revision", async () => {
    const graph = createProject("Before"), store = repository();
    const first = await executeProjectTransaction(graph, request(graph.id, "tx-1", 0, "After"), store.value);
    const replay = await executeProjectTransaction(first.project, request(graph.id, "tx-1", 0, "After"), store.value);
    expect(first.project).toMatchObject({ name: "After", revision: 1 });
    expect(replay).toMatchObject({ replayed: true, project: { revision: 1 } });
    expect(store.records.size).toBe(1);
  });

  it("rejects ID reuse, stale races and partial failures without changing the Graph", async () => {
    const graph = createProject("Before"), store = repository();
    await executeProjectTransaction(graph, request(graph.id, "winner", 0, "Winner"), store.value);
    await expect(executeProjectTransaction(graph, request(graph.id, "loser", 0, "Loser"), store.value)).rejects.toThrow(/persisted project revision changed/);
    await expect(executeProjectTransaction(graph, request(graph.id, "winner", 0, "Different"), store.value)).rejects.toThrow(/cannot be reused/);
    await expect(executeProjectTransaction(graph, {
      ...request(graph.id, "partial", 0, "Never committed"),
      operations: [
        { type: "set_project_property", args: { property: "name", value: "Temporary" } },
        { type: "set_component_property", args: { componentId: "missing", property: "label", value: "Invalid" } },
      ],
    }, store.value)).rejects.toThrow(/not found/);
    expect(graph).toMatchObject({ name: "Before", revision: 0 });
    expect(store.records.get("loser")?.status).toBe("failed");
    expect(store.records.get("partial")?.status).toBe("failed");
  });

  it("requires actor authorization and records an explicit retry", async () => {
    const graph = createProject("Before"), store = repository();
    await expect(executeProjectTransaction(graph, {
      ...request(graph.id, "unauthorized", 0, "No"), actor: "codex", authorization: { kind: "user" },
    }, store.value)).rejects.toThrow(/approved Job/);
    const retried = await executeProjectTransaction(graph, {
      ...request(graph.id, "retry", 0, "Recovered"), retryOf: "unauthorized",
    }, store.value);
    expect(retried.transaction).toMatchObject({ retryOf: "unauthorized", status: "applied" });
  });

  it("rolls an applied transaction back through a new revisioned transaction", async () => {
    const graph = createProject("Before"), store = repository();
    const applied = await executeProjectTransaction(graph, request(graph.id, "change", 0, "After"), store.value);
    const rolledBack = await rollbackProjectTransaction(applied.project, "change", {
      transactionId: "rollback", actor: "manual", projectId: graph.id, pageId: "home", baseRevision: 1,
      authorization: { kind: "user" },
    }, store.value);
    expect(rolledBack.project).toMatchObject({ name: "Before", revision: 2 });
    expect(rolledBack.transaction).toMatchObject({ status: "rolled_back", rollbackOf: "change" });
    expect(store.revision()).toBe(2);
  });
});
