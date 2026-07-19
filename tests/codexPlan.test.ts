import { describe, expect, it } from "vitest";
import { approvedOperations, quickCrudFlowsPlan, quickCrudSurfacePlan, quickDailyFlowScreenPlan, quickDashboardPlan, quickHabitsPlan, quickNavigationFlowPlan, quickStructurePlan, quickVisualPlan } from "../server/codexPlan";

describe("approved Codex plan", () => {
  it("estrae solo una lista compatta di operazioni tipizzate", () => {
    expect(approvedOperations('Piano\nFRONTEND_EDITOR_OPERATIONS=[{"type":"set_responsive_style","args":{"componentId":"title","breakpoint":"mobile","property":"lineHeight","value":"1.1"}}]')).toHaveLength(1);
    expect(approvedOperations("FRONTEND_EDITOR_OPERATIONS=not-json")).toBeUndefined();
    expect(approvedOperations(`FRONTEND_EDITOR_OPERATIONS=${JSON.stringify(Array.from({ length: 51 }, () => ({ type: "add_component" })))}`)).toBeUndefined();
  });

  it("risolve localmente una modifica visuale semplice", () => {
    const plan = quickVisualPlan("Sfondo #123B5D e interlinea 1.1 su desktop, tablet e mobile", { componentId: "title", componentName: "Titolo", pageId: "home" });
    const operations = approvedOperations(plan);
    expect(operations).toHaveLength(6);
    expect(operations?.[0]).toMatchObject({ type: "set_responsive_style", args: { componentId: "title", breakpoint: "desktop", property: "background", value: "#123B5D" } });
  });

  it("risolve la struttura di un'app senza invocare il modello", () => {
    const plan = quickStructurePlan(
      "Rinomina la pagina Home in Oggi e Profilo in Impostazioni. Aggiungi le pagine Onboarding, Calendario, Dettaglio attività, Abitudini e Statistiche, con percorsi chiari. Configura Android offline-first, tema chiaro e scuro, safe area e navigazione inferiore mobile.",
      {
        projectName: "DailyFlow",
        pages: [
          { id: "home", name: "Home", path: "/" },
          { id: "tasks", name: "Attività", path: "/attivita" },
          { id: "profile", name: "Profilo", path: "/profilo" },
        ],
        exportTarget: "android",
      },
    );
    const operations = approvedOperations(plan);
    expect(operations).toHaveLength(8);
    expect(operations).toContainEqual({ type: "update_page", pageId: "profile", args: { name: "Impostazioni", path: "/impostazioni" } });
    expect(operations).toContainEqual({ type: "add_page", args: { name: "Dettaglio attività", path: "/attivita/:id" } });
    expect(operations?.at(-1)?.args?.patch).toMatchObject({ offline: true, safeArea: true, themeMode: "system" });
  });

  it("non intercetta una richiesta di composizione visuale", () => {
    expect(quickStructurePlan("Trasforma la pagina Oggi e aggiungi una navigazione inferiore", {
      pages: [{ id: "home", name: "Oggi", path: "/oggi" }],
    })).toBeUndefined();
  });

  it("crea un flow di navigazione dal componente e dalle pagine indicizzate", () => {
    const operations = approvedOperations(quickNavigationFlowPlan("Al click apri la schermata Dettaglio", {
      componentId: "open-detail",
      componentName: "Apri dettaglio",
      pageId: "home",
      pages: [
        { id: "home", name: "Home", path: "/" },
        { id: "detail", name: "Dettaglio", path: "/dettaglio" },
      ],
      flowIndex: [],
    }));
    expect(operations).toHaveLength(5);
    expect(operations).toContainEqual(expect.objectContaining({ type: "add_flow_node", args: expect.objectContaining({ node: expect.objectContaining({ type: "navigate", config: { mode: "page", path: "/dettaglio" } }) }) }));
    expect(operations?.at(-1)).toMatchObject({ type: "set_component_event", pageId: "home", args: { componentId: "open-detail", event: "click" } });
  });

  it("compone una dashboard mobile dall'indice dei componenti", () => {
    const pageComponents = [
      { id: "head", name: "Header", type: "header", events: [], bound: false },
      { id: "hero", name: "Hero", type: "hero", events: [], bound: false },
      { id: "grid", name: "Grid", type: "grid", events: [], bound: false },
      ...[1, 2, 3].map((id) => ({ id: `card-${id}`, name: `Card ${id}`, type: "card", events: [], bound: false })),
      { id: "foot", name: "Footer", type: "footer", events: [], bound: false },
    ];
    const plan = quickDashboardPlan("Trasforma la pagina in una dashboard mobile con #16A6A1 e #FF725E", { projectName: "DailyFlow", pageComponents });
    const operations = approvedOperations(plan);
    expect(operations).toHaveLength(49);
    expect(operations).toContainEqual(expect.objectContaining({ type: "add_component", args: expect.objectContaining({ componentType: "progress" }) }));
    expect(operations?.at(-1)).toMatchObject({ type: "set_component_state_style", args: { componentId: "quick-add-head", state: "focus" } });
  });

  it("prepara la superficie CRUD locale delle attivita", () => {
    const pageComponents = [
      { id: "head", name: "Header", type: "header" }, { id: "section", name: "Section", type: "section" }, { id: "grid", name: "Grid", type: "grid" },
      ...[1, 2, 3].map((id) => ({ id: `card-${id}`, name: `Card ${id}`, type: "card" })),
    ];
    const operations = approvedOperations(quickCrudSurfacePlan("Prepara attività con sorgente locale IndexedDB, form e lista senza flow", { projectName: "Workboard", pageComponents, dataSources: [] }));
    expect(operations).toHaveLength(27);
    expect(operations).toContainEqual(expect.objectContaining({ type: "create_data_source", args: expect.objectContaining({ sourceId: "workboard-tasks", name: "Attività" }) }));
    expect(operations?.at(-1)).toMatchObject({ type: "bind_component_data", args: { componentId: "tasks-list", sourceId: "workboard-tasks" } });
  });

  it("compone una schermata DailyFlow dal componente selezionato", () => {
    const operations = approvedOperations(quickDailyFlowScreenPlan("Crea la schermata completa e mobile", {
      pageId: "habits",
      componentId: "root",
      componentType: "section",
      pages: [{ id: "habits", name: "Abitudini", path: "/abitudini" }],
      pageComponents: [{ id: "root", name: "Sezione", type: "section" }],
    }));
    expect(operations?.length).toBeGreaterThan(10);
    expect(operations).toContainEqual(expect.objectContaining({ type: "add_component", args: expect.objectContaining({ componentId: "habit-add", componentType: "button", parentId: "root" }) }));
    expect(operations?.filter((operation) => operation.type === "set_responsive_style")).toHaveLength(6);
  });

  it("sostituisce i soli contenitori iniziali senza rimuovere due volte i figli", () => {
    const operations = approvedOperations(quickDailyFlowScreenPlan("Crea la schermata completa e mobile", {
      pageId: "settings",
      componentId: "settings-child",
      componentType: "checkbox",
      pages: [{ id: "settings", name: "Impostazioni", path: "/impostazioni" }],
      pageComponents: [
        { id: "profile", name: "Profilo", type: "section" },
        { id: "settings-child", name: "Modalità offline", type: "checkbox", parentId: "profile" },
        { id: "grid", name: "Profilo grid", type: "grid" },
        { id: "card", name: "In evidenza", type: "card", parentId: "grid" },
        { id: "orphan", name: "Profilo card 1", type: "card" },
      ],
    }));
    expect(operations).toContainEqual({ type: "remove_component", args: { componentId: "grid", confirmed: true } });
    expect(operations).not.toContainEqual({ type: "remove_component", args: { componentId: "card", confirmed: true } });
    expect(operations).toContainEqual({ type: "remove_component", args: { componentId: "orphan", confirmed: true } });
    expect(operations).toContainEqual({ type: "set_component_property", args: { componentId: "profile", property: "name", value: "Impostazioni" } });
  });

  it("collega i flow di caricamento e creazione delle attivita", () => {
    const operations = approvedOperations(quickCrudFlowsPlan("Collega i flow: carica al pageLoad e crea o salva attività dal form", {
      pageComponents: [{ id: "tasks-form", type: "form" }, { id: "tasks-list", type: "list" }],
      dataSources: [{ id: "dailyflow-tasks", name: "Attività DailyFlow" }],
      flowIndex: [],
    }));
    expect(operations).toHaveLength(27);
    expect(operations).toContainEqual({ type: "set_component_event", args: { componentId: "tasks-form", event: "submit", flowId: "tasks-create" } });
    expect(operations?.filter((operation) => operation.type === "connect_nodes").some((operation) => operation.args?.path === "error")).toBe(true);
  });

  it("risolve localmente dati e flow delle abitudini", () => {
    const operations = approvedOperations(quickHabitsPlan("Rendi Abitudini funzionante con sorgente IndexedDB e flow visuali", {
      projectName: "Routine Coach",
      componentId: "habit-add",
      pageComponents: [
        { id: "root", name: "Abitudini", type: "section" },
        { id: "habit-name", name: "Nome", type: "input", parentId: "root" },
        { id: "habit-add", name: "Aggiungi", type: "button", parentId: "root" },
        { id: "habit-water", name: "Acqua", type: "card", parentId: "root" },
      ],
      dataSources: [], flowIndex: [],
    }));
    expect(operations?.length).toBeLessThanOrEqual(50);
    expect(operations).toContainEqual(expect.objectContaining({ type: "create_data_source", args: expect.objectContaining({ sourceId: "routine-coach-habits" }) }));
    expect(operations).toContainEqual({ type: "set_component_event", args: { componentId: "habits-form", event: "submit", flowId: "habits-create" } });
    expect(operations?.filter((operation) => operation.type === "add_flow")).toHaveLength(3);
  });
});
