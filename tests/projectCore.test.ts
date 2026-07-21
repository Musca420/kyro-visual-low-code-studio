import { describe, expect, it } from "vitest";
import { createProject } from "../src/model";
import { applyProjectTransaction } from "../src/projectCore";

const request = (projectId: string, operations: Parameters<typeof applyProjectTransaction>[1]["operations"]) => ({
  transactionId: "tx-1",
  actor: "manual" as const,
  projectId,
  pageId: "home",
  baseRevision: 0,
  operations,
  authorization: { kind: "user" as const },
  timestamp: "2026-07-20T00:00:00.000Z",
});

describe("project core transaction boundary", () => {
  it("applies typed operations atomically and advances one revision", () => {
    const project = createProject("Core");
    project.pages.push({ id: "home", name: "Home", path: "/", components: [] });
    const result = applyProjectTransaction(project, request(project.id, [
      { type: "add_component", args: { componentId: "title", componentType: "title", name: "Hero title" } },
      { type: "set_component_property", args: { componentId: "title", property: "label", value: "Build visually" } },
    ]));
    expect(result.project.revision).toBe(1);
    expect(result.project.pages[0].components[0]).toMatchObject({ id: "title", name: "Hero title", props: { label: "Build visually" } });
    expect(result.transaction).toMatchObject({ id: "tx-1", baseRevision: 0, finalRevision: 1, actor: "manual" });
    expect(project.pages[0].components).toEqual([]);
  });

  it("rejects stale or partially invalid transactions without changing the Graph", () => {
    const project = createProject("Core");
    project.pages.push({ id: "home", name: "Home", path: "/", components: [] });
    expect(() => applyProjectTransaction(project, { ...request(project.id, [{ type: "add_component", args: { componentType: "title" } }]), baseRevision: 1 })).toThrow(/revision changed/);
    expect(() => applyProjectTransaction(project, request(project.id, [
      { type: "add_component", args: { componentId: "title", componentType: "title" } },
      { type: "set_component_property", args: { componentId: "missing", property: "label", value: "No" } },
    ]))).toThrow(/not found/);
    expect(project.pages[0].components).toEqual([]);
    expect(project.revision).toBe(0);
  });
});
