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
  return `Immediate plan: update ${String(context.componentName ?? componentId)} on ${breakpoints.join(", ")} without changing other elements.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
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
  return `Immediate plan: update the indexed structure of ${String(context.projectName ?? "project")} with ${operations.length} atomic, undoable operations.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
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
    { type: "add_flow_node", args: { flowId, node: { id: `${flowId}-navigate`, type: "navigate", label: `Open ${destination.name}`, position: { x: 240, y: 0 }, config: { mode: "page", path: destination.path } } } },
    { type: "connect_nodes", args: { flowId, source: `${flowId}-event`, target: `${flowId}-navigate`, path: "success" } },
  ];
  operations.push({ type: "set_component_event", pageId, args: { componentId, event: "click", flowId } });
  return `Immediate plan: connect ${String(context.componentName ?? componentId)} to ${destination.name} with an undoable visual flow.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

export function quickLocalNotificationPlan(prompt: string, context: Record<string, unknown>) {
  if (!/(?:local notification|reminder|notifica locale|promemoria)/i.test(prompt)) return undefined;
  const componentId = String(context.componentId ?? ""), pageId = String(context.pageId ?? "");
  if (!componentId || !pageId) return undefined;
  const componentType = String(context.componentType ?? "button");
  const trigger = ["input", "select", "checkbox", "switch"].includes(componentType) ? "change" : "click";
  const title = prompt.match(/(?:title|titolo)\s+[“"']?(.+?)[”"']?(?:\s+(?:and|e)\s+(?:body|text|message|testo|messaggio)|[.;]|$)/i)?.[1]?.trim() || "Reminder";
  const body = prompt.match(/(?:body|text|message|testo|messaggio)\s+[“"']?(.+?)[”"']?(?:\s+(?:in|after|tra|dopo)\s+\d+|[.;]|$)/i)?.[1]?.trim() || "You have something to complete";
  const amount = Number(prompt.match(/(?:in|after|tra|dopo)\s+(\d+(?:[.,]\d+)?)/i)?.[1]?.replace(",", ".") || 0);
  const unit = prompt.match(/(?:in|after|tra|dopo)\s+\d+(?:[.,]\d+)?\s*(milliseconds?|seconds?|minutes?|hours?|days?|millisecondi|secondi|minuti|ore|giorni)/i)?.[1]?.toLowerCase();
  const multiplier = unit?.startsWith("millisecond") ? 1 : unit?.startsWith("minut") ? 60000 : unit?.startsWith("hour") || unit?.startsWith("or") ? 3600000 : unit?.startsWith("day") || unit?.startsWith("giorn") ? 86400000 : 1000;
  const delayMs = String(Math.min(604800000, Math.max(0, Math.round((amount || 2) * multiplier))));
  const flowId = `notify-${slug(componentId)}`.slice(0, 80);
  const flowExists = Array.isArray(context.flowIndex) && context.flowIndex.some((flow) => flow && typeof flow === "object" && (flow as { id?: string }).id === flowId);
  const operations: { type: string; pageId?: string; args: Record<string, unknown> }[] = flowExists ? [] : [
    { type: "add_flow", args: { flowId, name: `Notifica da ${String(context.componentName ?? componentId)}` } },
    { type: "add_flow_node", args: { flowId, node: { id: `${flowId}-event`, type: "event", label: trigger === "change" ? "Quando cambia" : "Al click", position: { x: 0, y: 0 }, config: { trigger, componentId } } } },
    { type: "add_flow_node", args: { flowId, node: { id: `${flowId}-notification`, type: "localNotification", label: "Programma promemoria", position: { x: 240, y: 0 }, config: { title, body, delayMs } } } },
    { type: "add_flow_node", args: { flowId, node: { id: `${flowId}-success`, type: "notify", label: "Confirmation", position: { x: 480, y: 0 }, config: { message: "Reminder scheduled", level: "success" } } } },
    { type: "connect_nodes", args: { flowId, source: `${flowId}-event`, target: `${flowId}-notification`, path: "success" } },
    { type: "connect_nodes", args: { flowId, source: `${flowId}-notification`, target: `${flowId}-success`, path: "success" } },
  ];
  operations.push({ type: "set_component_event", pageId, args: { componentId, event: trigger, flowId } });
  return `Immediate plan: connect ${String(context.componentName ?? componentId)} to a reusable, verifiable, undoable local notification.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

type IndexedSource = { id: string; name?: string; schema?: Record<string, unknown> };

