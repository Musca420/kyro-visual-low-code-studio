import { componentTree } from "./hierarchy";
import { parseProject, type Project } from "./model";
import { runtimeComponentHtml, type RuntimeProgram } from "./runtimeProgram";

const runtimeKeys = new Set([
  "contractVersion", "projectId", "graphRevision", "pages", "flows", "dataSources",
  "codeModules", "appConfig", "state", "theme", "bindings",
]);

const canonical = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]))
    : value;

const equal = (left: unknown, right: unknown) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

/** Application content that must survive an exact export/folder-import round trip. */
export function portableProjectSnapshot(input: Project) {
  const project = parseProject(structuredClone(input));
  return canonical({
    formatVersion: project.formatVersion,
    name: project.name,
    pages: project.pages,
    reusableComponents: project.reusableComponents,
    flows: project.flows,
    state: project.state,
    dataSources: project.dataSources,
    theme: project.theme,
    animations: project.animations,
    assets: project.assets,
    codeModules: project.codeModules,
    appConfig: project.appConfig,
    plugins: project.plugins,
    dependencies: project.dependencies,
    extensionApprovals: project.extensionApprovals,
    exportConfig: project.exportConfig,
  });
}

/** Runtime content without the intentionally new project identity of an imported copy. */
export function portableRuntimeSnapshot(runtime: RuntimeProgram) {
  return canonical({
    contractVersion: runtime.contractVersion,
    pages: runtime.pages,
    flows: runtime.flows,
    dataSources: runtime.dataSources,
    codeModules: runtime.codeModules,
    appConfig: runtime.appConfig,
    state: runtime.state,
    theme: runtime.theme,
    bindings: runtime.bindings,
  });
}

export function inspectProductConsistency(projectInput: Project, runtime: RuntimeProgram) {
  const project = parseProject(structuredClone(projectInput));
  const issues: string[] = [];
  if (runtime.projectId !== project.id || runtime.graphRevision !== project.revision)
    issues.push("Runtime identity does not match the verified Graph revision");

  const expectedPages = project.pages.map((page) => ({
    id: page.id,
    name: page.name,
    path: page.path,
    markup: componentTree(page.components).map(({ component, children }) => {
      const render = (branch: { component: Project["pages"][number]["components"][number]; children: typeof children }): string => runtimeComponentHtml(branch.component, branch.children.map(render).join("\n"));
      return render({ component, children });
    }).join("\n"),
    componentIds: page.components.map((component) => component.id),
    components: page.components,
  }));
  if (!equal(runtime.pages, expectedPages)) issues.push("Runtime pages or components differ from the Graph");
  if (!equal(runtime.flows, project.flows)) issues.push("Runtime flows differ from the Graph");
  if (!equal(runtime.dataSources, project.dataSources)) issues.push("Runtime data sources differ from the Graph");
  if (!equal(runtime.codeModules, project.codeModules)) issues.push("Runtime modules differ from the Graph");
  if (!equal(runtime.appConfig, project.appConfig) || !equal(runtime.state, project.state) || !equal(runtime.theme, project.theme))
    issues.push("Runtime application settings differ from the Graph");

  const bindings = project.pages.flatMap((page) => page.components.flatMap((component) =>
    Object.entries(component.events).map(([event, flowId]) => ({ componentId: component.id, event, flowId })),
  ));
  if (!equal(runtime.bindings, bindings)) issues.push("Runtime event bindings differ from the Graph");

  const unexpectedKeys = Object.keys(runtime).filter((key) => !runtimeKeys.has(key));
  if (unexpectedKeys.length) issues.push(`Runtime contains operational metadata: ${unexpectedKeys.join(", ")}`);
  return { passed: issues.length === 0, issues };
}

export function assertProductConsistency(project: Project, runtime: RuntimeProgram) {
  const report = inspectProductConsistency(project, runtime);
  if (!report.passed) throw new Error(`Product consistency failed: ${report.issues.join("; ")}`);
  return report;
}
