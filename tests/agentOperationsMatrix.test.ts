import { describe, expect, it } from "vitest";
import { applyEditorOperation, type EditorOperation } from "../src/editorOperations";
import { operationDefinitions, operationEntries, operationNames, type KyroOperationType } from "../src/agentRegistry";
import { createProject, makeComponent, type Project } from "../src/model";

const moduleValue = (id = "module") => ({ id, name: id, description: "Tested", inputType: "string" as const, outputType: "string" as const, operation: "trim" as const, config: {}, tests: [{ id: "example", input: " x ", expected: "x" }] });

function fixture() {
  const project = createProject("Operation matrix");
  const root = { ...makeComponent("stack"), id: "root" };
  const title = { ...makeComponent("title"), id: "title" };
  const copy = { ...makeComponent("text"), id: "copy" };
  const button = { ...makeComponent("button"), id: "button" };
  const list = { ...makeComponent("list"), id: "list", binding: { sourceId: "source", state: "data" as const } };
  project.pages = [
    { id: "home", name: "Home", path: "/", components: [root, title, copy, button, list] },
    { id: "other", name: "Other", path: "/other", components: [] },
  ];
  project.dataSources = [{ id: "source", name: "Items", provider: "indexeddb", collection: "items", schema: { id: "string", text: "string" }, capabilities: ["get", "query", "insert", "update", "delete", "subscribe"], secretStrategy: "none" }];
  project.flows = [{ id: "flow", name: "Existing flow", nodes: [
    { id: "event", type: "event", label: "Start", position: { x: 0, y: 0 }, config: { trigger: "click" } },
    { id: "notify", type: "notify", label: "Done", position: { x: 200, y: 0 }, config: { message: "Done" } },
  ], edges: [{ id: "edge", source: "event", target: "notify", path: "success" }] }];
  project.codeModules = [moduleValue()];
  return project;
}

type Sample = { project?: Project; pageId?: string; operation: EditorOperation };
const op = (type: string, args: Record<string, unknown>, pageId = "home"): Sample => ({ operation: { type, args }, pageId });