export function quickDataViewsPlan(prompt: string, context: Record<string, unknown>) {
  if (!/(?:calendar|statistics?|charts?|calendario|statistic|grafici?|kpi).{0,60}(?:data|dynamic|real|connect|dati|dinamic|reali|collega)|(?:connect|make|collega|rendi).{0,60}(?:calendar|statistics?|charts?|calendario|statistic|grafici?|kpi)/i.test(prompt)) return undefined;
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
    if (cards[0]) { bind(cards[0], taskSource); property(cards[0], "metric", "completed"); property(cards[0], "metricSuffix", "tasks completed"); }
    if (cards[1]) { bind(cards[1], taskSource); property(cards[1], "metric", "active"); property(cards[1], "metricSuffix", "open tasks"); }
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
  return `Immediate plan: connect ${targets.length} visual views to existing sources with generic metrics, calendar, and refresh behavior.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

type IndexedComponent = { id: string; name: string; type: string; parentId?: string };

export function quickDashboardPlan(prompt: string, context: Record<string, unknown>) {
  if (!/dailyflow/i.test(String(context.projectName ?? ""))) return undefined;
  const asksToBuild = /(?:transform|create|build|compose|trasforma|crea|componi)/i.test(prompt);
  const asksForDashboard = /(?:dashboard|summary|riepilogo)/i.test(prompt);
  const asksForMobile = /(?:mobile|phone|telefono)/i.test(prompt);
  if (!asksToBuild || !asksForDashboard || !asksForMobile) return undefined;
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
    [header, "Daily header", "Good morning, Giulia · Sunday, July 19"],
    [hero, "Today's progress", "4 of 7 completed"],
    [grid, "Today summary", "Today"],
    [cards[0], "Next task", "Next task · 09:30"],
    [cards[1], "Appointments", "Appointments · 2 today"],
    [cards[2], "Habits", "Habits · 3 left"],
    [footer, "Bottom navigation", "Today · Tasks · Calendar · Habits · Statistics"],
  ];
  labels.forEach(([component, name, label]) => {
    if (component !== grid && component !== footer) op("set_component_property", { componentId: component.id, property: "name", value: name });
    op("set_component_property", { componentId: component.id, property: "label", value: label });
  });
  [[hero, "A clear view of your daily rhythm."], [cards[0], "Prepare the presentation · Work"], [cards[1], "Team meeting at 11:00 · Dentist at 17:30"], [cards[2], "Water, reading, and daily movement"]]
    .forEach(([component, description]) => op("set_component_property", { componentId: (component as IndexedComponent).id, property: "description", value: description }));
  const existingProgress = items.find((item) => /daily-progress/.test(item.id) || /(?:daily progress|progresso giornaliero)/i.test(item.name));
  const existingAdd = items.find((item) => /quick-add/.test(item.id) || /(?:quick add|aggiungi rapido)/i.test(item.name));
  const progressId = existingProgress?.id ?? `daily-progress-${hero.id.slice(0, 8)}`;
  const addId = existingAdd?.id ?? `quick-add-${header.id.slice(0, 8)}`;
  if (!existingProgress) op("add_component", { componentId: progressId, componentType: "progress", name: "Daily progress", parentId: hero.id, props: { label: "Daily progress", value: 4, max: 7 }, styles: { mobile: { width: "100%", minHeight: "12px", color: primary, background: "#2A3038", borderRadius: "999px" } }, accessibility: { label: "Daily progress, 4 of 7 tasks completed", role: "progressbar" } });
  else {
    op("set_component_property", { componentId: progressId, property: "name", value: "Daily progress" });
    op("set_component_property", { componentId: progressId, property: "label", value: "Daily progress" });
  }
  if (!existingAdd) op("add_component", { componentId: addId, componentType: "button", name: "Quick add", parentId: header.id, props: { label: "+ Add" }, styles: { mobile: { minHeight: "48px", color: "#111318", background: accent, borderRadius: "14px", padding: "12px 18px", fontWeight: "700" } }, accessibility: { label: "Quickly add an item", role: "button" }, intent: { role: "action", action: "create", entity: "item", expectedResult: "Start quick add", requiredStates: [], permissions: [] } });
  else {
    op("set_component_property", { componentId: addId, property: "name", value: "Quick add" });
    op("set_component_property", { componentId: addId, property: "label", value: "+ Add" });
  }
  const style = (componentId: string, property: string, value: string) => op("set_responsive_style", { componentId, breakpoint: "mobile", property, value });
  [[header.id, "background", "#0F1115"], [header.id, "color", "#F3F4F6"], [header.id, "padding", "20px 16px"], [hero.id, "background", "#171A1F"], [hero.id, "color", "#F3F4F6"], [hero.id, "borderRadius", "20px"], [hero.id, "padding", "20px"], [grid.id, "background", "#0F1115"], [grid.id, "color", "#F3F4F6"], [grid.id, "gridTemplateColumns", "1fr"], [grid.id, "gap", "12px"]]
    .forEach(([id, property, value]) => style(id, property, value));
  cards.forEach((card) => [["background", "#1D2229"], ["color", "#F3F4F6"], ["borderRadius", "16px"]].forEach(([property, value]) => style(card.id, property, value)));
  [["background", "#171A1F"], ["color", "#F3F4F6"], ["minHeight", "64px"]].forEach(([property, value]) => style(footer.id, property, value));
  op("set_component_state_style", { componentId: addId, state: "focus", property: "outline", value: `3px solid ${primary}` });
  op("set_component_state_style", { componentId: addId, state: "focus", property: "outlineOffset", value: "3px" });
  if (!operations.length || operations.length > 50) return undefined;
  return `Immediate plan: compose the mobile dashboard for ${String(context.projectName ?? "project")} from the graph index, without data or flows.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
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
    title: "Your day, finally in balance",
    description: "Tasks, appointments, and habits in one calm space that works offline.",
    items: [
      { id: "onboarding-title", type: "title", name: "Onboarding title", label: "Plan today. Breathe tomorrow." },
      { id: "onboarding-copy", type: "text", name: "Introduction", label: "DailyFlow turns a busy schedule into a simple rhythm you can follow." },
      { id: "onboarding-plan", type: "card", name: "Plan", label: "Plan with clarity", description: "Keep tasks and appointments together without losing the thread." },
      { id: "onboarding-habits", type: "card", name: "Build habits", label: "Build consistency", description: "Small daily steps with visible, encouraging streaks." },
      { id: "onboarding-offline", type: "card", name: "Always available", label: "Works offline", description: "Your data stays on your device and returns after every restart." },
      { id: "onboarding-start", type: "button", name: "Get started", label: "Start with DailyFlow", props: { role: "primary" } },
    ],
  },
  calendar: {
    title: "Calendar",
    description: "See appointments and tasks by day or week.",
    items: [
      { id: "calendar-title", type: "title", name: "Calendar title", label: "Your week" },
      { id: "calendar-view", type: "tabs", name: "Calendar view", label: "Day · Week", props: { tabs: "Day|Week" } },
      { id: "calendar-main", type: "calendar", name: "Weekly calendar", label: "July 19–25, 2026" },
      { id: "calendar-next", type: "card", name: "Next appointment", label: "Today · 11:00", description: "Team meeting · 45 minutes" },
      { id: "calendar-day", type: "list", name: "Daily agenda", label: "Today's agenda" },
      { id: "calendar-add", type: "button", name: "Add from calendar", label: "+ New task" },
    ],
  },
  "task-details": {
    title: "Task details",
    description: "Review and edit every detail of the selected task.",
    items: [
      { id: "detail-title", type: "title", name: "Details title", label: "Edit task" },
      { id: "detail-name", type: "input", name: "Task name", label: "Task name", props: { fieldName: "title", required: true, placeholder: "What needs to be done?" } },
      { id: "detail-description", type: "textarea", name: "Task description", label: "Description", props: { fieldName: "description", required: true } },
      { id: "detail-status", type: "select", name: "Task status", label: "Status", props: { fieldName: "status", options: "To do|In progress|Completed" } },
      { id: "detail-priority", type: "select", name: "Task priority", label: "Priority", props: { fieldName: "priority", options: "Low|Medium|High" } },
      { id: "detail-date", type: "input", name: "Task date", label: "Date", props: { fieldName: "dueDate", inputType: "date", required: true } },
      { id: "detail-notes", type: "textarea", name: "Task notes", label: "Notes", props: { fieldName: "notes" } },
      { id: "detail-save", type: "button", name: "Save changes", label: "Save changes", props: { buttonType: "submit" } },
      { id: "detail-delete", type: "button", name: "Delete task", label: "Delete task" },
    ],
  },
  habits: {
    title: "Daily habits",
    description: "Create sustainable routines and protect your streak day by day.",
    items: [
      { id: "habits-title", type: "title", name: "Habits title", label: "Your habits" },
      { id: "habits-progress", type: "progress", name: "Habits progress", label: "2 of 3 completed", props: { value: 2, max: 3 } },
      { id: "habit-water", type: "card", name: "Drink water", label: "Drink 8 glasses", description: "12-day streak · almost done" },
      { id: "habit-read", type: "card", name: "Read", label: "Read for 20 minutes", description: "7-day streak · completed" },
      { id: "habit-move", type: "card", name: "Move", label: "Walk for 30 minutes", description: "4-day streak · still to do" },
      { id: "habit-name", type: "input", name: "New habit name", label: "New habit", props: { fieldName: "name", required: true, placeholder: "Example: meditate for 10 minutes" } },
      { id: "habit-add", type: "button", name: "Add habit", label: "+ Add habit" },
      { id: "habits-toast", type: "toast", name: "Habit confirmation", label: "Habit updated" },
    ],
  },
  statistics: {
    title: "Weekly statistics",
    description: "Notice your progress, not only what remains to be done.",
    items: [
      { id: "stats-title", type: "title", name: "Statistics title", label: "Your week" },
      { id: "stats-completed", type: "card", name: "Completed tasks", label: "18 tasks", description: "+20% from last week" },
      { id: "stats-focus", type: "card", name: "Focus time", label: "9 h 40 min", description: "Tuesday was your most productive day" },
      { id: "stats-streak", type: "card", name: "Best streak", label: "12 days", description: "Drink 8 glasses" },
      { id: "stats-week-chart", type: "chart", name: "Tasks chart", label: "Tasks completed by day" },
      { id: "stats-habits-chart", type: "chart", name: "Habits chart", label: "Habit consistency" },
      { id: "stats-insight", type: "alert", name: "Insight", label: "Great rhythm: keep Wednesday evening free to protect your recovery." },
    ],
  },
  settings: {
    title: "Settings",
    description: "Personalize DailyFlow and stay in control of your data.",
    items: [
      { id: "settings-title", type: "title", name: "Settings title", label: "Your DailyFlow" },
      { id: "settings-theme", type: "select", name: "Theme", label: "App theme", props: { fieldName: "theme", options: "System|Light|Dark" } },
      { id: "settings-notifications", type: "checkbox", name: "Local notifications", label: "Reminders and local notifications", props: { fieldName: "notifications" } },
      { id: "settings-offline", type: "checkbox", name: "Offline mode", label: "Keep data available offline", props: { fieldName: "offline" } },
      { id: "settings-backup", type: "button", name: "Create backup", label: "Create a data backup" },
      { id: "settings-privacy", type: "card", name: "Privacy", label: "Your data stays yours", description: "Local storage, open export, and no platform lock-in." },
      { id: "settings-save", type: "button", name: "Save settings", label: "Save settings" },
    ],
  },
};

