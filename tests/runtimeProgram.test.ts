import { describe, expect, it } from "vitest";
import { generateFiles } from "../src/generator";
import { createProject, makeComponent } from "../src/model";
import {
  compileRuntimeProgram,
  exportRuntimeAdapter,
  previewRuntimeAdapter,
  runtimeComponentCss,
  runtimeComponentHtml,
} from "../src/runtimeProgram";

describe("immutable runtime program", () => {
  it("compiles the Graph deterministically without operational run history", () => {
    const project = createProject("Runtime contract");
    const button = makeComponent("button");
    button.id = "save";
    button.props.label = "Save";
    button.events.click = "save-flow";
    project.pages.push({ id: "home", name: "Home", path: "/", components: [button] });
    project.flows.push({ id: "save-flow", name: "Save", nodes: [], edges: [] });
    project.flowRuns.push({ id: "run-1", flowId: "save-flow", startedAt: new Date().toISOString(), durationMs: 1, logs: [] });

    const first = compileRuntimeProgram(project);
    const second = compileRuntimeProgram(project);

    expect(first).toEqual(second);
    expect(first.graphRevision).toBe(project.revision);
    expect(first.bindings).toEqual([{ componentId: "save", event: "click", flowId: "save-flow" }]);
    expect(JSON.stringify(first)).not.toContain("flowRuns");
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("uses the same component markup and styles for preview and export", () => {
    const project = createProject("Runtime parity");
    const card = makeComponent("card");
    card.id = "summary";
    card.props.label = "Summary";
    card.styles.desktop.background = "#101820";
    card.styles.desktop.padding = "24px";
    project.pages.push({ id: "home", name: "Home", path: "/", components: [card] });

    const program = compileRuntimeProgram(project);
    const files = generateFiles(project);

    expect(program.pages[0].markup).toBe(runtimeComponentHtml(card));
    expect(files["index.html"]).toContain(program.pages[0].markup);
    expect(files["src/style.css"]).toContain(runtimeComponentCss(program.pages[0].components[0], "desktop"));
    expect(JSON.parse(files["runtime-program.json"])).toEqual(program);
    expect(previewRuntimeAdapter.target).toBe("preview");
    expect(exportRuntimeAdapter("android").native).toBe("capacitor");
  });

  it("does not expose a container type placeholder when it wraps content", () => {
    const card = makeComponent("card");
    const title = makeComponent("title");
    title.props.label = "Visible title";
    const html = runtimeComponentHtml(card, runtimeComponentHtml(title));
    expect(html).toContain("Visible title");
    expect(html).not.toContain("<strong>card</strong>");
  });
});
