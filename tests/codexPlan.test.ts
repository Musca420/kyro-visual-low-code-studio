import { describe, expect, it } from "vitest";
import { approvedOperations, quickDashboardPlan, quickStructurePlan, quickVisualPlan } from "../server/codexPlan";

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
});