export function quickDailyFlowScreenPlan(prompt: string, context: Record<string, unknown>) {
  if (!/dailyflow/i.test(String(context.projectName ?? ""))) return undefined;
  if (!/(?:create|design|compose|complete|build|crea|progetta|componi|completa).{0,30}(?:screen|page|schermata|pagina)/i.test(prompt)) return undefined;
  const pages = Array.isArray(context.pages) ? context.pages as IndexedPage[] : [];
  const page = pages.find((item) => item.id === context.pageId);
  const key = slug(page?.name ?? "");
  const aliases: Record<string, string> = { calendario: "calendar", "dettaglio-attivita": "task-details", abitudini: "habits", statistiche: "statistics", impostazioni: "settings" };
  const spec = dailyFlowScreens[aliases[key] ?? key];
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
  const starterNames = /^(?:Header|New project|Nuovo progetto|Grid|Content|Contenuti|Footer|.+ grid|.+ card \d+)$/i;
  indexed
    .filter((item) => item.id !== rootId && !item.parentId && starterNames.test(item.name))
    .forEach((item) => op("remove_component", { componentId: item.id, confirmed: true }));
  op("set_component_property", { componentId: rootId, property: "name", value: spec.title });
  op("set_component_property", { componentId: rootId, property: "label", value: spec.title });
  op("set_component_property", { componentId: rootId, property: "description", value: spec.description });
  const style = (breakpoint: string, property: string, value: string) => op("set_responsive_style", { componentId: rootId, breakpoint, property, value });
  [["mobile", "padding", "20px 16px"], ["mobile", "gap", "14px"], ["mobile", "background", "#0F1115"], ["mobile", "color", "#F3F4F6"], ["tablet", "padding", "28px"], ["desktop", "padding", "40px"]]
    .forEach(([breakpoint, property, value]) => style(breakpoint, property, value));
  spec.items.forEach((item, index) => {
    const danger = item.id.includes("delete");
    if (existing.has(item.id)) {
      op("set_component_property", { componentId: item.id, property: "name", value: item.name });
      op("set_component_property", { componentId: item.id, property: "label", value: item.label });
      if (item.description) op("set_component_property", { componentId: item.id, property: "description", value: item.description });
      return;
    }
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
  return `Immediate plan: compose ${spec.title} from the current page graph with accessible, editable mobile components.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

export function quickCrudSurfacePlan(prompt: string, context: Record<string, unknown>) {
  if (!/(?:attivit|task)/i.test(prompt) || !/(?:source|database|sorgente).{0,20}(?:local|locale|indexeddb)/i.test(prompt) || !/form.{0,30}(?:list|lista)/is.test(prompt)) return undefined;
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
    op("create_data_source", { sourceId, name: "Tasks", provider: "indexeddb", collection: "tasks", schema: { id: "string", title: "string", description: "string", status: "string", priority: "string", category: "string", dueDate: "datetime", time: "string", notes: "string", recurring: "boolean", completed: "boolean" } });
  items.filter((item) => item.type === "card").slice(0, 3).forEach((item) => op("remove_component", { componentId: item.id, confirmed: true }));
  [[header, "name", "Tasks header"], [header, "label", "My tasks"], [section, "name", "Task management"], [section, "label", "Organize your day"], [section, "description", "Create, find, and complete tasks even when offline."], [grid, "name", "Task list area"], [grid, "label", "Tasks"]]
    .forEach(([component, property, value]) => op("set_component_property", { componentId: (component as IndexedComponent).id, property, value }));
  const add = (componentId: string, componentType: string, name: string, parentId: string | undefined, props: Record<string, unknown>, accessibility: Record<string, unknown>) => op("add_component", { componentId, componentType, name, ...(parentId ? { parentId } : {}), props, accessibility, styles: { mobile: { width: "100%", minHeight: "48px", borderRadius: "14px", padding: "12px", background: "#1D2229", color: "#F3F4F6" } } });
  add("tasks-form", "form", "New task", section.id, { label: "New task" }, { label: "New task form", role: "form" });
  add("task-title", "input", "Task name", "tasks-form", { fieldName: "title", placeholder: "What needs to be done?", required: true }, { label: "Task name" });
  add("task-description", "textarea", "Description", "tasks-form", { fieldName: "description", placeholder: "Add a description", required: true }, { label: "Task description" });
  add("task-status", "select", "Status", "tasks-form", { fieldName: "status", label: "To do", options: "To do|In progress|Completed" }, { label: "Task status" });
  add("task-priority", "select", "Priority", "tasks-form", { fieldName: "priority", label: "Medium", options: "Low|Medium|High" }, { label: "Task priority" });
  add("task-category", "input", "Category", "tasks-form", { fieldName: "category", placeholder: "Work, personal…" }, { label: "Task category" });
  add("task-date", "input", "Date", "tasks-form", { fieldName: "dueDate", inputType: "date", required: true }, { label: "Task date" });
  add("task-time", "input", "Time", "tasks-form", { fieldName: "time", inputType: "time" }, { label: "Task time" });
  add("task-notes", "textarea", "Notes", "tasks-form", { fieldName: "notes", placeholder: "Optional notes" }, { label: "Task notes" });
  add("task-recurring", "checkbox", "Recurring", "tasks-form", { fieldName: "recurring", label: "Repeat this task" }, { label: "Recurring task" });
  add("task-submit", "button", "Save task", "tasks-form", { label: "Save task", buttonType: "submit" }, { label: "Save task", role: "button" });
  add("task-search", "input", "Search tasks", grid.id, { fieldName: "search", inputType: "search", placeholder: "Search by text" }, { label: "Search tasks" });
  add("task-filter", "select", "Filter tasks", grid.id, { fieldName: "filter", label: "All statuses", options: "All statuses|To do|In progress|Completed" }, { label: "Filter by status" });
  add("tasks-list", "list", "Task list", grid.id, { label: "Saved tasks" }, { label: "Task list" });
  add("tasks-toast", "toast", "Task confirmation", undefined, { label: "Task saved" }, { label: "Operation confirmation", role: "status" });
  op("bind_component_data", { componentId: "tasks-list", sourceId, state: "data" });
  if (!operations.length || operations.length > 50) return undefined;
  return `Immediate plan: prepare the local CRUD surface for the Tasks page with an accessible form, search, filter, and states; flows will be connected in the next step.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}

export function quickCrudFlowsPlan(prompt: string, context: Record<string, unknown>) {
  if (!/(?:connect|create|collega|crea).{0,30}flow/i.test(prompt) || !/(?:load|carica|page.?load)/i.test(prompt) || !/(?:create|save|crea|salva).{0,20}(?:task|attivit)/i.test(prompt)) return undefined;
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
  const renameNode = (flowId: string, nodeId: string, label: string, config?: Record<string, string>) => op("update_flow_node", { flowId, nodeId, patch: { label, ...(config ? { config } : {}) } });
  if (!existingFlows.some((flow) => flow.id === "tasks-load")) {
    op("add_flow", { flowId: "tasks-load", name: "Load tasks" });
    node("tasks-load", "load-event", "event", "Page opened", 0, 0, { trigger: "pageLoad" });
    node("tasks-load", "load-query", "query", "Read local tasks", 220, 0, { sourceId });
    node("tasks-load", "load-refresh", "refresh", "Refresh list", 440, 0, { componentId: list.id });
    node("tasks-load", "load-error", "notify", "Load error", 440, 140, { message: "Unable to load tasks", level: "error" });
    edge("tasks-load", "load-event", "load-query");
    edge("tasks-load", "load-query", "load-refresh");
    edge("tasks-load", "load-query", "load-error", "error");
  } else {
    op("update_flow", { flowId: "tasks-load", name: "Load tasks" });
    renameNode("tasks-load", "load-event", "Page opened");
    renameNode("tasks-load", "load-query", "Read local tasks");
    renameNode("tasks-load", "load-refresh", "Refresh list");
    renameNode("tasks-load", "load-error", "Load error", { message: "Unable to load tasks", level: "error" });
  }
  if (!existingFlows.some((flow) => flow.id === "tasks-create")) {
    op("add_flow", { flowId: "tasks-create", name: "Create task" });
    node("tasks-create", "create-event", "event", "Form submitted", 0, 0, { trigger: "submit", componentId: form.id });
    node("tasks-create", "create-read", "readInput", "Read fields", 200, 0, { componentId: form.id });
    node("tasks-create", "validate-title", "validate", "Task name required", 400, 0, { field: "title", rule: "required", message: "Enter a task name" });
    node("tasks-create", "validate-date", "validate", "Date required", 600, 0, { field: "dueDate", rule: "required", message: "Choose a date" });
    node("tasks-create", "create-insert", "insert", "Save locally", 800, 0, { sourceId });
    node("tasks-create", "create-refresh", "refresh", "Refresh list", 1000, 0, { componentId: list.id });
    node("tasks-create", "create-success", "notify", "Confirmation", 1200, 0, { message: "Task saved", level: "success" });
    node("tasks-create", "create-error", "notify", "Error", 800, 180, { message: "Check the fields and try again", level: "error" });
    edge("tasks-create", "create-event", "create-read");
    edge("tasks-create", "create-read", "validate-title");
    edge("tasks-create", "validate-title", "validate-date");
    edge("tasks-create", "validate-title", "create-error", "error");
    edge("tasks-create", "validate-date", "create-insert");
    edge("tasks-create", "validate-date", "create-error", "error");
    edge("tasks-create", "create-insert", "create-refresh");
    edge("tasks-create", "create-insert", "create-error", "error");
    edge("tasks-create", "create-refresh", "create-success");
  } else {
    op("update_flow", { flowId: "tasks-create", name: "Create task" });
    renameNode("tasks-create", "create-event", "Form submitted");
    renameNode("tasks-create", "create-read", "Read fields");
    renameNode("tasks-create", "validate-title", "Task name required", { field: "title", rule: "required", message: "Enter a task name" });
    renameNode("tasks-create", "validate-date", "Date required", { field: "dueDate", rule: "required", message: "Choose a date" });
    renameNode("tasks-create", "create-insert", "Save locally");
    renameNode("tasks-create", "create-refresh", "Refresh list");
    renameNode("tasks-create", "create-success", "Confirmation", { message: "Task saved", level: "success" });
    renameNode("tasks-create", "create-error", "Error", { message: "Check the fields and try again", level: "error" });
  }
  if (!existingFlows.some((flow) => flow.id === "tasks-update")) {
    op("add_flow", { flowId: "tasks-update", name: "Update task" });
    node("tasks-update", "update-event", "event", "Record update requested", 0, 0, { trigger: "recordUpdate", componentId: list.id });
    node("tasks-update", "update-record", "update", "Update local task", 240, 0, { sourceId });
    node("tasks-update", "update-refresh", "refresh", "Refresh task list", 480, 0, { componentId: list.id });
    node("tasks-update", "update-success", "notify", "Update confirmed", 720, 0, { message: "Task updated", level: "success" });
    node("tasks-update", "update-error", "notify", "Update failed", 480, 150, { message: "Could not update the task", level: "error" });
    edge("tasks-update", "update-event", "update-record"); edge("tasks-update", "update-record", "update-refresh"); edge("tasks-update", "update-record", "update-error", "error"); edge("tasks-update", "update-refresh", "update-success");
  }
  if (!existingFlows.some((flow) => flow.id === "tasks-delete")) {
    op("add_flow", { flowId: "tasks-delete", name: "Delete task" });
    node("tasks-delete", "delete-event", "event", "Delete confirmed", 0, 0, { trigger: "recordDelete", componentId: list.id });
    node("tasks-delete", "delete-record", "delete", "Delete local task", 240, 0, { sourceId });
    node("tasks-delete", "delete-refresh", "refresh", "Refresh task list", 480, 0, { componentId: list.id });
    node("tasks-delete", "delete-success", "notify", "Deletion confirmed", 720, 0, { message: "Task deleted", level: "success" });
    node("tasks-delete", "delete-error", "notify", "Deletion failed", 480, 150, { message: "Could not delete the task", level: "error" });
    edge("tasks-delete", "delete-event", "delete-record"); edge("tasks-delete", "delete-record", "delete-refresh"); edge("tasks-delete", "delete-record", "delete-error", "error"); edge("tasks-delete", "delete-refresh", "delete-success");
  }
  op("set_component_event", { componentId: form.id, event: "submit", flowId: "tasks-create" });
  op("set_component_event", { componentId: list.id, event: "recordUpdate", flowId: "tasks-update" });
  op("set_component_event", { componentId: list.id, event: "recordDelete", flowId: "tasks-delete" });
  if (!operations.length || operations.length > 50) return undefined;
  return `Immediate plan: connect task loading and creation with success/error nodes and a stable submit event.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
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
    op("create_data_source", { sourceId, name: "Habits", provider: "indexeddb", collection: "habits", schema: { id: "string", name: "string", frequency: "string", currentStreak: "number", bestStreak: "number", completedToday: "boolean", lastCompletedAt: "datetime" } });
  components.filter((item) => /^habit-(?:water|read|move)$/.test(item.id)).forEach((item) => op("remove_component", { componentId: item.id, confirmed: true }));
  if (!components.some((item) => item.id === "habits-form")) {
    op("add_component", { componentId: "habits-form", componentType: "form", name: "New habit", parentId: root.id, props: { label: "New habit" }, accessibility: { label: "New habit form", role: "form" } });
    op("move_component", { componentId: nameInput.id, parentId: "habits-form" });
    op("set_component_property", { componentId: nameInput.id, property: "fieldName", value: "name" });
    op("set_component_property", { componentId: nameInput.id, property: "required", value: true });
    op("add_component", { componentId: "habit-frequency", componentType: "select", name: "Frequency", parentId: "habits-form", props: { label: "Frequency", fieldName: "frequency", options: "Every day|Weekdays|Every week" }, accessibility: { label: "Habit frequency" } });
    op("move_component", { componentId: addButton.id, parentId: "habits-form" });
    op("set_component_property", { componentId: addButton.id, property: "buttonType", value: "submit" });
  }
  if (!components.some((item) => item.id === "habits-list")) {
    op("add_component", { componentId: "habits-list", componentType: "list", name: "Habit list", parentId: root.id, props: { label: "Saved habits" }, accessibility: { label: "Habit list" } });
    op("bind_component_data", { componentId: "habits-list", sourceId, state: "data" });
  }
  if (!flows.some((flow) => flow.id === "habits-load")) {
    op("add_flow", { flowId: "habits-load", name: "Load habits" });
    node("habits-load", "habits-load-event", "event", "Page opened", 0, 0, { trigger: "pageLoad" });
    node("habits-load", "habits-load-query", "query", "Read local habits", 220, 0, { sourceId });
    node("habits-load", "habits-load-refresh", "refresh", "Refresh list and progress", 440, 0, { componentId: "habits-list" });
    node("habits-load", "habits-load-error", "notify", "Load error", 440, 140, { message: "Habits could not be loaded", level: "error" });
    edge("habits-load", "habits-load-event", "habits-load-query"); edge("habits-load", "habits-load-query", "habits-load-refresh"); edge("habits-load", "habits-load-query", "habits-load-error", "error");
  }
  if (!flows.some((flow) => flow.id === "habits-create")) {
    op("add_flow", { flowId: "habits-create", name: "Create habit" });
    node("habits-create", "habits-create-event", "event", "Form submitted", 0, 0, { trigger: "submit", componentId: "habits-form" });
    node("habits-create", "habits-create-read", "readInput", "Read fields", 200, 0, { componentId: "habits-form" });
    node("habits-create", "habits-create-validate", "validate", "Name required", 400, 0, { field: "name", rule: "required", message: "Enter the habit name" });
    node("habits-create", "habits-create-insert", "insert", "Save locally", 600, 0, { sourceId });
    node("habits-create", "habits-create-refresh", "refresh", "Refresh list", 800, 0, { componentId: "habits-list" });
    node("habits-create", "habits-create-success", "notify", "Confirmation", 1000, 0, { message: "Habit saved", level: "success" });
    node("habits-create", "habits-create-error", "notify", "Error", 600, 160, { message: "Check the name and try again", level: "error" });
    edge("habits-create", "habits-create-event", "habits-create-read"); edge("habits-create", "habits-create-read", "habits-create-validate"); edge("habits-create", "habits-create-validate", "habits-create-insert"); edge("habits-create", "habits-create-validate", "habits-create-error", "error"); edge("habits-create", "habits-create-insert", "habits-create-refresh"); edge("habits-create", "habits-create-insert", "habits-create-error", "error"); edge("habits-create", "habits-create-refresh", "habits-create-success");
    op("set_component_event", { componentId: "habits-form", event: "submit", flowId: "habits-create" });
  }
  if (!flows.some((flow) => flow.id === "habits-complete")) {
    op("add_flow", { flowId: "habits-complete", name: "Complete habit" });
    node("habits-complete", "habits-complete-event", "event", "Completion requested", 0, 0, { trigger: "recordAction", componentId: "habits-list" });
    node("habits-complete", "habits-complete-update", "update", "Update streak", 240, 0, { sourceId });
    node("habits-complete", "habits-complete-refresh", "refresh", "Refresh list and progress", 480, 0, { componentId: "habits-list" });
    node("habits-complete", "habits-complete-success", "notify", "Completion confirmed", 720, 0, { message: "Habit completed", level: "success" });
    node("habits-complete", "habits-complete-error", "notify", "Completion error", 480, 150, { message: "The habit could not be updated", level: "error" });
    edge("habits-complete", "habits-complete-event", "habits-complete-update"); edge("habits-complete", "habits-complete-update", "habits-complete-refresh"); edge("habits-complete", "habits-complete-update", "habits-complete-error", "error"); edge("habits-complete", "habits-complete-refresh", "habits-complete-success");
  }
  op("set_component_event", { componentId: "habits-list", event: "recordUpdate", flowId: "habits-complete" });
  const englishLabels: Record<string, { name: string; label: string; options?: string }> = {
    "habits-form": { name: "New habit", label: "New habit" },
    "habit-name": { name: "New habit name", label: "New habit" },
    "habit-frequency": { name: "Frequency", label: "Frequency", options: "Every day|Weekdays|Every week" },
    "habit-add": { name: "Add habit", label: "+ Add habit" },
    "habits-list": { name: "Habit list", label: "Saved habits" },
  };
  Object.entries(englishLabels).forEach(([componentId, values]) => {
    if (!components.some((component) => component.id === componentId)) return;
    op("set_component_property", { componentId, property: "name", value: values.name });
    op("set_component_property", { componentId, property: "label", value: values.label });
    if (values.options) op("set_component_property", { componentId, property: "options", value: values.options });
  });
  if (!operations.length || operations.length > 50) return undefined;
  return `Immediate plan: connect Habits to IndexedDB with a validated form, list, and visual load/create/complete flows.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
}