const samples: Record<KyroOperationType, () => Sample> = {
  add_page: () => op("add_page", { name: "New", path: "/new", pageId: "new" }),
  update_page: () => op("update_page", { name: "Updated" }),
  remove_page: () => op("remove_page", { confirmed: true }, "other"),
  add_component: () => op("add_component", { componentType: "card" }),
  compose_screen: () => op("compose_screen", { name: "Screen", layout: "web", sections: [{ type: "text", label: "Content" }] }),
  move_component: () => op("move_component", { componentId: "copy", parentId: "root" }),
  resize_component: () => op("resize_component", { componentId: "copy", width: "50%", height: "80px" }),
  reorder_component: () => op("reorder_component", { componentId: "button", afterComponentId: "copy" }),
  wrap_component: () => op("wrap_component", { componentId: "copy", componentType: "stack" }),
  remove_component: () => op("remove_component", { componentId: "copy", confirmed: true }),
  set_component_property: () => op("set_component_property", { componentId: "copy", property: "label", value: "Updated" }),
  set_component_style: () => op("set_component_style", { componentId: "copy", property: "color", value: "#111111" }),
  set_responsive_style: () => op("set_responsive_style", { componentId: "copy", breakpoint: "mobile", property: "width", value: "100%" }),
  set_component_state_style: () => op("set_component_state_style", { componentId: "button", state: "focus", property: "outline", value: "2px solid blue" }),
  set_component_accessibility: () => op("set_component_accessibility", { componentId: "button", label: "Continue", role: "button" }),
  set_component_intent: () => op("set_component_intent", { componentId: "button", intent: { role: "primary-action" } }),
  create_flow: () => op("create_flow", { flow: { id: "created-flow", name: "Created flow", nodes: [], edges: [] } }),
  compose_record_action: () => op("compose_record_action", { componentId: "list", sourceId: "source", entity: "Item", action: "delete" }),
  compose_collection_filter: () => {
    const project = fixture();
    project.pages[0].components.push(
      { ...makeComponent("select"), id: "status-filter", props: { ...makeComponent("select").props, options: "All statuses|Open|Done" } },
      { ...makeComponent("text"), id: "visible-count" },
      { ...makeComponent("empty"), id: "filtered-empty" },
    );
    const operation = { type: "compose_collection_filter", args: { sourceId: "source", listComponentId: "list", counterComponentId: "visible-count", emptyComponentId: "filtered-empty", filters: [{ componentId: "status-filter", field: "status", stateKey: "filters.status" }] } };
    return { project, operation };
  },
  compose_native_action: () => op("compose_native_action", { componentId: "button", capability: "camera", action: "takePhoto" }),
  add_flow: () => op("add_flow", { flowId: "new-flow", name: "New flow" }),
  update_flow: () => op("update_flow", { flowId: "flow", name: "Updated flow" }),
  remove_flow: () => op("remove_flow", { flowId: "flow", confirmed: true }),
  add_flow_node: () => op("add_flow_node", { flowId: "flow", node: { id: "log", type: "log", label: "Log", position: { x: 400, y: 0 }, config: { message: "ok" } } }),
  update_flow_node: () => op("update_flow_node", { flowId: "flow", nodeId: "notify", patch: { label: "Updated" } }),
  remove_flow_node: () => op("remove_flow_node", { flowId: "flow", nodeId: "notify" }),
  connect_nodes: () => op("connect_nodes", { flowId: "flow", source: "event", target: "notify", path: "error" }),
  remove_flow_edge: () => op("remove_flow_edge", { flowId: "flow", edgeId: "edge" }),
  set_component_event: () => op("set_component_event", { componentId: "button", event: "click", flowId: "flow" }),
  remove_component_event: () => {
    const project = fixture(); project.pages[0].components.find((item) => item.id === "button")!.events.click = "flow";
    return { project, operation: { type: "remove_component_event", args: { componentId: "button", event: "click" } } };
  },
  create_data_source: () => op("create_data_source", { sourceId: "new-source", name: "New source", provider: "indexeddb", collection: "new-items", schema: { id: "string" } }),
  update_data_source: () => op("update_data_source", { sourceId: "source", patch: { name: "Updated items" } }),
  remove_data_source: () => op("remove_data_source", { sourceId: "source", confirmed: true }),
  bind_component_data: () => op("bind_component_data", { componentId: "copy", sourceId: "source", state: "data" }),
  create_code_module: () => op("create_code_module", { module: moduleValue("new-module") }),
  update_code_module: () => op("update_code_module", { moduleId: "module", patch: { name: "Updated module" } }),
  remove_code_module: () => op("remove_code_module", { moduleId: "module", confirmed: true }),
  set_theme_token: () => op("set_theme_token", { token: "accent", value: "#ff6b5f" }),
  set_project_property: () => op("set_project_property", { property: "name", value: "Updated project" }),
  set_app_config: () => op("set_app_config", { patch: { offline: true } }),
  set_export_config: () => op("set_export_config", { patch: { target: "pwa" } }),
  approve_dependency: () => {
    const project = fixture(); project.flows.push({ id: "ble", name: "BLE", nodes: [{ id: "scan", type: "nativeAction", label: "Scan", position: { x: 0, y: 0 }, config: { capability: "bluetooth", action: "scan" } }], edges: [] });
    return { project, operation: { type: "approve_dependency", args: { packageName: "@capacitor-community/bluetooth-le", version: "^8.0.0", confirmed: true } } };
  },
  revoke_dependency: () => {
    const requested = samples.approve_dependency();
    const project = applyEditorOperation(requested.project!, "home", requested.operation);
    return { project, operation: { type: "revoke_dependency", args: { packageName: "@capacitor-community/bluetooth-le", confirmed: true } } };
  },
};

