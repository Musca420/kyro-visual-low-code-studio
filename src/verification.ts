import { testCodeModule } from "./codeModules";
import type { EditorOperation } from "./editorOperations";
import { parseProject, serializeProject, type Project } from "./model";
import { compileRuntimeProgram, type RuntimeProgram } from "./runtimeProgram";
import { assertProductConsistency } from "./productConsistency";

export type VerificationStageName = "validation" | "runtime" | "behavior" | "visual" | "build";
export type TransactionEffect = "graph" | "runtime" | "behavior" | "visual" | "build";

export type VerificationEvidence = {
  kind: "graph" | "runtime" | "behavior" | "visual" | "build";
  summary: string;
  hash?: string;
};

export type VerificationStage = {
  name: VerificationStageName;
  required: boolean;
  status: "passed" | "failed" | "skipped";
  detail: string;
  evidence: VerificationEvidence[];
};

export type VerificationReport = {
  version: 1;
  status: "verified" | "failed";
  projectId: string;
  baseRevision: number;
  finalRevision?: number;
  startedAt: string;
  completedAt: string;
  effects: TransactionEffect[];
  stages: VerificationStage[];
};

export type VerificationAdapters = {
  runtime(project: Project): RuntimeProgram;
  behavior(project: Project, runtime: RuntimeProgram): string;
  visual(project: Project, runtime: RuntimeProgram): string;
  build(project: Project): string | Promise<string>;
};

const visualOperations = new Set([
  "add_page", "update_page", "remove_page", "add_component", "compose_screen",
  "move_component", "resize_component", "reorder_component", "wrap_component",
  "remove_component", "set_page_components", "set_component_property",
  "set_component_style", "set_responsive_style", "set_component_state_style",
  "set_component_accessibility", "set_component_intent", "set_theme_token",
  "set_theme_tokens", "set_project_assets", "set_reusable_components",
  "set_app_config",
]);
const behaviorOperations = new Set([
  "create_flow", "compose_record_action", "compose_native_action", "add_flow",
  "update_flow", "replace_flow", "remove_flow", "add_flow_node", "update_flow_node",
  "remove_flow_node", "connect_nodes", "remove_flow_edge", "set_project_flows",
  "set_component_event", "remove_component_event", "create_data_source",
  "update_data_source", "remove_data_source", "bind_component_data", "set_app_config", "set_flow_runs",
]);
const buildOperations = new Set([
  "set_export_config", "set_project_settings", "approve_dependency", "revoke_dependency",
  "create_code_module", "update_code_module", "remove_code_module", "set_code_modules",
  "set_project_plugins", "set_app_config",
]);
const graphOnlyOperations = new Set(["set_project_property"]);
const observableVisualOperations = new Set([
  "add_page", "update_page", "remove_page", "add_component", "compose_screen",
  "move_component", "resize_component", "reorder_component", "wrap_component",
  "remove_component", "set_page_components", "set_component_property",
  "set_component_style", "set_responsive_style", "set_component_state_style",
  "set_component_accessibility", "set_theme_token", "set_theme_tokens",
]);

const visualProjection = (project: Project) => ({
  theme: Object.fromEntries(["pageBackground", "pageBackgroundImage", "primary", "surface", "text", "accent"]
    .flatMap((token) => project.theme.tokens[token] === undefined ? [] : [[token, project.theme.tokens[token]]])),
  pages: project.pages.map((page) => ({ id: page.id, name: page.name, path: page.path, components: page.components.map((component) => ({
    id: component.id, name: component.name, type: component.type, parentId: component.parentId, props: component.props,
    styles: component.styles, states: component.states, accessibility: component.accessibility,
    events: component.events, intent: component.intent,
  })) })),
});

export function transactionEffects(operations: EditorOperation[]): TransactionEffect[] {
  const effects = new Set<TransactionEffect>(["graph", "runtime"]);
  for (const operation of operations) {
    if (visualOperations.has(operation.type)) effects.add("visual");
    if (behaviorOperations.has(operation.type)) effects.add("behavior");
    if (buildOperations.has(operation.type)) effects.add("build");
    if (!visualOperations.has(operation.type) && !behaviorOperations.has(operation.type) && !buildOperations.has(operation.type) && !graphOnlyOperations.has(operation.type)) {
      effects.add("behavior"); effects.add("visual"); effects.add("build");
    }
  }
  return [...effects];
}

const canonical = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
    : value;

