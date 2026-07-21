import { describe, expect, it } from "vitest";
import { applyProjectTransaction } from "../src/projectCore";
import { generateFiles } from "../src/generator";
import { importExistingFolder } from "../src/folderImport";
import { createProject, makeComponent, parseProject } from "../src/model";
import { inspectProductConsistency, portableProjectSnapshot, portableRuntimeSnapshot } from "../src/productConsistency";
import { compileRuntimeProgram } from "../src/runtimeProgram";

function application() {
  const project = createProject("Consistent application");
  const input = makeComponent("input"), button = makeComponent("button"), list = makeComponent("list");
  input.id = "task-name";
  button.id = "save-task";
  list.id = "task-list";
  button.events.click = "save-flow";
  list.binding = { sourceId: "tasks", state: "data" };
  project.pages.push({ id: "home", name: "Home", path: "/", components: [input, button, list] });
  project.flows.push({ id: "save-flow", name: "Save task", nodes: [], edges: [] });
  project.dataSources.push({ id: "tasks", name: "Tasks", provider: "indexeddb", collection: "tasks", schema: { title: "string", completed: "boolean" }, schemaVersion: 1, migrations: [], relations: [], capabilities: ["query", "insert", "update", "delete"], secretStrategy: "none" });
  project.state = { filter: "all" };
  project.theme.tokens.primary = "#16a6a1";
  project.animations.push({ id: "rise", name: "Rise", css: "opacity:1" });
  return parseProject(project);
}

describe("product consistency contract", () => {
  it("produces the same Graph for an equivalent manual and Codex transaction", () => {
    const base = application();
    const common = { projectId: base.id, pageId: "home", baseRevision: base.revision, operations: [{ type: "add_component", args: { componentType: "text", componentId: "shared-result", props: { label: "Shared result" } } }], timestamp: "2026-07-20T00:00:00.000Z" };
    const manual = applyProjectTransaction(base, { ...common, transactionId: "manual-private", actor: "manual", authorization: { kind: "user" } }).project;
    const codex = applyProjectTransaction(base, { ...common, transactionId: "codex-private", actor: "codex", authorization: { kind: "approved_job", jobId: "job-private" } }).project;
    expect(manual).toEqual(codex);
    expect(JSON.stringify(manual)).not.toContain("codex-private");
    expect(JSON.stringify(manual)).not.toContain("job-private");
  });

  it("keeps components, flows, Preview runtime and Export runtime identical", () => {
    const project = application(), runtime = compileRuntimeProgram(project), files = generateFiles(project);
    expect(inspectProductConsistency(project, runtime)).toEqual({ passed: true, issues: [] });
    expect(JSON.parse(files["runtime-program.json"])).toEqual(runtime);
    expect(files["index.html"]).toContain(runtime.pages[0].markup);
    for (const privateMarker of ["codex-private", "job-private", "transactionId", "authorization"])
      expect(Object.values(files).join("\n")).not.toContain(privateMarker);
  });

  it("round trips the portable application without loss or AI-only behavior", () => {
    const original = application(), files = generateFiles(original);
    const imported = importExistingFolder("consistent-export", [
      { path: "project.kyro.json", content: files["project.kyro.json"] },
      { path: "runtime-program.json", content: files["runtime-program.json"] },
      { path: "package.json", content: files["package.json"] },
    ]);
    expect(imported.id).not.toBe(original.id);
    expect(imported.name).toBe(original.name);
    expect(portableProjectSnapshot(imported)).toEqual(portableProjectSnapshot(original));
    expect(portableRuntimeSnapshot(compileRuntimeProgram(imported))).toEqual(portableRuntimeSnapshot(compileRuntimeProgram(original)));
    expect(generateFiles(imported)["index.html"]).toBe(files["index.html"]);
  });
});
