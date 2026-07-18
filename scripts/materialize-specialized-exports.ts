import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateFiles } from "../src/generator";
import { createTemplateProject } from "../src/templates";

for (const template of ["landing", "dashboard"] as const) {
  const project = createTemplateProject(template, `Verified ${template}`);
  const button = project.pages.flatMap((page) => page.components).find((component) => component.type === "button")!;
  const flowId = `verified-${template}-flow`;
  button.events.click = flowId;
  project.flows.push({ id: flowId, name: "Azione verificata", nodes: [
    { id: "event", type: "event", label: "Click", position: { x: 0, y: 0 }, config: { trigger: "click", componentId: button.id } },
    { id: "ui", type: "updateUI", label: "Cambia testo", position: { x: 1, y: 0 }, config: { componentId: button.id, operation: "text", value: "Flow eseguito" } },
  ], edges: [{ id: "edge", source: "event", target: "ui", path: "success" }] });
  if (template === "dashboard" && !project.dataSources.length) project.dataSources.push({ id: "source", name: "Progetti", provider: "indexeddb", collection: "projects", schema: { id: "string", text: "string", date: "datetime" }, capabilities: ["get", "query", "insert", "update", "delete"], secretStrategy: "none" });
  const target = resolve("out", `experience-${template}`);
  await rm(target, { recursive: true, force: true });
  for (const [path, contents] of Object.entries(generateFiles(project))) {
    const file = resolve(target, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, contents, "utf8");
  }
}