async function hash(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const verificationAdapters: VerificationAdapters = {
  runtime: compileRuntimeProgram,
  behavior(project, runtime) {
    assertProductConsistency(project, runtime);
    const failingModules = project.codeModules.flatMap((module) => testCodeModule(module).filter((test) => !test.passed).map(() => module.name));
    if (failingModules.length) throw new Error(`Module tests failed: ${[...new Set(failingModules)].join(", ")}`);
    if (runtime.bindings.some((binding) => !runtime.flows.some((flow) => flow.id === binding.flowId)))
      throw new Error("Runtime contains an unresolved flow binding");
    for (const page of project.pages) for (const component of page.components) for (const flowId of Object.values(component.events)) {
      const flow = project.flows.find((item) => item.id === flowId);
      if (!flow?.nodes.some((node) => node.type === "event")) throw new Error(`Flow ${flowId} bound to ${component.id} has no executable event node`);
    }
    return `${runtime.flows.length} flows and ${runtime.bindings.length} bindings are structurally executable`;
  },
  visual(_project, runtime) {
    for (const page of runtime.pages)
      for (const componentId of page.componentIds)
        if (!page.markup.includes(`data-component="${componentId}"`))
          throw new Error(`Runtime markup is missing component ${componentId}`);
    return `${runtime.pages.length} pages and ${runtime.pages.reduce((total, page) => total + page.componentIds.length, 0)} components rendered`;
  },
  async build(project) {
    if (!project.pages.length) return "Project configuration is valid; no runnable page exists yet";
    if (project.appConfig.authentication.mode === "generated" && !project.dataSources.some((source) => source.provider === "generated"))
      return "Build preflight passed; export remains blocked until the guided backend is configured";
    const firstPage = project.pages[0];
    const legacyExperience = project.state.experience === "landing"
      || (project.state.experience === "dashboard" && project.pages.length === 1 && firstPage.components.some((component) => component.props.slot === "sidebar" || component.props.slot === "dashboard-title"));
    if (legacyExperience && !project.flows.length)
      return "Build preflight passed; export remains blocked until a visual flow is configured";
    const { generateFiles } = await import("./generator");
    const files = generateFiles(project);
    for (const required of ["package.json", "index.html", "src/main.ts", "runtime-program.json"])
      if (!files[required]) throw new Error(`Generated build is missing ${required}`);
    return `${Object.keys(files).length} generated files validated for ${project.exportConfig.target}`;
  },
};

export async function verifyProjectTransaction(
  before: Project,
  after: Project,
  operations: EditorOperation[],
  adapters: VerificationAdapters = verificationAdapters,
): Promise<VerificationReport> {
  const startedAt = new Date().toISOString();
  const effects = transactionEffects(operations);
  const stages: VerificationStage[] = [];
  let runtime: RuntimeProgram | undefined;

  const run = async (name: VerificationStageName, required: boolean, action: () => string | Promise<string>, evidenceValue: () => unknown) => {
    if (!required) {
      stages.push({ name, required, status: "skipped", detail: "No declared transaction effect requires this stage", evidence: [] });
      return;
    }
    try {
      const detail = await action();
      stages.push({ name, required, status: "passed", detail, evidence: [{ kind: name === "validation" ? "graph" : name, summary: detail, hash: await hash(evidenceValue()) }] });
    } catch (error) {
      stages.push({ name, required, status: "failed", detail: error instanceof Error ? error.message : String(error), evidence: [] });
    }
  };

  await run("validation", true, () => {
    parseProject(after);
    if (after.id !== before.id || after.revision !== before.revision + 1) throw new Error("Graph revision is not a single compatible increment");
    return `Graph revision ${before.revision} -> ${after.revision} is valid`;
  }, () => serializeProject(after));
  await run("runtime", true, () => {
    runtime = adapters.runtime(after);
    if (runtime.projectId !== after.id || runtime.graphRevision !== after.revision) throw new Error("Runtime does not match the verified Graph revision");
    return `RuntimeProgram v${runtime.contractVersion} compiled from revision ${runtime.graphRevision}`;
  }, () => runtime);
  await run("behavior", effects.includes("behavior"), () => adapters.behavior(after, runtime!), () => ({ flows: runtime!.flows, bindings: runtime!.bindings, dataSources: runtime!.dataSources }));
  await run("visual", effects.includes("visual"), () => {
    if (operations.some((operation) => observableVisualOperations.has(operation.type))
      && JSON.stringify(canonical(visualProjection(before))) === JSON.stringify(canonical(visualProjection(after))))
      throw new Error("The visual operation produced no observable render change");
    return adapters.visual(after, runtime!);
  }, () => ({ pages: runtime!.pages.map(({ id, markup }) => ({ id, markup })), projection: visualProjection(after) }));
  await run("build", effects.includes("build"), () => adapters.build(after), () => ({ exportConfig: after.exportConfig, dependencies: after.dependencies, approvals: after.extensionApprovals, modules: after.codeModules }));

  return {
    version: 1,
    status: stages.some((stage) => stage.required && stage.status !== "passed") ? "failed" : "verified",
    projectId: after.id,
    baseRevision: before.revision,
    finalRevision: after.revision,
    startedAt,
    completedAt: new Date().toISOString(),
    effects,
    stages,
  };
}

export function failedVerification(project: Project, operations: EditorOperation[], detail: string): VerificationReport {
  const timestamp = new Date().toISOString();
  return {
    version: 1, status: "failed", projectId: project.id, baseRevision: project.revision,
    startedAt: timestamp, completedAt: timestamp, effects: transactionEffects(operations),
    stages: [
      { name: "validation", required: true, status: "failed", detail, evidence: [] },
      ...(["runtime", "behavior", "visual", "build"] as VerificationStageName[]).map((name) => ({ name, required: false, status: "skipped" as const, detail: "Transaction did not pass validation", evidence: [] })),
    ],
  };
}