describe("registered Codex operation matrix", () => {
  it("rejects structured component properties before a transaction", () => {
    expect(operationDefinitions.set_component_property.args.safeParse({
      componentId: "list",
      property: "secondaryField",
      value: { field: "dueDate", displayWhen: "present" },
    }).success).toBe(false);
    expect(operationDefinitions.set_component_property.args.safeParse({
      componentId: "list",
      property: "secondaryField",
      value: "dueDate",
    }).success).toBe(true);
  });

  it.each(operationNames)("executes a valid %s operation", (type) => {
    const sample = samples[type]();
    expect(() => applyEditorOperation(sample.project ?? fixture(), sample.pageId ?? "home", sample.operation)).not.toThrow();
  });

  it("covers every registered tool with a real runtime sample", () => {
    expect(Object.keys(samples).sort()).toEqual(operationEntries.map(([type]) => type).sort());
  });

  it("adds missing collection-filter fields with a backward-compatible migration", () => {
    const sample = samples.compose_collection_filter();
    const updated = applyEditorOperation(sample.project!, sample.pageId ?? "home", sample.operation);
    expect(updated.dataSources[0]).toMatchObject({ schema: { status: "string" }, schemaVersion: 2 });
    expect(updated.dataSources[0].migrations?.at(-1)).toMatchObject({ version: 2, previousSchema: { id: "string", text: "string" }, nextSchema: { status: "string" } });
  });

  it("creates missing native filter controls and their reusable flows atomically", () => {
    const project = fixture();
    const updated = applyEditorOperation(project, "home", { type: "compose_collection_filter", args: {
      sourceId: "source", listComponentId: "list", counterLabel: "0 visible items", emptyMessage: "No items match.",
      filters: [{ field: "status", stateKey: "filters.status", label: "Status", options: "All statuses|Open|Done" }],
    } });
    expect(updated.pages[0].components).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "select", props: expect.objectContaining({ options: "All statuses|Open|Done" }) }),
      expect.objectContaining({ name: "Visible record counter" }),
      expect.objectContaining({ name: "Filtered empty state" }),
    ]));
    expect(updated.flows.map((flow) => flow.name)).toEqual(expect.arrayContaining(["Filter Items", "Set status filter"]));
  });

  it("keeps mixed transactions atomic when a later reference is invalid", () => {
    const project = fixture();
    expect(() => applyEditorOperation(project, "home", { type: "apply_editor_transaction", args: { operations: [
      { type: "set_component_property", args: { componentId: "title", property: "label", value: "Changed" } },
      { type: "reorder_component", args: { componentId: "button", afterComponentId: "missing" } },
    ] } })).toThrow("Invalid sibling target");
    expect(project.pages[0].components.find((item) => item.id === "title")?.props.label).not.toBe("Changed");
  });

  it("updates a complete flow by stable ID instead of duplicating it", () => {
    const project = fixture();
    const updated = applyEditorOperation(project, "home", { type: "create_flow", args: { flow: { id: "flow", name: "Simplified", nodes: [], edges: [] } } });
    expect(updated.flows).toHaveLength(1);
    expect(updated.flows[0]).toMatchObject({ id: "flow", name: "Simplified" });
  });

  it("reorders every source and destination combination by index and stable sibling IDs", () => {
    for (let size = 2; size <= 8; size += 1) for (let from = 0; from < size; from += 1) for (let to = 0; to < size; to += 1) {
      const project = createProject("Permutation");
      const components = Array.from({ length: size }, (_, index) => ({ ...makeComponent("text"), id: `item-${index}` }));
      project.pages.push({ id: "home", name: "Home", path: "/", components });
      const expected = components.map((item) => item.id), [moved] = expected.splice(from, 1); expected.splice(to, 0, moved);
      const indexed = applyEditorOperation(project, "home", { type: "reorder_component", args: { componentId: `item-${from}`, index: to } });
      expect(indexed.pages[0].components.map((item) => item.id)).toEqual(expected);
      if (to > 0) {
        const afterId = expected[to - 1];
        const stable = applyEditorOperation(project, "home", { type: "reorder_component", args: { componentId: `item-${from}`, afterComponentId: afterId } });
        expect(stable.pages[0].components.map((item) => item.id)).toEqual(expected);
      } else {
        const beforeId = expected[1];
        const stable = applyEditorOperation(project, "home", { type: "reorder_component", args: { componentId: `item-${from}`, beforeComponentId: beforeId } });
        expect(stable.pages[0].components.map((item) => item.id)).toEqual(expected);
      }
    }
  });
});
