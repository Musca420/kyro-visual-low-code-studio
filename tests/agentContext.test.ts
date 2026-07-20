import { describe, expect, it } from "vitest";
import { buildAgentContext } from "../server/agentContext";

describe("indexed Kyro agent context", () => {
  it("returns only the focused component and direct graph dependencies", () => {
    const state = {
      projectId: "project", pageId: "page", revision: 4, selectedComponentIds: ["button"], viewport: "mobile",
      componentTree: [{ id: "root", name: "Root", children: [{ id: "button", parentId: "root", name: "Save", events: { click: "save" }, binding: { sourceId: "tasks" }, children: [] }, { id: "other", parentId: "root", name: "Other", children: [] }] }],
      flows: [{ id: "save", nodes: [{ id: "insert", config: { sourceId: "tasks", componentId: "button" } }], edges: [] }, { id: "unrelated", nodes: [], edges: [] }],
      dataSources: [{ id: "tasks", name: "Tasks" }, { id: "private", name: "Private" }], layouts: { button: { x: 1, y: 2, width: 3, height: 4 } },
    };
    const context = buildAgentContext(state, { kind: "component", componentId: "button" }) as Record<string, any>;
    expect(context.selection.name).toBe("Save");
    expect(context.dependencies.flows.map((item: any) => item.id)).toEqual(["save"]);
    expect(context.dependencies.dataSources.map((item: any) => item.id)).toEqual(["tasks"]);
    expect(context.dependencies.siblings.map((item: any) => item.id)).toEqual(["other"]);
    expect(context.contextBytes).toBeLessThanOrEqual(24_000);
    expect(context.contextHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps every supported candidate source addressable by stable ID", () => {
    const dataSources = Array.from({ length: 15 }, (_, index) => ({ id: `source-${index + 1}`, name: `Source ${index + 1}`, provider: "indexeddb", collection: `items${index + 1}` }));
    const context = buildAgentContext({
      projectId: "project", pageId: "page", revision: 1, selectedComponentIds: ["list"], viewport: "desktop",
      componentTree: [{ id: "list", name: "Inventory list", children: [] }], flows: [], dataSources,
    }, { kind: "component", componentId: "list" }) as Record<string, any>;
    expect(context.dependencies.candidateDataSources).toHaveLength(15);
    expect(context.dependencies.candidateDataSources.at(-1)).toMatchObject({ id: "source-15", collection: "items15" });
    expect(context.contextBytes).toBeLessThanOrEqual(24_000);
  });
});
