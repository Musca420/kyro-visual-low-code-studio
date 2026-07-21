import { z } from "zod";
import { componentIntentSchema, dataFieldTypes, flowNodeSchema, flowSchema } from "./model";

export const operationDomains = ["app", "design", "actions", "data", "extensions", "publish"] as const;
export const operationPlatforms = ["web", "pwa", "android", "desktop"] as const;
export type KyroOperationDomain = typeof operationDomains[number];
export type KyroOperationPlatform = typeof operationPlatforms[number];
export type OperationSupport = "stable" | "experimental" | "deprecated" | "disabled";
export type OperationEffect = "ui" | "state" | "data" | "network" | "filesystem" | "native" | "dependency";

type OperationDefinition = {
  domain: KyroOperationDomain;
  description: string;
  support: OperationSupport;
  platforms: readonly KyroOperationPlatform[];
  effects: readonly OperationEffect[];
  permissions: readonly string[];
  confirmation: boolean;
  args: z.ZodType;
  requires: readonly string[];
  verifies: readonly string[];
  limitations: readonly string[];
};

const domainEffects: Record<KyroOperationDomain, readonly OperationEffect[]> = {
  app: ["ui", "state"], design: ["ui"], actions: ["state"], data: ["data"], extensions: ["dependency"], publish: ["filesystem"],
};
const define = (domain: KyroOperationDomain, description: string, args: z.ZodType, options: Partial<Omit<OperationDefinition, "domain" | "description" | "args">> = {}): OperationDefinition => ({
  domain, description, args, support: "stable", platforms: operationPlatforms, effects: domainEffects[domain], permissions: ["graph:write"], confirmation: false,
  requires: [], verifies: ["graph.valid", "runtime.compiled"], limitations: [], ...options,
});
const id = z.string().trim().min(1);
const value = z.unknown();
const componentPropertyValue = z.union([z.string(), z.number(), z.boolean()]);
const componentProperties = z.record(z.string(), componentPropertyValue);
const record = z.record(z.string(), z.unknown());
const confirmed = z.literal(true);
const atLeastOne = <T extends z.ZodRawShape>(shape: T, keys: (keyof T & string)[]) => z.object(shape).refine((input) => keys.some((key) => (input as Record<string, unknown>)[key] !== undefined), { message: `Provide one of: ${keys.join(", ")}` });
const dataRecordSchema = z.record(z.string(), z.enum(dataFieldTypes));
const dataSourcePatchSchema = z.object({
  name: id.optional(), collection: id.optional(), provider: z.enum(["indexeddb", "rest", "generated"]).optional(),
  schema: dataRecordSchema.optional(), schemaVersion: z.number().int().positive().optional(),
  migrations: z.array(z.object({ version: z.number().int().positive(), createdAt: z.string().datetime(), previousSchema: dataRecordSchema, nextSchema: dataRecordSchema })).optional(),
  relations: z.array(z.object({ id, field: id, targetSourceId: id, targetField: id, kind: z.enum(["one", "many"]) })).optional(),
  capabilities: z.array(z.enum(["get", "query", "insert", "update", "delete", "subscribe"])).optional(),
  secretStrategy: z.enum(["none", "environment"]).optional(), endpoint: z.string().url().optional(), environmentKey: z.string().regex(/^[A-Z][A-Z0-9_]*$/).optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, { message: "Provide at least one data-source field" });

const flowNodeBase = {
  id, label: id,
  position: z.object({ x: z.number(), y: z.number() }).strict(),
};
const agentFlowNodeSchema = z.union([
  z.object({ ...flowNodeBase, type: z.literal("readInput"), config: z.object({ componentId: id.describe("Input component whose current value is read") }).strict() }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("validate"), config: z.object({
    field: z.string().optional().describe("Record field to validate; omit to validate the current scalar value"),
    rule: z.enum(["required", "email", "minLength", "maxLength", "min", "max"]),
    value: z.string().optional().describe("Expected threshold for rules other than required"),
    message: id,
  }).strict() }).strict(),
  z.object({ ...flowNodeBase, type: z.enum(["insert", "query", "update", "delete"]), config: z.object({
    sourceId: id.describe("Existing data-source ID"), mode: z.enum(["all", "one"]).optional(), id: z.string().optional(), field: z.string().optional(),
  }).strict() }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("refresh"), config: z.object({ componentId: id.describe("Bound component to refresh") }).strict() }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("notify"), config: z.object({ message: id, level: z.enum(["success", "info", "warning", "error"]).optional() }).strict() }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("setState"), config: z.object({ key: id }).strict() }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("filter"), config: z.object({ field: id, value: z.string().optional(), stateKey: id.optional() }).strict().refine((config) => config.value !== undefined || config.stateKey !== undefined, { message: "A filter needs value or stateKey" }) }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("kpi"), config: z.object({ operation: z.enum(["count", "sum", "average"]), field: z.string().optional() }).strict() }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("openModal"), config: z.object({ componentId: id, operation: z.enum(["open", "close"]).optional() }).strict() }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("updateUI"), config: z.object({ componentId: id, operation: z.enum(["show", "hide", "enable", "disable", "focus", "text", "value", "background", "color", "opacity", "data", "visibleWhenZero"]), value: z.string().optional() }).strict() }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("module"), config: z.object({ moduleId: id }).strict() }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("runFlow"), config: z.object({ flowId: id }).strict() }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("http"), config: z.object({ url: z.string().url(), method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(), body: z.string().optional() }).strict() }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("requestPermission"), config: z.object({ permission: id, rationale: z.string().optional() }).strict() }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("nativeAction"), config: z.object({ capability: id, action: id }).catchall(z.string()) }).strict(),
  z.object({ ...flowNodeBase, type: z.literal("platformCondition"), config: z.object({ platform: id, minVersion: z.string().optional(), maxVersion: z.string().optional() }).strict() }).strict(),
  flowNodeSchema.refine((node) => !["readInput", "validate", "insert", "query", "update", "delete", "refresh", "notify", "setState", "filter", "kpi", "openModal", "updateUI", "module", "runFlow", "http", "requestPermission", "nativeAction", "platformCondition"].includes(node.type), { message: "Use the registered configuration contract for this node type" }),
]);
const agentFlowSchema = flowSchema.extend({ nodes: z.array(agentFlowNodeSchema) });
const collectionFilterSchema = z.object({ componentId: id.optional(), field: id, stateKey: id, label: id.optional(), options: id.optional() }).strict();
const agentFlowConfigPatchSchema = z.object({
  componentId: id.optional(), sourceId: id.optional(), trigger: z.string().optional(), interval: z.string().optional(),
  field: z.string().optional(), rule: z.enum(["required", "email", "minLength", "maxLength", "min", "max"]).optional(), value: z.string().optional(), message: z.string().optional(),
  operator: z.enum(["equals", "notEquals", "contains", "exists", "greater", "less"]).optional(), cases: z.string().optional(), max: z.string().optional(),
  key: z.string().optional(), ms: z.string().optional(), template: z.string().optional(), url: z.string().url().optional(), method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(), body: z.string().optional(),
  maxMb: z.string().optional(), accept: z.string().optional(), roles: z.string().optional(), previewRole: z.string().optional(), mode: z.string().optional(), id: z.string().optional(),
  direction: z.enum(["asc", "desc"]).optional(), operation: z.string().optional(), title: z.string().optional(), delayMs: z.string().optional(), permission: z.string().optional(), rationale: z.string().optional(),
  capability: z.string().optional(), action: z.string().optional(), platform: z.string().optional(), minVersion: z.string().optional(), maxVersion: z.string().optional(), flowId: z.string().optional(), moduleId: z.string().optional(), level: z.enum(["success", "info", "warning", "error"]).optional(),
  breakpoint: z.enum(["true", "false"]).optional(), breakpointWhen: z.string().optional(), breakpointValue: z.string().optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, { message: "Provide at least one registered node configuration field" });
const agentFlowNodePatchSchema = atLeastOne({
  label: id.optional(), position: z.object({ x: z.number(), y: z.number() }).strict().optional(), config: agentFlowConfigPatchSchema.optional(),
}, ["label", "position", "config"]);

export const operationDefinitions = {
  add_page: define("app", "Add one page with a unique route.", z.object({ name: id, path: z.string().startsWith("/"), pageId: id.optional() })),
  update_page: define("app", "Change the name or route of an existing page.", atLeastOne({ pageId: id.optional(), name: id.optional(), path: z.string().startsWith("/").optional() }, ["name", "path"])),
  remove_page: define("app", "Remove one page and flows owned only by it.", z.object({ pageId: id.optional(), confirmed }), { confirmation: true, limitations: ["A project must retain at least one page"] }),
  add_component: define("design", "Add one native editable component to a page. Component properties are flat text, number, or boolean values; use bindings, flows, and data-source operations for structured behavior.", z.object({ componentId: id.optional(), componentType: id, name: id.optional(), props: componentProperties.optional(), styles: record.optional(), accessibility: record.optional(), intent: componentIntentSchema.partial().strict().optional(), parentId: z.string().nullable().optional() }), { verifies: ["graph.valid", "preview.rendered"] }),
  compose_screen: define("design", "Expand a screen description into native editable components.", z.object({ name: id.optional(), layout: id.optional(), expectedResult: z.string().optional(), replaceExisting: z.boolean().optional(), confirmed: z.boolean().optional(), theme: record.optional(), sections: z.array(record), navigation: z.array(record).optional(), states: z.boolean().optional() }), { verifies: ["graph.valid", "preview.rendered"], limitations: ["Uses only registered component types"] }),
  move_component: define("design", "Move or reparent an existing component.", atLeastOne({ componentId: id, parentId: z.string().nullable().optional(), x: value.optional(), y: value.optional(), index: z.number().int().nonnegative().optional() }, ["parentId", "x", "y", "index"]), { verifies: ["graph.valid", "preview.rendered"] }),
  resize_component: define("design", "Change the desktop width or height of one component.", atLeastOne({ componentId: id, width: value.optional(), height: value.optional() }, ["width", "height"]), { verifies: ["graph.valid", "preview.rendered"], limitations: ["Use responsive styles for breakpoint overrides"] }),
  reorder_component: define("design", "Reorder a component among siblings using an index or stable sibling ID.", atLeastOne({ componentId: id, index: z.number().int().nonnegative().optional(), beforeComponentId: id.optional(), afterComponentId: id.optional() }, ["index", "beforeComponentId", "afterComponentId"]), { verifies: ["graph.valid", "preview.rendered"] }),
  wrap_component: define("design", "Wrap one component in a registered container.", z.object({ componentId: id, componentType: id, name: id.optional() }), { verifies: ["graph.valid", "preview.rendered"] }),
  remove_component: define("design", "Remove a component and its descendants.", z.object({ componentId: id, confirmed }), { confirmation: true, verifies: ["graph.valid", "preview.rendered"] }),
  set_component_property: define("design", "Change one editable component property. The value must be text, a number, or a boolean; structured behavior belongs in bindings, flows, or data-source operations.", z.object({ componentId: id, property: id, value: componentPropertyValue }), { verifies: ["graph.valid", "preview.rendered"] }),
  set_component_style: define("design", "Change one desktop style property of an existing component.", z.object({ componentId: id, property: id, value: z.union([z.string(), z.number()]) }), { verifies: ["graph.valid", "preview.rendered"], limitations: ["Changes desktop style only", "Use set_responsive_style for tablet or mobile"] }),
  set_responsive_style: define("design", "Change one style at a selected breakpoint.", z.object({ componentId: id, breakpoint: z.enum(["desktop", "tablet", "mobile"]), property: id, value: z.union([z.string(), z.number()]) }), { verifies: ["graph.valid", "preview.rendered"] }),
  set_component_state_style: define("design", "Change one hover, focus, active or disabled style.", z.object({ componentId: id, state: z.enum(["hover", "focus", "active", "disabled"]), property: id, value: z.union([z.string(), z.number()]) }), { verifies: ["graph.valid", "preview.rendered"] }),
  set_component_accessibility: define("design", "Set an accessible label and optional role.", z.object({ componentId: id, label: id, role: id.optional() }), { verifies: ["graph.valid", "preview.rendered", "accessibility.named"] }),
  set_component_intent: define("design", "Attach typed product intent metadata to a component. requiredStates accepts only loading, success, or error; hover, focus, active, disabled, and enabled belong to visual state styles instead.", z.object({ componentId: id, intent: componentIntentSchema.partial().strict() }), { effects: ["state"], limitations: ["Does not directly change rendered pixels"] }),
  create_flow: define("actions", "Create a complete visual flow with registered nodes and explicit edges. A form submit event already supplies a record containing its named fields, so do not add readInput nodes for the form. Reuse or update an existing flow when it already covers the request. Use compose_collection_filter instead of inventing compound filter or UI-update configurations.", z.object({ flow: agentFlowSchema })),
  compose_record_action: define("actions", "Create a verified update or delete record flow.", z.object({ componentId: id, sourceId: id.optional(), entity: id.optional(), action: z.enum(["update", "delete"]) }), { effects: ["state", "data"] }),
  compose_collection_filter: define("actions", "Create or connect filter selects, a visible-record counter, and a no-match state for one bound list. Omit component IDs to let Kyro create native editable controls with stable IDs. Missing filter fields become optional strings with a backward-compatible migration. New filters require pipe-separated options beginning with All.", z.object({ sourceId: id, listComponentId: id, parentId: id.optional(), counterComponentId: id.optional(), counterLabel: id.optional(), emptyComponentId: id.optional(), emptyMessage: id.optional(), filters: z.array(collectionFilterSchema).min(1).max(8) }), { effects: ["ui", "state", "data"], verifies: ["graph.valid", "flow.executable", "preview.rendered"] }),
  compose_native_action: define("actions", "Create a registered native action flow with permission and feedback.", z.object({ componentId: id, event: id.optional(), capability: id, action: id, permission: id.optional(), resultComponentId: id.optional(), rationale: z.string().optional(), successMessage: z.string().optional(), errorMessage: z.string().optional() }), { platforms: ["web", "android"], effects: ["state", "native"], requires: ["native.action.registered"] }),
  add_flow: define("actions", "Add an empty reusable visual flow.", z.object({ flowId: id.optional(), name: id })),
  update_flow: define("actions", "Rename an existing visual flow.", z.object({ flowId: id, name: id })),
  remove_flow: define("actions", "Remove a flow and its component bindings.", z.object({ flowId: id, confirmed }), { confirmation: true }),
  add_flow_node: define("actions", "Add one registered node to an existing flow.", z.object({ flowId: id, node: agentFlowNodeSchema })),
  update_flow_node: define("actions", "Update one node without replacing the flow. Configuration values are strings; validation length uses rule minLength or maxLength with the threshold in value.", z.object({ flowId: id, nodeId: id, patch: agentFlowNodePatchSchema })),
  remove_flow_node: define("actions", "Remove one node and its connected edges.", z.object({ flowId: id, nodeId: id })),
  connect_nodes: define("actions", "Connect two nodes on a success or error path.", z.object({ flowId: id, source: id, target: id, path: z.enum(["success", "error"]).optional() })),
  remove_flow_edge: define("actions", "Remove one edge from a flow.", z.object({ flowId: id, edgeId: id })),
  set_component_event: define("actions", "Bind a component event to an executable flow.", z.object({ componentId: id, event: id, flowId: id }), { effects: ["ui", "state"], verifies: ["graph.valid", "flow.executable", "preview.rendered"] }),
  remove_component_event: define("actions", "Remove one component event binding.", z.object({ componentId: id, event: id })),
  create_data_source: define("data", "Create a typed local or remote data source. Schema values are exactly string, number, boolean, or datetime; record fields are optional unless a visual validation rule requires them.", z.object({ sourceId: id.optional(), name: id, provider: id, collection: id, schema: dataRecordSchema, endpoint: z.string().optional(), environmentKey: id.optional() }), { effects: ["data", "network"] }),
  update_data_source: define("data", "Update one existing data source. Schema values are exactly string, number, boolean, or datetime; adding a schema field does not make existing records invalid.", z.object({ sourceId: id, patch: dataSourcePatchSchema })),
  remove_data_source: define("data", "Remove a data source and clear its component bindings.", z.object({ sourceId: id, confirmed }), { confirmation: true }),
  bind_component_data: define("data", "Bind a component to a data source and view state.", z.object({ componentId: id, sourceId: id, state: z.enum(["data", "loading", "empty", "error"]).optional() }), { effects: ["ui", "data"], verifies: ["graph.valid", "binding.resolved", "preview.rendered"] }),
  create_code_module: define("extensions", "Create a typed module with passing examples.", z.object({ module: record }), { effects: ["state"], verifies: ["graph.valid", "module.tests.passed"] }),
  update_code_module: define("extensions", "Update a typed module and rerun its examples.", z.object({ moduleId: id, patch: record }), { effects: ["state"], verifies: ["graph.valid", "module.tests.passed"] }),
  remove_code_module: define("extensions", "Remove an unused typed module.", z.object({ moduleId: id, confirmed }), { confirmation: true, effects: ["state"] }),
  set_theme_token: define("design", "Set one project design token.", z.object({ token: id, value: id }), { verifies: ["graph.valid", "preview.rendered"] }),
  set_project_property: define("app", "Change one supported project-level property.", z.object({ property: id, value: id }), { limitations: ["Currently supports project name"] }),
  set_app_config: define("app", "Update project application configuration.", z.object({ patch: record })),
  set_export_config: define("publish", "Configure an export target without building or publishing it.", z.object({ patch: record }), { effects: ["state"], limitations: ["Does not generate files, install dependencies, build or publish"] }),
  approve_dependency: define("extensions", "Approve one exact dependency already required by the Graph.", z.object({ packageName: id, version: id, confirmed }), { confirmation: true, effects: ["dependency"], requires: ["dependency.requested"], limitations: ["Approval does not install the dependency"] }),
  revoke_dependency: define("extensions", "Revoke an existing dependency approval.", z.object({ packageName: id, confirmed }), { confirmation: true, effects: ["dependency"] }),
} as const satisfies Record<string, OperationDefinition>;

export type KyroOperationType = keyof typeof operationDefinitions;
export type KyroOperation = { type: KyroOperationType; pageId?: string; args: Record<string, unknown> };
export const operationNames = Object.keys(operationDefinitions) as KyroOperationType[];
export const operationNameSet = new Set<string>(operationNames);
export const operationEntries = Object.entries(operationDefinitions) as [KyroOperationType, OperationDefinition][];
export const operationPrompt = operationEntries.map(([name, definition]) => `${name}: ${definition.description}`).join("\n");

export function operationRequiresConfirmation(type: string) { return operationNameSet.has(type) && operationDefinitions[type as KyroOperationType].confirmation; }
export function validateOperationArguments(type: KyroOperationType, args: unknown) { return operationDefinitions[type].args.parse(args) as Record<string, unknown>; }

export const operationCatalog = operationEntries.map(([name, definition]) => ({
  name, domain: definition.domain, description: definition.description, support: definition.support,
  platforms: definition.platforms, effects: definition.effects, permissions: definition.permissions,
  confirmation: definition.confirmation, args: z.toJSONSchema(definition.args, { target: "draft-7", unrepresentable: "any" }),
  requires: definition.requires, verifies: definition.verifies, limitations: definition.limitations,
}));
