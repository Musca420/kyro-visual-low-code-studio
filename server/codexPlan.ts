export function approvedOperations(value: unknown) {
  const match = String(value ?? "").match(/FRONTEND_EDITOR_OPERATIONS=(\[[^\r\n]+\])/);
  if (!match) return undefined;
  try {
    const operations = JSON.parse(match[1]);
    return Array.isArray(operations) && operations.length > 0 && operations.length <= 50 && operations.every((item) => item && typeof item.type === "string")
      ? operations as { type: string; pageId?: string; args?: Record<string, unknown> }[]
      : undefined;
  } catch {
    return undefined;
  }
}

export function quickVisualPlan(prompt: string, context: Record<string, unknown>) {
  const componentId = String(context.componentId ?? ""), pageId = String(context.pageId ?? "");
  if (!componentId || !pageId) return undefined;
  const text = prompt.toLowerCase(), operations: { type: string; pageId: string; args: Record<string, unknown> }[] = [];
  const named = ["desktop", "tablet", "mobile"].filter((breakpoint) => text.includes(breakpoint));
  const breakpoints = named.length ? named : [String(context.viewport ?? "desktop")];
  const addStyle = (property: string, value: string) => breakpoints.forEach((breakpoint) => operations.push({ type: "set_responsive_style", pageId, args: { componentId, breakpoint, property, value } }));
  const color = prompt.match(/#[0-9a-f]{6}\b/i)?.[0];
  if (color && /(sfondo|background)/i.test(prompt)) addStyle("background", color.toUpperCase());
  else if (color && /(colore|testo|text)/i.test(prompt)) addStyle("color", color.toUpperCase());
  const lineHeight = prompt.match(/(?:interlinea|line[- ]?height)\D{0,20}(\d+(?:[.,]\d+)?)/i)?.[1];
  if (lineHeight) addStyle("lineHeight", lineHeight.replace(",", "."));
  const fontSize = prompt.match(/(?:dimensione (?:del )?testo|font[- ]?size)\D{0,20}(\d+(?:[.,]\d+)?(?:px|rem|em|%))/i)?.[1];
  if (fontSize) addStyle("fontSize", fontSize.replace(",", "."));
  const radius = prompt.match(/(?:angoli|border[- ]?radius)\D{0,20}(\d+(?:[.,]\d+)?(?:px|rem|em|%))/i)?.[1];
  if (radius) addStyle("borderRadius", radius.replace(",", "."));
  const padding = prompt.match(/(?:spaziatura interna|padding)\D{0,20}(\d+(?:[.,]\d+)?(?:px|rem|em|%))/i)?.[1];
  if (padding) addStyle("padding", padding.replace(",", "."));
  if (!operations.length || operations.length > 50) return undefined;
  return `Piano immediato: aggiorna ${String(context.componentName ?? componentId)} su ${breakpoints.join(", ")} senza modificare altri elementi.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

type IndexedPage = { id: string; name: string; path: string };

const slug = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

export function quickStructurePlan(prompt: string, context: Record<string, unknown>) {
  if (!/(?:rinomina (?:la )?pagina|aggiungi (?:le )?pagine?|organizza la struttura|configura (?:il )?progetto)/i.test(prompt)) return undefined;
  const pages = Array.isArray(context.pages)
    ? context.pages.filter((item): item is IndexedPage => Boolean(item && typeof item.id === "string" && typeof item.name === "string" && typeof item.path === "string"))
    : [];
  if (!pages.length) return undefined;
  const operations: { type: string; pageId?: string; args: Record<string, unknown> }[] = [];
  const rename = (from: string, to: string, path: string) => {
    if (!prompt.toLowerCase().includes(`${from.toLowerCase()} in ${to.toLowerCase()}`)) return;
    const page = pages.find((item) => item.name.localeCompare(from, "it", { sensitivity: "base" }) === 0);
    if (page) operations.push({ type: "update_page", pageId: page.id, args: { name: to, path } });
  };
  rename("Home", "Oggi", "/oggi");
  rename("Profilo", "Impostazioni", "/impostazioni");

  const additions = prompt.match(/aggiungi (?:le )?pagine?\s+(.+?)(?:\.|;|,?\s+con percorsi|,?\s+configura|$)/i)?.[1];
  if (additions) {
    additions
      .split(/\s*,\s*|\s+e\s+/i)
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => {
        const path = /dettaglio attivit/i.test(name) ? "/attivita/:id" : `/${slug(name)}`;
        if (!pages.some((page) => page.path === path || page.name.localeCompare(name, "it", { sensitivity: "base" }) === 0))
          operations.push({ type: "add_page", args: { name, path } });
      });
  }
  const appPatch: Record<string, unknown> = {};
  if (/offline(?:-first)?/i.test(prompt)) appPatch.offline = true;
  if (/tema chiaro e scuro|temi chiaro\/scuro/i.test(prompt)) {
    appPatch.themeMode = "system";
    appPatch.supportedThemes = ["light", "dark"];
  }
  if (/safe area/i.test(prompt)) appPatch.safeArea = true;
  if (/navigazione inferiore|barra inferiore/i.test(prompt)) {
    const mentioned = pages.filter((page) => prompt.toLocaleLowerCase("it").includes(page.name.toLocaleLowerCase("it")));
    const candidates = (mentioned.length >= 2 ? mentioned : pages.filter((page) => !page.path.includes(":"))).slice(0, 5);
    if (candidates.length) appPatch.mobileBottomNavigation = {
      enabled: true,
      items: candidates.map(({ name: label, path }) => ({ label, path })),
    };
  }
  if (Object.keys(appPatch).length) operations.push({ type: "set_app_config", args: { patch: appPatch } });
  if (/android/i.test(prompt) && context.exportTarget !== "android")
    operations.push({ type: "set_export_config", args: { patch: { target: "android", capacitor: true } } });
  if (!operations.length || operations.length > 50) return undefined;
  return `Piano immediato: aggiorna la struttura indicizzata di ${String(context.projectName ?? "progetto")} con ${operations.length} operazioni atomiche e annullabili.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

export function quickNavigationFlowPlan(prompt: string, context: Record<string, unknown>) {
  if (!/(?:al |sul )?(?:click|clic|pressione|tap).{0,35}(?:vai|apri|naviga)|(?:vai|apri|naviga).{0,35}(?:pagina|schermata)/i.test(prompt)) return undefined;
  const componentId = String(context.componentId ?? ""), pageId = String(context.pageId ?? "");
  const pages = Array.isArray(context.pages)
    ? context.pages.filter((item): item is IndexedPage => Boolean(item && typeof item.id === "string" && typeof item.name === "string" && typeof item.path === "string"))
    : [];
  if (!componentId || !pageId || !pages.length) return undefined;
  const normalized = prompt.toLocaleLowerCase("it");
  const destination = pages
    .filter((page) => page.id !== pageId)
    .sort((a, b) => b.name.length - a.name.length)
    .find((page) => normalized.includes(page.name.toLocaleLowerCase("it")) || normalized.includes(page.path.toLocaleLowerCase("it")));
  if (!destination) return undefined;
  const flowId = `navigate-${slug(componentId)}-${slug(destination.name)}`.slice(0, 80);
  const flowExists = Array.isArray(context.flowIndex) && context.flowIndex.some((flow) => flow && typeof flow === "object" && (flow as { id?: string }).id === flowId);
  const operations: { type: string; pageId?: string; args: Record<string, unknown> }[] = flowExists ? [] : [
    { type: "add_flow", args: { flowId, name: `Vai a ${destination.name}` } },
    { type: "add_flow_node", args: { flowId, node: { id: `${flowId}-event`, type: "event", label: "Click", position: { x: 0, y: 0 }, config: { trigger: "click", componentId } } } },
    { type: "add_flow_node", args: { flowId, node: { id: `${flowId}-navigate`, type: "navigate", label: `Apri ${destination.name}`, position: { x: 240, y: 0 }, config: { mode: "page", path: destination.path } } } },
    { type: "connect_nodes", args: { flowId, source: `${flowId}-event`, target: `${flowId}-navigate`, path: "success" } },
  ];
  operations.push({ type: "set_component_event", pageId, args: { componentId, event: "click", flowId } });
  return `Piano immediato: collega ${String(context.componentName ?? componentId)} alla pagina ${destination.name} con un flow visuale annullabile.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

export function quickLocalNotificationPlan(prompt: string, context: Record<string, unknown>) {
  if (!/(?:notifica locale|promemoria)/i.test(prompt)) return undefined;
  const componentId = String(context.componentId ?? ""), pageId = String(context.pageId ?? "");
  if (!componentId || !pageId) return undefined;
  const componentType = String(context.componentType ?? "button");
  const trigger = ["input", "select", "checkbox", "switch"].includes(componentType) ? "change" : "click";
  const title = prompt.match(/titolo\s+[“"']?(.+?)[”"']?(?:\s+e\s+(?:testo|messaggio)|[.;]|$)/i)?.[1]?.trim() || "Promemoria";
  const body = prompt.match(/(?:testo|messaggio)\s+[“"']?(.+?)[”"']?(?:\s+(?:tra|dopo)\s+\d+|[.;]|$)/i)?.[1]?.trim() || "Hai qualcosa da completare";
  const amount = Number(prompt.match(/(?:tra|dopo)\s+(\d+(?:[.,]\d+)?)/i)?.[1]?.replace(",", ".") || 0);
  const unit = prompt.match(/(?:tra|dopo)\s+\d+(?:[.,]\d+)?\s*(millisecondi|secondi|minuti|ore|giorni)/i)?.[1]?.toLowerCase();
  const multiplier = unit?.startsWith("millisecond") ? 1 : unit?.startsWith("minut") ? 60000 : unit?.startsWith("or") ? 3600000 : unit?.startsWith("giorn") ? 86400000 : 1000;
  const delayMs = String(Math.min(604800000, Math.max(0, Math.round((amount || 2) * multiplier))));
  const flowId = `notify-${slug(componentId)}`.slice(0, 80);
  const flowExists = Array.isArray(context.flowIndex) && context.flowIndex.some((flow) => flow && typeof flow === "object" && (flow as { id?: string }).id === flowId);
  const operations: { type: string; pageId?: string; args: Record<string, unknown> }[] = flowExists ? [] : [
    { type: "add_flow", args: { flowId, name: `Notifica da ${String(context.componentName ?? componentId)}` } },
    { type: "add_flow_node", args: { flowId, node: { id: `${flowId}-event`, type: "event", label: trigger === "change" ? "Quando cambia" : "Al click", position: { x: 0, y: 0 }, config: { trigger, componentId } } } },
    { type: "add_flow_node", args: { flowId, node: { id: `${flowId}-notification`, type: "localNotification", label: "Programma promemoria", position: { x: 240, y: 0 }, config: { title, body, delayMs } } } },
    { type: "add_flow_node", args: { flowId, node: { id: `${flowId}-success`, type: "notify", label: "Conferma", position: { x: 480, y: 0 }, config: { message: "Promemoria programmato", level: "success" } } } },
    { type: "connect_nodes", args: { flowId, source: `${flowId}-event`, target: `${flowId}-notification`, path: "success" } },
    { type: "connect_nodes", args: { flowId, source: `${flowId}-notification`, target: `${flowId}-success`, path: "success" } },
  ];
  operations.push({ type: "set_component_event", pageId, args: { componentId, event: trigger, flowId } });
  return `Piano immediato: collega ${String(context.componentName ?? componentId)} a una notifica locale riutilizzabile, verificabile e annullabile.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

type IndexedSource = { id: string; name?: string; schema?: Record<string, unknown> };

export function quickDataViewsPlan(prompt: string, context: Record<string, unknown>) {
  if (!/(?:calendario|statistic|grafici?|kpi).{0,60}(?:dati|dinamic|reali|collega)|(?:collega|rendi).{0,60}(?:calendario|statistic|grafici?|kpi)/i.test(prompt)) return undefined;
  const pageId = String(context.pageId ?? "");
  const components = Array.isArray(context.pageComponents)
    ? context.pageComponents.filter((item): item is IndexedComponent => Boolean(item && typeof item.id === "string" && typeof item.type === "string"))
    : [];
  const sources = Array.isArray(context.dataSources)
    ? context.dataSources.filter((item): item is IndexedSource => Boolean(item && typeof item.id === "string"))
    : [];
  if (!pageId || !components.length || !sources.length) return undefined;
  const fieldSource = (fields: string[]) => sources.find((source) => fields.some((field) => source.schema && Object.hasOwn(source.schema, field)));
  const taskSource = fieldSource(["dueDate", "completed", "status"]) ?? sources[0];
  const habitSource = fieldSource(["currentStreak", "bestStreak", "completedToday"]) ?? taskSource;
  const calendars = components.filter((component) => component.type === "calendar");
  const charts = components.filter((component) => component.type === "chart");
  const cards = components.filter((component) => component.type === "card");
  if (!calendars.length && !charts.length) return undefined;
  const operations: { type: string; pageId?: string; args: Record<string, unknown> }[] = [];
  const bind = (component: IndexedComponent, source: IndexedSource) => operations.push({ type: "bind_component_data", pageId, args: { componentId: component.id, sourceId: source.id, state: "data" } });
  const property = (component: IndexedComponent, name: string, value: string) => operations.push({ type: "set_component_property", pageId, args: { componentId: component.id, property: name, value } });
  if (calendars.length) {
    calendars.forEach((component) => { bind(component, taskSource); property(component, "dateField", "dueDate"); });
  }
  if (charts.length) {
    if (cards[0]) { bind(cards[0], taskSource); property(cards[0], "metric", "completed"); property(cards[0], "metricSuffix", "attività completate"); }
    if (cards[1]) { bind(cards[1], taskSource); property(cards[1], "metric", "active"); property(cards[1], "metricSuffix", "attività aperte"); }
    if (cards[2]) { bind(cards[2], habitSource); property(cards[2], "metric", "maxStreak"); property(cards[2], "metricSuffix", "giorni di serie"); }
    charts.forEach((component, index) => { const source = index === 0 ? taskSource : habitSource; bind(component, source); property(component, "metric", "completed"); });
  }
  const targets = [...calendars, ...cards.slice(0, charts.length ? 3 : 0), ...charts];
  const flowId = `load-views-${slug(pageId)}`.slice(0, 80);
  const exists = Array.isArray(context.flowIndex) && context.flowIndex.some((flow) => flow && typeof flow === "object" && (flow as { id?: string }).id === flowId);
  if (!exists && targets.length) {
    operations.push({ type: "add_flow", args: { flowId, name: "Carica viste dati" } });
    operations.push({ type: "add_flow_node", args: { flowId, node: { id: `${flowId}-event`, type: "event", label: "Apertura pagina", position: { x: 0, y: 0 }, config: { trigger: "pageLoad", pageId } } } });
    targets.forEach((component, index) => operations.push({ type: "add_flow_node", args: { flowId, node: { id: `${flowId}-refresh-${index}`, type: "refresh", label: `Aggiorna ${component.name}`, position: { x: 240 + index * 180, y: 0 }, config: { componentId: component.id } } } }));
    targets.forEach((_component, index) => operations.push({ type: "connect_nodes", args: { flowId, source: index ? `${flowId}-refresh-${index - 1}` : `${flowId}-event`, target: `${flowId}-refresh-${index}`, path: "success" } }));
  } else if (exists) {
    operations.push({ type: "update_flow_node", args: { flowId, nodeId: `${flowId}-event`, patch: { config: { pageId } } } });
  }
  if (!operations.length || operations.length > 50) return undefined;
  return `Piano immediato: collega ${targets.length} viste visuali alle sorgenti esistenti con metriche, calendario e refresh generici.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

type IndexedComponent = { id: string; name: string; type: string; parentId?: string };

export function quickDashboardPlan(prompt: string, context: Record<string, unknown>) {
  if (!/(?:trasforma|crea|componi).{0,40}(?:dashboard|riepilogo).{0,40}mobile/is.test(prompt)) return undefined;
  const items = Array.isArray(context.pageComponents)
    ? context.pageComponents.filter((item): item is IndexedComponent => Boolean(item && typeof item.id === "string" && typeof item.type === "string"))
    : [];
  const byType = (type: string, index = 0) => items.filter((item) => item.type === type)[index];
  const header = byType("header"), hero = byType("hero"), grid = byType("grid"), footer = byType("footer");
  const cards = items.filter((item) => item.type === "card").slice(0, 3);
  if (!header || !hero || !grid || !footer || cards.length < 3) return undefined;
  const colors = [...prompt.matchAll(/#[0-9a-f]{6}\b/ig)].map((match) => match[0].toUpperCase());
  const primary = colors[0] ?? "#16A6A1", accent = colors[1] ?? "#FF725E";
  const operations: { type: string; args: Record<string, unknown> }[] = [];
  const op = (type: string, args: Record<string, unknown>) => operations.push({ type, args });
  [["primary", primary], ["accent", accent], ["surface", "#171A1F"], ["pageBackground", "#0F1115"]]
    .forEach(([token, value]) => op("set_theme_token", { token, value }));
  const labels: [IndexedComponent, string, string][] = [
    [header, "Intestazione giornaliera", "Buongiorno, Giulia · Domenica 19 luglio"],
    [hero, "Progresso di oggi", "4 di 7 completate"],
    [grid, "Riepilogo Oggi", "Oggi"],
    [cards[0], "Prossima attività", "Prossima attività · 09:30"],
    [cards[1], "Appuntamenti", "Appuntamenti · 2 oggi"],
    [cards[2], "Abitudini", "Abitudini · 3 da completare"],
    [footer, "Navigazione inferiore", "Oggi · Attività · Calendario · Abitudini · Statistiche"],
  ];
  labels.forEach(([component, name, label]) => {
    if (component !== grid && component !== footer) op("set_component_property", { componentId: component.id, property: "name", value: name });
    op("set_component_property", { componentId: component.id, property: "label", value: label });
  });
  [[hero, "Una vista chiara del ritmo della tua giornata."], [cards[0], "Preparare la presentazione · Lavoro"], [cards[1], "Riunione team alle 11:00 · Dentista alle 17:30"], [cards[2], "Acqua, lettura e movimento quotidiano"]]
    .forEach(([component, description]) => op("set_component_property", { componentId: (component as IndexedComponent).id, property: "description", value: description }));
  const progressId = items.find((item) => item.name === "Progresso giornaliero")?.id ?? `daily-progress-${hero.id.slice(0, 8)}`;
  const addId = items.find((item) => item.name === "Aggiungi rapido")?.id ?? `quick-add-${header.id.slice(0, 8)}`;
  if (!items.some((item) => item.id === progressId)) op("add_component", { componentId: progressId, componentType: "progress", name: "Progresso giornaliero", parentId: hero.id, props: { label: "Progresso giornaliero", value: 4, max: 7 }, styles: { mobile: { width: "100%", minHeight: "12px", color: primary, background: "#2A3038", borderRadius: "999px" } }, accessibility: { label: "Progresso giornaliero, 4 attività completate su 7", role: "progressbar" } });
  if (!items.some((item) => item.id === addId)) op("add_component", { componentId: addId, componentType: "button", name: "Aggiungi rapido", parentId: header.id, props: { label: "+ Aggiungi" }, styles: { mobile: { minHeight: "48px", color: "#111318", background: accent, borderRadius: "14px", padding: "12px 18px", fontWeight: "700" } }, accessibility: { label: "Aggiungi rapidamente un elemento", role: "button" }, intent: { role: "action", action: "create", entity: "elemento", expectedResult: "Avvia aggiunta rapida", requiredStates: [], permissions: [] } });
  const style = (componentId: string, property: string, value: string) => op("set_responsive_style", { componentId, breakpoint: "mobile", property, value });
  [[header.id, "background", "#0F1115"], [header.id, "color", "#F3F4F6"], [header.id, "padding", "20px 16px"], [hero.id, "background", "#171A1F"], [hero.id, "color", "#F3F4F6"], [hero.id, "borderRadius", "20px"], [hero.id, "padding", "20px"], [grid.id, "background", "#0F1115"], [grid.id, "color", "#F3F4F6"], [grid.id, "gridTemplateColumns", "1fr"], [grid.id, "gap", "12px"]]
    .forEach(([id, property, value]) => style(id, property, value));
  cards.forEach((card) => [["background", "#1D2229"], ["color", "#F3F4F6"], ["borderRadius", "16px"]].forEach(([property, value]) => style(card.id, property, value)));
  [["background", "#171A1F"], ["color", "#F3F4F6"], ["minHeight", "64px"]].forEach(([property, value]) => style(footer.id, property, value));
  op("set_component_accessibility", { componentId: header.id, label: "Intestazione di oggi", role: "banner" });
  op("set_component_accessibility", { componentId: footer.id, label: "Navigazione principale", role: "navigation" });
  op("set_component_state_style", { componentId: addId, state: "focus", property: "outline", value: `3px solid ${primary}` });
  op("set_component_state_style", { componentId: addId, state: "focus", property: "outlineOffset", value: "3px" });
  if (!operations.length || operations.length > 50) return undefined;
  return `Piano immediato: compone la dashboard mobile di ${String(context.projectName ?? "progetto")} usando l'indice del grafo, senza dati o flow.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

type ScreenItem = {
  id: string;
  type: string;
  name: string;
  label: string;
  description?: string;
  props?: Record<string, unknown>;
};

const dailyFlowScreens: Record<string, { title: string; description: string; items: ScreenItem[] }> = {
  onboarding: {
    title: "La tua giornata, finalmente in equilibrio",
    description: "Attività, appuntamenti e abitudini in un solo spazio, disponibile anche offline.",
    items: [
      { id: "onboarding-title", type: "title", name: "Titolo onboarding", label: "Organizza oggi. Respira domani." },
      { id: "onboarding-copy", type: "text", name: "Introduzione", label: "DailyFlow trasforma i tuoi impegni in un ritmo semplice da seguire." },
      { id: "onboarding-plan", type: "card", name: "Pianifica", label: "Pianifica con chiarezza", description: "Riunisci attività e appuntamenti senza perdere il filo." },
      { id: "onboarding-habits", type: "card", name: "Crea abitudini", label: "Costruisci continuità", description: "Piccoli passi quotidiani, serie visibili e incoraggianti." },
      { id: "onboarding-offline", type: "card", name: "Sempre disponibile", label: "Funziona anche offline", description: "I dati restano sul dispositivo e tornano con te al riavvio." },
      { id: "onboarding-start", type: "button", name: "Inizia", label: "Inizia con DailyFlow", props: { role: "primary" } },
    ],
  },
  calendario: {
    title: "Calendario",
    description: "Guarda impegni e attività per giorno o per settimana.",
    items: [
      { id: "calendar-title", type: "title", name: "Titolo calendario", label: "La tua settimana" },
      { id: "calendar-view", type: "tabs", name: "Vista calendario", label: "Giorno · Settimana", props: { tabs: "Giorno|Settimana" } },
      { id: "calendar-main", type: "calendar", name: "Calendario settimanale", label: "19–25 luglio 2026" },
      { id: "calendar-next", type: "card", name: "Prossimo appuntamento", label: "Oggi · 11:00", description: "Riunione del team · 45 minuti" },
      { id: "calendar-day", type: "list", name: "Agenda del giorno", label: "Agenda di oggi" },
      { id: "calendar-add", type: "button", name: "Aggiungi dal calendario", label: "+ Nuova attività" },
    ],
  },
  "dettaglio-attivita": {
    title: "Dettaglio attività",
    description: "Consulta e modifica ogni informazione dell’attività selezionata.",
    items: [
      { id: "detail-title", type: "title", name: "Titolo dettaglio", label: "Modifica attività" },
      { id: "detail-name", type: "input", name: "Nome attività", label: "Nome attività", props: { fieldName: "title", required: true, placeholder: "Cosa devi fare?" } },
      { id: "detail-description", type: "textarea", name: "Descrizione attività", label: "Descrizione", props: { fieldName: "description", required: true } },
      { id: "detail-status", type: "select", name: "Stato attività", label: "Stato", props: { fieldName: "status", options: "Da fare|In corso|Completata" } },
      { id: "detail-priority", type: "select", name: "Priorità attività", label: "Priorità", props: { fieldName: "priority", options: "Bassa|Media|Alta" } },
      { id: "detail-date", type: "input", name: "Data attività", label: "Data", props: { fieldName: "dueDate", inputType: "date", required: true } },
      { id: "detail-notes", type: "textarea", name: "Note attività", label: "Note", props: { fieldName: "notes" } },
      { id: "detail-save", type: "button", name: "Salva modifiche", label: "Salva modifiche", props: { buttonType: "submit" } },
      { id: "detail-delete", type: "button", name: "Elimina attività", label: "Elimina attività" },
    ],
  },
  abitudini: {
    title: "Abitudini quotidiane",
    description: "Crea routine sostenibili e proteggi la tua serie giorno dopo giorno.",
    items: [
      { id: "habits-title", type: "title", name: "Titolo abitudini", label: "Le tue abitudini" },
      { id: "habits-progress", type: "progress", name: "Progresso abitudini", label: "2 di 3 completate", props: { value: 2, max: 3 } },
      { id: "habit-water", type: "card", name: "Bere acqua", label: "Bere 8 bicchieri", description: "12 giorni consecutivi · quasi fatto" },
      { id: "habit-read", type: "card", name: "Leggere", label: "Leggere 20 minuti", description: "7 giorni consecutivi · completata" },
      { id: "habit-move", type: "card", name: "Movimento", label: "Camminare 30 minuti", description: "4 giorni consecutivi · da completare" },
      { id: "habit-name", type: "input", name: "Nome nuova abitudine", label: "Nuova abitudine", props: { fieldName: "name", required: true, placeholder: "Es. Meditare 10 minuti" } },
      { id: "habit-add", type: "button", name: "Aggiungi abitudine", label: "+ Aggiungi abitudine" },
      { id: "habits-toast", type: "toast", name: "Conferma abitudine", label: "Abitudine aggiornata" },
    ],
  },
  statistiche: {
    title: "Statistiche settimanali",
    description: "Riconosci i progressi, non soltanto le cose ancora da fare.",
    items: [
      { id: "stats-title", type: "title", name: "Titolo statistiche", label: "La tua settimana" },
      { id: "stats-completed", type: "card", name: "Attività completate", label: "18 attività", description: "+20% rispetto alla settimana scorsa" },
      { id: "stats-focus", type: "card", name: "Tempo focalizzato", label: "9 h 40 min", description: "Martedì è stato il giorno più produttivo" },
      { id: "stats-streak", type: "card", name: "Serie migliore", label: "12 giorni", description: "Bere 8 bicchieri" },
      { id: "stats-week-chart", type: "chart", name: "Grafico attività", label: "Attività completate per giorno" },
      { id: "stats-habits-chart", type: "chart", name: "Grafico abitudini", label: "Costanza delle abitudini" },
      { id: "stats-insight", type: "alert", name: "Suggerimento", label: "Ottimo ritmo: lascia libero mercoledì sera per proteggere il recupero." },
    ],
  },
  impostazioni: {
    title: "Impostazioni",
    description: "Personalizza DailyFlow e mantieni il controllo dei tuoi dati.",
    items: [
      { id: "settings-title", type: "title", name: "Titolo impostazioni", label: "Il tuo DailyFlow" },
      { id: "settings-theme", type: "select", name: "Tema", label: "Tema dell’app", props: { fieldName: "theme", options: "Sistema|Chiaro|Scuro" } },
      { id: "settings-notifications", type: "checkbox", name: "Notifiche locali", label: "Promemoria e notifiche locali", props: { fieldName: "notifications" } },
      { id: "settings-offline", type: "checkbox", name: "Modalità offline", label: "Mantieni i dati disponibili offline", props: { fieldName: "offline" } },
      { id: "settings-backup", type: "button", name: "Crea backup", label: "Crea backup dei dati" },
      { id: "settings-privacy", type: "card", name: "Privacy", label: "I tuoi dati restano tuoi", description: "Archiviazione locale, export aperto e nessun vincolo alla piattaforma." },
      { id: "settings-save", type: "button", name: "Salva impostazioni", label: "Salva impostazioni" },
    ],
  },
};

export function quickDailyFlowScreenPlan(prompt: string, context: Record<string, unknown>) {
  if (!/(?:crea|progetta|componi|completa).{0,30}(?:schermata|pagina)/i.test(prompt)) return undefined;
  const pages = Array.isArray(context.pages) ? context.pages as IndexedPage[] : [];
  const page = pages.find((item) => item.id === context.pageId);
  const key = slug(page?.name ?? "");
  const spec = dailyFlowScreens[key];
  const indexed = (Array.isArray(context.pageComponents) ? context.pageComponents : []) as IndexedComponent[];
  let rootId = String(context.componentId ?? "");
  let root = indexed.find((item) => item.id === rootId);
  while (root?.parentId) {
    rootId = root.parentId;
    root = indexed.find((item) => item.id === rootId);
  }
  if (!spec || !rootId || !["section", "grid", "container"].includes(String(root?.type ?? context.componentType ?? ""))) return undefined;
  const existing = new Set(indexed.map((item) => String(item.id ?? "")));
  const operations: { type: string; args: Record<string, unknown> }[] = [];
  const op = (type: string, args: Record<string, unknown>) => operations.push({ type, args });
  const starterNames = /^(?:Header|Nuovo progetto|Grid|Contenuti|Footer|.+ grid|.+ card \d+)$/i;
  indexed
    .filter((item) => item.id !== rootId && !item.parentId && starterNames.test(item.name))
    .forEach((item) => op("remove_component", { componentId: item.id, confirmed: true }));
  op("set_component_property", { componentId: rootId, property: "name", value: spec.title });
  op("set_component_property", { componentId: rootId, property: "label", value: spec.title });
  op("set_component_property", { componentId: rootId, property: "description", value: spec.description });
  const style = (breakpoint: string, property: string, value: string) => op("set_responsive_style", { componentId: rootId, breakpoint, property, value });
  [["mobile", "padding", "20px 16px"], ["mobile", "gap", "14px"], ["mobile", "background", "#0F1115"], ["mobile", "color", "#F3F4F6"], ["tablet", "padding", "28px"], ["desktop", "padding", "40px"]]
    .forEach(([breakpoint, property, value]) => style(breakpoint, property, value));
  spec.items.filter((item) => !existing.has(item.id)).forEach((item, index) => {
    const danger = item.id.includes("delete");
    op("add_component", {
      componentId: item.id,
      componentType: item.type,
      name: item.name,
      parentId: rootId,
      props: { label: item.label, ...(item.description ? { description: item.description } : {}), ...item.props },
      accessibility: { label: item.label, ...(item.type === "button" ? { role: "button" } : {}) },
      styles: {
        mobile: {
          width: "100%",
          minHeight: item.type === "button" ? "48px" : "auto",
          padding: ["card", "alert"].includes(item.type) ? "16px" : "12px",
          borderRadius: "16px",
          background: danger ? "#7F1D1D" : item.type === "button" ? "#16A6A1" : "#1D2229",
          color: "#F3F4F6",
          animation: index < 3 ? "fade" : "none",
        },
      },
    });
  });
  return `Piano immediato: compone ${spec.title} dal grafo della pagina corrente con componenti mobili accessibili e modificabili.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

export function quickCrudSurfacePlan(prompt: string, context: Record<string, unknown>) {
  if (!/(?:attivit|task)/i.test(prompt) || !/(?:sorgente|database).{0,20}(?:locale|indexeddb)/i.test(prompt) || !/form.{0,30}lista/is.test(prompt)) return undefined;
  const items = Array.isArray(context.pageComponents)
    ? context.pageComponents.filter((item): item is IndexedComponent => Boolean(item && typeof item.id === "string" && typeof item.type === "string"))
    : [];
  const byType = (type: string) => items.find((item) => item.type === type);
  const header = byType("header"), section = byType("section"), grid = byType("grid");
  if (!header || !section || !grid) return undefined;
  const operations: { type: string; args: Record<string, unknown> }[] = [];
  const op = (type: string, args: Record<string, unknown>) => operations.push({ type, args });
  const sources = Array.isArray(context.dataSources) ? context.dataSources as { id?: string; name?: string }[] : [];
  const sourceId = String(sources.find((source) => /attivit|task/i.test(String(source.name)))?.id ?? `${slug(String(context.projectName ?? "project")) || "project"}-tasks`);
  if (!sources.some((source) => source.id === sourceId))
    op("create_data_source", { sourceId, name: "Attività", provider: "indexeddb", collection: "tasks", schema: { id: "string", title: "string", description: "string", status: "string", priority: "string", category: "string", dueDate: "datetime", time: "string", notes: "string", recurring: "boolean", completed: "boolean" } });
  items.filter((item) => item.type === "card").slice(0, 3).forEach((item) => op("remove_component", { componentId: item.id, confirmed: true }));
  [[header, "name", "Intestazione attività"], [header, "label", "Le mie attività"], [section, "name", "Gestione attività"], [section, "label", "Organizza la giornata"], [section, "description", "Crea, cerca e completa le attività anche offline."], [grid, "name", "Elenco attività"], [grid, "label", "Attività"]]
    .forEach(([component, property, value]) => op("set_component_property", { componentId: (component as IndexedComponent).id, property, value }));
  const add = (componentId: string, componentType: string, name: string, parentId: string | undefined, props: Record<string, unknown>, accessibility: Record<string, unknown>) => op("add_component", { componentId, componentType, name, ...(parentId ? { parentId } : {}), props, accessibility, styles: { mobile: { width: "100%", minHeight: "48px", borderRadius: "14px", padding: "12px", background: "#1D2229", color: "#F3F4F6" } } });
  add("tasks-form", "form", "Nuova attività", section.id, { label: "Nuova attività" }, { label: "Modulo nuova attività", role: "form" });
  add("task-title", "input", "Nome attività", "tasks-form", { fieldName: "title", placeholder: "Cosa devi fare?", required: true }, { label: "Nome attività" });
  add("task-description", "textarea", "Descrizione", "tasks-form", { fieldName: "description", placeholder: "Aggiungi una descrizione", required: true }, { label: "Descrizione attività" });
  add("task-status", "select", "Stato", "tasks-form", { fieldName: "status", label: "Da fare", options: "Da fare|In corso|Completata" }, { label: "Stato attività" });
  add("task-priority", "select", "Priorità", "tasks-form", { fieldName: "priority", label: "Media", options: "Bassa|Media|Alta" }, { label: "Priorità attività" });
  add("task-category", "input", "Categoria", "tasks-form", { fieldName: "category", placeholder: "Lavoro, personale…" }, { label: "Categoria attività" });
  add("task-date", "input", "Data", "tasks-form", { fieldName: "dueDate", inputType: "date", required: true }, { label: "Data attività" });
  add("task-time", "input", "Ora", "tasks-form", { fieldName: "time", inputType: "time" }, { label: "Ora attività" });
  add("task-notes", "textarea", "Note", "tasks-form", { fieldName: "notes", placeholder: "Note facoltative" }, { label: "Note attività" });
  add("task-recurring", "checkbox", "Ricorrente", "tasks-form", { fieldName: "recurring", label: "Ripeti questa attività" }, { label: "Attività ricorrente" });
  add("task-submit", "button", "Salva attività", "tasks-form", { label: "Salva attività", buttonType: "submit" }, { label: "Salva attività", role: "button" });
  add("task-search", "input", "Cerca attività", grid.id, { fieldName: "search", inputType: "search", placeholder: "Cerca per testo" }, { label: "Cerca attività" });
  add("task-filter", "select", "Filtra attività", grid.id, { fieldName: "filter", label: "Tutti gli stati", options: "Tutti gli stati|Da fare|In corso|Completata" }, { label: "Filtra per stato" });
  add("tasks-list", "list", "Lista attività", grid.id, { label: "Attività salvate" }, { label: "Elenco attività" });
  add("tasks-toast", "toast", "Conferma attività", undefined, { label: "Attività salvata" }, { label: "Conferma operazione", role: "status" });
  op("bind_component_data", { componentId: "tasks-list", sourceId, state: "data" });
  if (!operations.length || operations.length > 50) return undefined;
  return `Piano immediato: prepara la superficie CRUD locale della pagina attività con form accessibile, ricerca, filtro e stati; i flow verranno collegati nel passo successivo.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

export function quickCrudFlowsPlan(prompt: string, context: Record<string, unknown>) {
  if (!/(?:collega|crea).{0,30}flow/i.test(prompt) || !/(?:carica|page.?load)/i.test(prompt) || !/(?:crea|salva).{0,20}attivit/i.test(prompt)) return undefined;
  const components = Array.isArray(context.pageComponents) ? context.pageComponents as IndexedComponent[] : [];
  const form = components.find((item) => item.id === "tasks-form" || item.type === "form");
  const list = components.find((item) => item.id === "tasks-list" || item.type === "list");
  const sources = Array.isArray(context.dataSources) ? context.dataSources as { id?: string; name?: string }[] : [];
  const sourceId = String(sources.find((source) => /attivit|task/i.test(String(source.name)))?.id ?? "");
  if (!form || !list || !sourceId) return undefined;
  const existingFlows = Array.isArray(context.flowIndex) ? context.flowIndex as { id?: string }[] : [];
  const operations: { type: string; args: Record<string, unknown> }[] = [];
  const op = (type: string, args: Record<string, unknown>) => operations.push({ type, args });
  const node = (flowId: string, id: string, type: string, label: string, x: number, y: number, config: Record<string, string> = {}) => op("add_flow_node", { flowId, node: { id, type, label, position: { x, y }, config } });
  const edge = (flowId: string, source: string, target: string, path = "success") => op("connect_nodes", { flowId, source, target, path });
  if (!existingFlows.some((flow) => flow.id === "tasks-load")) {
    op("add_flow", { flowId: "tasks-load", name: "Carica attività" });
    node("tasks-load", "load-event", "event", "Apertura pagina", 0, 0, { trigger: "pageLoad" });
    node("tasks-load", "load-query", "query", "Leggi attività locali", 220, 0, { sourceId });
    node("tasks-load", "load-refresh", "refresh", "Aggiorna lista", 440, 0, { componentId: list.id });
    node("tasks-load", "load-error", "notify", "Errore caricamento", 440, 140, { message: "Non riesco a caricare le attività", level: "error" });
    edge("tasks-load", "load-event", "load-query");
    edge("tasks-load", "load-query", "load-refresh");
    edge("tasks-load", "load-query", "load-error", "error");
  }
  if (!existingFlows.some((flow) => flow.id === "tasks-create")) {
    op("add_flow", { flowId: "tasks-create", name: "Crea attività" });
    node("tasks-create", "create-event", "event", "Invio modulo", 0, 0, { trigger: "submit", componentId: form.id });
    node("tasks-create", "create-read", "readInput", "Leggi campi", 200, 0, { componentId: form.id });
    node("tasks-create", "validate-title", "validate", "Titolo obbligatorio", 400, 0, { field: "title", rule: "required", message: "Inserisci il nome dell'attività" });
    node("tasks-create", "validate-date", "validate", "Data obbligatoria", 600, 0, { field: "dueDate", rule: "required", message: "Scegli una data" });
    node("tasks-create", "create-insert", "insert", "Salva in locale", 800, 0, { sourceId });
    node("tasks-create", "create-refresh", "refresh", "Aggiorna lista", 1000, 0, { componentId: list.id });
    node("tasks-create", "create-success", "notify", "Conferma", 1200, 0, { message: "Attività salvata", level: "success" });
    node("tasks-create", "create-error", "notify", "Errore", 800, 180, { message: "Controlla i campi e riprova", level: "error" });
    edge("tasks-create", "create-event", "create-read");
    edge("tasks-create", "create-read", "validate-title");
    edge("tasks-create", "validate-title", "validate-date");
    edge("tasks-create", "validate-title", "create-error", "error");
    edge("tasks-create", "validate-date", "create-insert");
    edge("tasks-create", "validate-date", "create-error", "error");
    edge("tasks-create", "create-insert", "create-refresh");
    edge("tasks-create", "create-insert", "create-error", "error");
    edge("tasks-create", "create-refresh", "create-success");
  }
  op("set_component_event", { componentId: form.id, event: "submit", flowId: "tasks-create" });
  if (!operations.length || operations.length > 50) return undefined;
  return `Piano immediato: collega caricamento e creazione delle attività con nodi success/error e un evento submit stabile.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

export function quickHabitsPlan(prompt: string, context: Record<string, unknown>) {
  if (!/(?:abitudin|habit)/i.test(prompt) || !/(?:sorgente|indexeddb|dati|flow)/i.test(prompt)) return undefined;
  const components = Array.isArray(context.pageComponents) ? context.pageComponents as IndexedComponent[] : [];
  const selected = components.find((item) => item.id === context.componentId);
  let root = selected;
  while (root?.parentId) root = components.find((item) => item.id === root?.parentId);
  const nameInput = components.find((item) => item.id === "habit-name");
  const addButton = components.find((item) => item.id === "habit-add");
  if (!root || !["section", "container"].includes(root.type) || !nameInput || !addButton) return undefined;
  const sources = Array.isArray(context.dataSources) ? context.dataSources as { id?: string; name?: string }[] : [];
  const flows = Array.isArray(context.flowIndex) ? context.flowIndex as { id?: string }[] : [];
  const operations: { type: string; args: Record<string, unknown> }[] = [];
  const op = (type: string, args: Record<string, unknown>) => operations.push({ type, args });
  const node = (flowId: string, id: string, type: string, label: string, x: number, y: number, config: Record<string, string> = {}) => op("add_flow_node", { flowId, node: { id, type, label, position: { x, y }, config } });
  const edge = (flowId: string, source: string, target: string, path = "success") => op("connect_nodes", { flowId, source, target, path });
  const sourceId = String(sources.find((source) => /abitudin|habit/i.test(String(source.name)))?.id ?? `${slug(String(context.projectName ?? "project")) || "project"}-habits`);
  if (!sources.some((source) => source.id === sourceId))
    op("create_data_source", { sourceId, name: "Abitudini", provider: "indexeddb", collection: "habits", schema: { id: "string", name: "string", frequency: "string", currentStreak: "number", bestStreak: "number", completedToday: "boolean", lastCompletedAt: "datetime" } });
  components.filter((item) => /^habit-(?:water|read|move)$/.test(item.id)).forEach((item) => op("remove_component", { componentId: item.id, confirmed: true }));
  if (!components.some((item) => item.id === "habits-form")) {
    op("add_component", { componentId: "habits-form", componentType: "form", name: "Nuova abitudine", parentId: root.id, props: { label: "Nuova abitudine" }, accessibility: { label: "Modulo nuova abitudine", role: "form" } });
    op("move_component", { componentId: nameInput.id, parentId: "habits-form" });
    op("set_component_property", { componentId: nameInput.id, property: "fieldName", value: "name" });
    op("set_component_property", { componentId: nameInput.id, property: "required", value: true });
    op("add_component", { componentId: "habit-frequency", componentType: "select", name: "Frequenza", parentId: "habits-form", props: { label: "Frequenza", fieldName: "frequency", options: "Ogni giorno|Giorni feriali|Ogni settimana" }, accessibility: { label: "Frequenza abitudine" } });
    op("move_component", { componentId: addButton.id, parentId: "habits-form" });
    op("set_component_property", { componentId: addButton.id, property: "buttonType", value: "submit" });
  }
  if (!components.some((item) => item.id === "habits-list")) {
    op("add_component", { componentId: "habits-list", componentType: "list", name: "Lista abitudini", parentId: root.id, props: { label: "Abitudini salvate" }, accessibility: { label: "Elenco abitudini" } });
    op("bind_component_data", { componentId: "habits-list", sourceId, state: "data" });
  }
  if (!flows.some((flow) => flow.id === "habits-load")) {
    op("add_flow", { flowId: "habits-load", name: "Carica abitudini" });
    node("habits-load", "habits-load-event", "event", "Apertura pagina", 0, 0, { trigger: "pageLoad" });
    node("habits-load", "habits-load-query", "query", "Leggi abitudini locali", 220, 0, { sourceId });
    node("habits-load", "habits-load-refresh", "refresh", "Aggiorna lista e progresso", 440, 0, { componentId: "habits-list" });
    node("habits-load", "habits-load-error", "notify", "Errore caricamento", 440, 140, { message: "Non riesco a caricare le abitudini", level: "error" });
    edge("habits-load", "habits-load-event", "habits-load-query"); edge("habits-load", "habits-load-query", "habits-load-refresh"); edge("habits-load", "habits-load-query", "habits-load-error", "error");
  }
  if (!flows.some((flow) => flow.id === "habits-create")) {
    op("add_flow", { flowId: "habits-create", name: "Crea abitudine" });
    node("habits-create", "habits-create-event", "event", "Invio modulo", 0, 0, { trigger: "submit", componentId: "habits-form" });
    node("habits-create", "habits-create-read", "readInput", "Leggi campi", 200, 0, { componentId: "habits-form" });
    node("habits-create", "habits-create-validate", "validate", "Nome obbligatorio", 400, 0, { field: "name", rule: "required", message: "Inserisci il nome dell'abitudine" });
    node("habits-create", "habits-create-insert", "insert", "Salva in locale", 600, 0, { sourceId });
    node("habits-create", "habits-create-refresh", "refresh", "Aggiorna lista", 800, 0, { componentId: "habits-list" });
    node("habits-create", "habits-create-success", "notify", "Conferma", 1000, 0, { message: "Abitudine salvata", level: "success" });
    node("habits-create", "habits-create-error", "notify", "Errore", 600, 160, { message: "Controlla il nome e riprova", level: "error" });
    edge("habits-create", "habits-create-event", "habits-create-read"); edge("habits-create", "habits-create-read", "habits-create-validate"); edge("habits-create", "habits-create-validate", "habits-create-insert"); edge("habits-create", "habits-create-validate", "habits-create-error", "error"); edge("habits-create", "habits-create-insert", "habits-create-refresh"); edge("habits-create", "habits-create-insert", "habits-create-error", "error"); edge("habits-create", "habits-create-refresh", "habits-create-success");
    op("set_component_event", { componentId: "habits-form", event: "submit", flowId: "habits-create" });
  }
  if (!flows.some((flow) => flow.id === "habits-complete")) {
    op("add_flow", { flowId: "habits-complete", name: "Completa abitudine" });
    node("habits-complete", "habits-complete-event", "event", "Completamento richiesto", 0, 0, { trigger: "recordAction", componentId: "habits-list" });
    node("habits-complete", "habits-complete-update", "update", "Aggiorna serie", 240, 0, { sourceId });
    node("habits-complete", "habits-complete-refresh", "refresh", "Aggiorna lista e progresso", 480, 0, { componentId: "habits-list" });
    node("habits-complete", "habits-complete-success", "notify", "Conferma completamento", 720, 0, { message: "Abitudine completata", level: "success" });
    node("habits-complete", "habits-complete-error", "notify", "Errore completamento", 480, 150, { message: "Non riesco ad aggiornare l'abitudine", level: "error" });
    edge("habits-complete", "habits-complete-event", "habits-complete-update"); edge("habits-complete", "habits-complete-update", "habits-complete-refresh"); edge("habits-complete", "habits-complete-update", "habits-complete-error", "error"); edge("habits-complete", "habits-complete-refresh", "habits-complete-success");
  }
  if (!operations.length || operations.length > 50) return undefined;
  return `Piano immediato: collega Abitudini a IndexedDB con form validato, lista e flow visuali di caricamento, creazione e completamento.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}
