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
    expect(context.dependencies.flows[0].nodes[0]).toMatchObject({ id: "insert", config: { sourceId: "tasks", componentId: "button" } });
    expect(context.dependencies.dataSources.map((item: any) => item.id)).toEqual(["tasks"]);
    expect(context.dependencies.siblings.map((item: any) => item.id)).toEqual(["other"]);
    expect(context.contextBytes).toBeLessThanOrEqual(24_000);
    expect(context.contextHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("includes descendants of flow-connected containers for cross-layer changes", () => {
    const context = buildAgentContext({
      projectId: "project", pageId: "page", revision: 1, selectedComponentIds: ["list"], viewport: "desktop",
      componentTree: [
        { id: "form", name: "Task form", children: [{ id: "title", parentId: "form", name: "Title field", children: [] }] },
        { id: "list", name: "Task list", binding: { sourceId: "tasks" }, children: [] },
      ],
      flows: [{ id: "save", nodes: [{ id: "submit", config: { componentId: "form" } }, { id: "insert", config: { sourceId: "tasks" } }, { id: "refresh", config: { componentId: "list" } }], edges: [] }],
      dataSources: [{ id: "tasks", name: "tasks" }],
    }, { kind: "component", componentId: "list" }) as Record<string, any>;
    expect(context.dependencies.relatedComponents.map((item: any) => item.id)).toEqual(["form", "title", "list"]);
    expect(context.dependencies.flows[0].nodes.map((node: any) => node.id)).toEqual(["submit", "insert", "refresh"]);
  });

  it("keeps a large dependency slice below the safety limit without losing stable references", () => {
    const styles = Object.fromEntries(Array.from({ length: 48 }, (_, index) => [`property${index}`, "x".repeat(200)]));
    const children = Array.from({ length: 24 }, (_, index) => ({ id: `field-${index}`, parentId: "form", name: `Field ${index}`, type: "input", styles, events: {}, children: [] }));
    const context = buildAgentContext({
      projectId: "project", pageId: "page", revision: 1, selectedComponentIds: ["button"], viewport: "desktop",
      componentTree: [{ id: "form", name: "Form", type: "form", styles, children }, { id: "button", name: "Save", type: "button", styles, events: { click: "save" }, children: [] }],
      flows: [{ id: "save", nodes: [{ id: "event", type: "event", config: { componentId: "form" } }], edges: [] }], dataSources: [],
    }, { kind: "component", componentId: "button" }) as Record<string, any>;
    expect(context.dependencies.relatedComponents.map((item: any) => item.id)).toContain("field-0");
    expect(context.dependencies.relatedComponents[0].styles).toBeUndefined();
    expect(context.contextBytes).toBeLessThanOrEqual(24_000);
  });

  it("follows the parent form flow when a submit button is selected", () => {
    const context = buildAgentContext({
      projectId: "project", pageId: "page", revision: 1, selectedComponentIds: ["button"],
      componentTree: [{ id: "form", name: "Form", type: "form", events: { submit: "save" }, children: [{ id: "button", parentId: "form", name: "Save", type: "button", events: {}, children: [] }] }],
      flows: [{ id: "save", name: "Save", nodes: [{ id: "event", type: "event", config: {} }], edges: [] }], dataSources: [],
    }, { kind: "component", componentId: "button" }) as Record<string, any>;
    expect(context.dependencies.flows.map((flow: any) => flow.id)).toEqual(["save"]);
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
