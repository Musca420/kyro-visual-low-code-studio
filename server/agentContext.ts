import { createHash } from "node:crypto";
import { redactSecrets } from "./security";

type Item = Record<string, unknown>;

export type AgentFocus = {
  kind: "project" | "page" | "component" | "flowNode" | "dataSource" | "runtimeError";
  pageId?: string;
  componentId?: string;
  flowId?: string;
  nodeId?: string;
  sourceId?: string;
  errorId?: string;
};

const object = (value: unknown): Item => value && typeof value === "object" && !Array.isArray(value) ? value as Item : {};
const array = (value: unknown): Item[] => Array.isArray(value) ? value.filter((item): item is Item => Boolean(item) && typeof item === "object") : [];
const withoutChildren = (item: Item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== "children"));
const componentReference = (item: Item) => Object.fromEntries(["id", "name", "type", "parentId", "props", "events", "binding", "accessibility", "intent"].flatMap((key) => item[key] === undefined ? [] : [[key, item[key]]]));
const flatten = (items: Item[]): Item[] => items.flatMap((item) => [withoutChildren(item), ...flatten(array(item.children))]);
const id = (value: unknown) => typeof value === "string" ? value : "";

function compact(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return value.slice(0, 2_000);
  if (typeof value !== "object" || value === null) return value;
  if (depth >= 7) return "[omitted]";
  if (Array.isArray(value)) return value.slice(0, 24).map((item) => compact(item, depth + 1));
  return Object.fromEntries(Object.entries(value).slice(0, 48).map(([key, item]) => [key, compact(item, depth + 1)]));
}

export function buildAgentContext(stateValue: unknown, focusValue: unknown) {
  const state = object(stateValue), requested = object(focusValue);
  const selectedIds = Array.isArray(state.selectedComponentIds) ? state.selectedComponentIds.map(id).filter(Boolean) : [];
  const focus: AgentFocus = {
    kind: ["project", "page", "component", "flowNode", "dataSource", "runtimeError"].includes(id(requested.kind))
      ? id(requested.kind) as AgentFocus["kind"]
      : selectedIds.length ? "component" : "page",
    pageId: id(requested.pageId) || id(state.pageId),
    componentId: id(requested.componentId) || selectedIds[0],
    flowId: id(requested.flowId), nodeId: id(requested.nodeId), sourceId: id(requested.sourceId), errorId: id(requested.errorId),
  };
  const tree = array(state.componentTree), components = flatten(tree), component = components.find((item) => id(item.id) === focus.componentId);
  const parent = component?.parentId ? components.find((item) => id(item.id) === id(component.parentId)) : undefined;
  const children = component ? components.filter((item) => id(item.parentId) === id(component.id)).slice(0, 12) : [];
  const siblings = component ? components.filter((item) => id(item.id) !== id(component.id) && id(item.parentId) === id(component.parentId)).slice(0, 8) : [];
  const events = object(component?.events), directFlowIds = new Set(Object.values(events).map(id).filter(Boolean));
  for (const flowId of Object.values(object(parent?.events)).map(id).filter(Boolean)) directFlowIds.add(flowId);
  const allFlows = array(state.flows);
  for (const flow of allFlows) if (array(flow.nodes).some((node) => id(object(node.config).componentId) === focus.componentId)) directFlowIds.add(id(flow.id));
  const flows = allFlows.filter((flow) => directFlowIds.has(id(flow.id)) || id(flow.id) === focus.flowId).slice(0, 12);
  const sourceIds = new Set<string>();
  const binding = object(component?.binding); if (id(binding.sourceId)) sourceIds.add(id(binding.sourceId));
  for (const flow of flows) for (const node of array(flow.nodes)) if (id(object(node.config).sourceId)) sourceIds.add(id(object(node.config).sourceId));
  if (focus.sourceId) sourceIds.add(focus.sourceId);
  const allSources = array(state.dataSources), dataSources = allSources.filter((source) => sourceIds.has(id(source.id)));
  const relatedRoots = new Set(flows.flatMap((flow) => array(flow.nodes).map((node) => id(object(node.config).componentId))).filter(Boolean));
  for (const item of components) if (sourceIds.has(id(object(item.binding).sourceId))) relatedRoots.add(id(item.id));
  const relatedComponents = components.filter((item) => {
    let current: Item | undefined = item;
    while (current) {
      if (relatedRoots.has(id(current.id))) return true;
      current = components.find((candidate) => id(candidate.id) === id(current?.parentId));
    }
    return false;
  }).slice(0, 24);
  const candidates = sourceIds.size ? [] : allSources.slice(0, 24).map((source) => ({ id: source.id, name: source.name, provider: source.provider, collection: source.collection }));
  const base = redactSecrets(compact({
    schemaVersion: 1,
    project: state.project ?? { id: state.projectId, revision: state.revision },
    focus,
    viewport: state.viewport,
    previewState: state.previewState,
    selection: component ? { ...withoutChildren(component), bounds: object(state.layouts)[id(component.id)] ?? null } : null,
    dependencies: {
      parent: parent ? componentReference(parent) : null,
      children: children.map(componentReference),
      siblings: siblings.map(componentReference),
      relatedComponents: relatedComponents.map(componentReference),
      flows,
      dataSources,
      candidateDataSources: candidates,
    },
    pages: state.pages ?? [],
    capabilities: state.capabilities ?? [],
    globalCapabilities: state.globalCapabilities ?? [],
    runtime: { validationErrors: state.validationErrors ?? [], consoleErrors: state.consoleErrors ?? [] },
  })) as Item;
  let json = JSON.stringify(base);
  if (Buffer.byteLength(json) > 24_000) {
    const dependencies = object(base.dependencies);
    dependencies.siblings = [];
    dependencies.candidateDataSources = [];
    json = JSON.stringify(base);
  }
  if (Buffer.byteLength(json) > 24_000) throw new Error("The indexed Kyro context exceeds the 24 KB safety limit.");
  return { ...base, contextBytes: Buffer.byteLength(json), contextHash: createHash("sha256").update(json).digest("hex") };
}
