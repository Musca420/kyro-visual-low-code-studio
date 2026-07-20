import { describe, expect, it } from "vitest";
import { approvedOperations, quickBindingPlan, quickCrudFlowsPlan, quickCrudSurfacePlan, quickDailyFlowScreenPlan, quickDashboardPlan, quickDataViewsPlan, quickFormCrudPlan, quickHabitsPlan, quickLocalNotificationPlan, quickNavigationFlowPlan, quickStructurePlan, quickVisualPlan } from "../server/codexPlan";

describe("approved Codex plan", () => {
  it("collega una vista alla sorgente semanticamente corrispondente", () => {
    const operations = approvedOperations(quickBindingPlan("Connect Booking list to the data it needs", {
      pageId: "bookings-page", componentId: "booking-list", componentName: "Booking list", componentType: "list",
      dataSources: [{ id: "users", name: "Users", collection: "users" }, { id: "bookings", name: "Bookings", collection: "bookings" }],
    }));
    expect(operations).toEqual([{ type: "bind_component_data", pageId: "bookings-page", args: { componentId: "booking-list", sourceId: "bookings", state: "data" } }]);
  });

  it("non indovina un binding ambiguo", () => {
    expect(quickBindingPlan("Connect this list to data", {
      pageId: "page", componentId: "items", componentName: "Items", componentType: "list",
      dataSources: [{ id: "users", name: "Users" }, { id: "services", name: "Services" }],
    })).toBeUndefined();
  });

  it("crea un flow CRUD generico dal form e dalla sorgente nominata", () => {
    const operations = approvedOperations(quickFormCrudPlan("Create a submit flow to save Reviews data and validate rating", {
      pageId: "reviews-page", componentId: "review-form", componentName: "Review form", componentType: "form",
      pageComponents: [{ id: "review-form", name: "Review form", type: "form" }, { id: "rating", name: "Review rating", type: "select", parentId: "review-form" }, { id: "review-list", name: "Review list", type: "list" }],
      dataSources: [{ id: "reviews", name: "Reviews", collection: "reviews", schema: { id: "string", rating: "number", comment: "string" } }], flowIndex: [],
    }));
    expect(operations).toContainEqual(expect.objectContaining({ type: "add_flow", args: { flowId: "create-reviews", name: "Create Reviews" } }));
    expect(operations).toContainEqual(expect.objectContaining({ type: "add_flow_node", args: expect.objectContaining({ flowId: "create-reviews", node: expect.objectContaining({ type: "validate", config: expect.objectContaining({ field: "rating" }) }) }) }));
    expect(operations?.at(-1)).toEqual({ type: "set_component_event", pageId: "reviews-page", args: { componentId: "review-form", event: "submit", flowId: "create-reviews" } });
  });

  it("collega grafici e KPI alle sorgenti in base allo schema, non al nome del progetto", () => {
    const operations = approvedOperations(quickDataViewsPlan("Rendi statistiche e grafici dinamici con i dati reali", {
      pageId: "insights", pageComponents: [
        { id: "done", name: "Completate", type: "card" }, { id: "open", name: "Aperte", type: "card" }, { id: "streak", name: "Serie", type: "card" },
        { id: "tasks-chart", name: "Andamento", type: "chart" }, { id: "habits-chart", name: "Costanza", type: "chart" },
      ], dataSources: [
        { id: "work", schema: { dueDate: "date", status: "string", completed: "boolean" } },
        { id: "routines", schema: { completedToday: "boolean", currentStreak: "number", bestStreak: "number" } },
      ], flowIndex: [],
    }));
    expect(operations).toContainEqual(expect.objectContaining({ type: "bind_component_data", args: { componentId: "tasks-chart", sourceId: "work", state: "data" } }));
    expect(operations).toContainEqual(expect.objectContaining({ type: "bind_component_data", args: { componentId: "habits-chart", sourceId: "routines", state: "data" } }));
    expect(operations).toContainEqual(expect.objectContaining({ type: "set_component_property", args: { componentId: "streak", property: "metric", value: "maxStreak" } }));
  });
  it("usa l'agenda interna del calendario senza duplicare tutti i record in una lista", () => {
    const operations = approvedOperations(quickDataViewsPlan("Collega il calendario ai dati reali", {
      pageId: "calendar", pageComponents: [{ id: "calendar-main", name: "Agenda", type: "calendar" }, { id: "all-items", name: "Elenco", type: "list" }],
      dataSources: [{ id: "events", schema: { dueDate: "datetime", title: "string" } }], flowIndex: [],
    }));
    expect(operations).toContainEqual(expect.objectContaining({ type: "bind_component_data", args: { componentId: "calendar-main", sourceId: "events", state: "data" } }));
    expect(operations).not.toContainEqual(expect.objectContaining({ type: "bind_component_data", args: expect.objectContaining({ componentId: "all-items" }) }));
  });
  it("limita alla pagina corrente anche un flow automatico già esistente", () => {
    const operations = approvedOperations(quickDataViewsPlan("Collega il calendario ai dati reali", {
      pageId: "calendar", pageComponents: [{ id: "calendar-main", name: "Agenda", type: "calendar" }],
      dataSources: [{ id: "events", schema: { dueDate: "datetime", title: "string" } }],
      flowIndex: [{ id: "load-views-calendar" }],
    }));
    expect(operations).toContainEqual({
      type: "update_flow_node",
      args: { flowId: "load-views-calendar", nodeId: "load-views-calendar-event", patch: { config: { pageId: "calendar" } } },
    });
  });
  it("crea una notifica locale generica dal componente selezionato", () => {
    const operations = approvedOperations(quickLocalNotificationPlan("Quando lo attivo programma una notifica locale tra 2 secondi con titolo Promemoria e testo La giornata ti aspetta", {
      componentId: "notifications-toggle", componentName: "Promemoria", componentType: "checkbox", pageId: "settings", flowIndex: [],
    }));
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "add_flow_node", args: expect.objectContaining({ node: expect.objectContaining({ type: "localNotification", config: expect.objectContaining({ delayMs: "2000" }) }) }) }),
      expect.objectContaining({ type: "set_component_event", args: expect.objectContaining({ componentId: "notifications-toggle", event: "change" }) }),
    ]));
  });
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
    const plan = quickDashboardPlan("Transform this page into a dashboard mobile with #16A6A1 and #FF725E", { projectName: "DailyFlow", pageComponents });
    const operations = approvedOperations(plan);
    expect(operations).toHaveLength(47);
    expect(operations).toContainEqual(expect.objectContaining({ type: "add_component", args: expect.objectContaining({ componentType: "progress" }) }));
    expect(operations?.at(-1)).toMatchObject({ type: "set_component_state_style", args: { componentId: "quick-add-head", state: "focus" } });
  });

  it("non applica scorciatoie DailyFlow ad altri prodotti", () => {
    const context = {
      projectName: "NexusField Mobile",
      pageId: "home",
      componentId: "header",
      componentType: "header",
      pageComponents: [
        { id: "header", type: "header", name: "Header" },
        { id: "hero", type: "hero", name: "Hero" },
        { id: "grid", type: "grid", name: "Grid" },
        { id: "card-1", type: "card", name: "Card 1", parentId: "grid" },
        { id: "card-2", type: "card", name: "Card 2", parentId: "grid" },
        { id: "card-3", type: "card", name: "Card 3", parentId: "grid" },
        { id: "footer", type: "footer", name: "Footer" },
      ],
      pages: [{ id: "home", name: "Calendar", path: "/calendar" }],
    };
    expect(quickDashboardPlan("Create a mobile dashboard", context)).toBeUndefined();
    expect(quickDailyFlowScreenPlan("Create the complete page", context)).toBeUndefined();
  });

  it("prepara la superficie CRUD locale delle attivita", () => {
    const pageComponents = [
      { id: "head", name: "Header", type: "header" }, { id: "section", name: "Section", type: "section" }, { id: "grid", name: "Grid", type: "grid" },
      ...[1, 2, 3].map((id) => ({ id: `card-${id}`, name: `Card ${id}`, type: "card" })),
    ];
    const operations = approvedOperations(quickCrudSurfacePlan("Create a task form and list connected to a database with local IndexedDB", { projectName: "Workboard", pageComponents, dataSources: [] }));
    expect(operations).toHaveLength(27);
    expect(operations).toContainEqual(expect.objectContaining({ type: "create_data_source", args: expect.objectContaining({ sourceId: "workboard-tasks", name: "Tasks" }) }));
    expect(operations?.at(-1)).toMatchObject({ type: "bind_component_data", args: { componentId: "tasks-list", sourceId: "workboard-tasks" } });
  });

  it("compone una schermata DailyFlow dal componente selezionato", () => {
    const operations = approvedOperations(quickDailyFlowScreenPlan("Create the complete mobile screen", {
      projectName: "DailyFlow",
      pageId: "habits",
      componentId: "root",
      componentType: "section",
      pages: [{ id: "habits", name: "Habits", path: "/habits" }],
      pageComponents: [{ id: "root", name: "Sezione", type: "section" }],
    }));
    expect(operations?.length).toBeGreaterThan(10);
    expect(operations).toContainEqual(expect.objectContaining({ type: "add_component", args: expect.objectContaining({ componentId: "habit-add", componentType: "button", parentId: "root" }) }));
    expect(operations?.filter((operation) => operation.type === "set_responsive_style")).toHaveLength(6);
  });

  it("sostituisce i soli contenitori iniziali senza rimuovere due volte i figli", () => {
    const operations = approvedOperations(quickDailyFlowScreenPlan("Crea la schermata completa e mobile", {
      projectName: "DailyFlow",
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
    expect(operations).toContainEqual({ type: "set_component_property", args: { componentId: "profile", property: "name", value: "Settings" } });
  });

  it("collega i flow di caricamento e creazione delle attivita", () => {
    const operations = approvedOperations(quickCrudFlowsPlan("Create flows: load tasks on page load and create or save tasks from the form", {
      pageComponents: [{ id: "tasks-form", type: "form" }, { id: "tasks-list", type: "list" }],
      dataSources: [{ id: "dailyflow-tasks", name: "Attività DailyFlow" }],
      flowIndex: [],
    }));
    expect(operations).toHaveLength(49);
    expect(operations).toContainEqual({ type: "set_component_event", args: { componentId: "tasks-form", event: "submit", flowId: "tasks-create" } });
    expect(operations).toContainEqual({ type: "set_component_event", args: { componentId: "tasks-list", event: "recordUpdate", flowId: "tasks-update" } });
    expect(operations).toContainEqual({ type: "set_component_event", args: { componentId: "tasks-list", event: "recordDelete", flowId: "tasks-delete" } });
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
