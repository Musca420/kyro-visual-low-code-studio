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
  if (/navigazione inferiore|barra inferiore/i.test(prompt)) appPatch.mobileBottomNavigation = {
    enabled: true,
    items: [
      { label: "Oggi", path: "/oggi" },
      { label: "Attività", path: "/attivita" },
      { label: "Calendario", path: "/calendario" },
      { label: "Abitudini", path: "/abitudini" },
      { label: "Statistiche", path: "/statistiche" },
    ],
  };
  if (Object.keys(appPatch).length) operations.push({ type: "set_app_config", args: { patch: appPatch } });
  if (/android/i.test(prompt) && context.exportTarget !== "android")
    operations.push({ type: "set_export_config", args: { patch: { target: "android", capacitor: true } } });
  if (!operations.length || operations.length > 50) return undefined;
  return `Piano immediato: aggiorna la struttura indicizzata di ${String(context.projectName ?? "progetto")} con ${operations.length} operazioni atomiche e annullabili.\nFRONTEND_EDITOR_OPERATIONS=${JSON.stringify(operations)}`;
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
