import { describe, expect, it } from "vitest";
import { createProject, makeComponent } from "../src/model";
import { inspectComponentProgram, inspectDataSourceProgram, inspectFlowNodeProgram } from "../src/programGraph";

describe("unified program graph", () => {
  it("rileva dati, flow e stati mancanti a partire dall'intento visuale", () => {
    const project = createProject("Graph");
    const list = makeComponent("list");
    list.intent = {
      role: "risultato principale",
      action: "mostra atleti",
      entity: "Athlete",
      expectedResult: "lista aggiornata",
      requiredStates: ["loading", "error"],
      permissions: [],
    };
    project.pages.push({ id: "page", name: "Home", path: "/", components: [list] });
    const view = inspectComponentProgram(project, "page", list.id);
    expect(view.issues.map((issue) => issue.id)).toEqual([
      "data-binding",
      "state-loading",
      "state-error",
    ]);
    expect(view.generatedFiles).toContain("project.frontend-editor.json");
  });

  it("attraversa eventi, flow e sorgenti collegati", () => {
    const project = createProject("Connected");
    const button = makeComponent("button");
    const list = makeComponent("list");
    project.dataSources.push({
      id: "source",
      name: "Atleti",
      provider: "indexeddb",
      collection: "athletes",
      schema: { id: "string", name: "string" },
      capabilities: ["get", "query", "insert", "update", "delete", "subscribe"],
      secretStrategy: "none",
    });
    project.flows.push({ id: "flow", name: "Crea atleta", nodes: [], edges: [] });
    button.events.click = "flow";
    list.binding = { sourceId: "source", state: "data" };
    project.pages.push({ id: "page", name: "Home", path: "/", components: [button, list] });
    expect(inspectComponentProgram(project, "page", button.id).events[0].flowName).toBe("Crea atleta");
    expect(inspectComponentProgram(project, "page", list.id).dataSources[0].name).toBe("Atleti");
    expect(inspectComponentProgram(project, "page", list.id).issues).toHaveLength(0);
  });

  it("risale dal nodo a componente, dato e file generato", () => {
    const project = createProject("Reverse");
    const list = makeComponent("list");
    list.binding = { sourceId: "source", state: "data" };
    project.pages.push({ id: "page", name: "Home", path: "/", components: [list] });
    project.dataSources.push({ id: "source", name: "Atleti", provider: "generated", collection: "athletes", schema: { id: "string" }, capabilities: ["query"], secretStrategy: "none", endpoint: "http://127.0.0.1:8787/records" });
    project.flows.push({ id: "flow", name: "Carica", nodes: [{ id: "query", type: "query", label: "Leggi atleti", position: { x: 0, y: 0 }, config: { sourceId: "source" } }], edges: [] });
    const view = inspectFlowNodeProgram(project, "flow", "query");
    expect(view.dataSources[0].name).toBe("Atleti");
    expect(view.components[0].id).toBe(list.id);
    expect(view.generatedFiles).toContain("server/index.mjs");
    expect(view.errors).toEqual([]);
  });

  it("risale dalla sorgente a binding, flow e file", () => {
    const project = createProject("Source graph");
    const list = makeComponent("list");
    list.binding = { sourceId: "source", state: "data" };
    project.pages.push({ id: "page", name: "Home", path: "/", components: [list] });
    project.dataSources.push({ id: "source", name: "Atleti", provider: "indexeddb", collection: "athletes", schema: { id: "string", name: "string" }, capabilities: ["query", "insert"], secretStrategy: "none" });
    project.flows.push({ id: "flow", name: "Crea atleta", nodes: [{ id: "insert", type: "insert", label: "Salva atleta", position: { x: 0, y: 0 }, config: { sourceId: "source" } }], edges: [] });
    const view = inspectDataSourceProgram(project, "source");
    expect(view.components[0]).toMatchObject({ id: list.id, pageName: "Home" });
    expect(view.flows[0]).toMatchObject({ id: "flow", nodes: ["Salva atleta"] });
    expect(view.fields).toContainEqual({ name: "name", type: "string" });
  });

  it("spiega prerequisiti costi e alternative prima di una capacità esterna", () => {
    const project = createProject("Resolver");
    const button = makeComponent("button");
    button.intent.expectedResult = "completa pagamento checkout";
    project.pages.push({ id: "page", name: "Home", path: "/", components: [button] });
    const payment = inspectComponentProgram(project, "page", button.id).issues.find((issue) => issue.id === "payment-provider");
    expect(payment?.plan?.requirements).toContain("Webhook HTTPS per confermare l'esito");
    expect(payment?.plan?.alternatives).toContain("Modalità demo senza addebiti reali");
    expect(payment?.plan?.confirmationRequired).toBe(true);
  });
});
