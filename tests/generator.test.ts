import { describe, expect, it } from "vitest";
import { generateFiles } from "../src/generator";
import { createProject, makeComponent } from "../src/model";
import { createTemplateProject } from "../src/templates";

describe("web generator", () => {
  it("genera calendario, grafici e KPI collegati a sorgenti reali", () => {
    const project = createProject("Insights");
    const calendar = makeComponent("calendar"), chart = makeComponent("chart"), kpi = makeComponent("card");
    calendar.id = "agenda"; chart.id = "trend"; kpi.id = "completed"; kpi.props.metric = "completed"; kpi.props.metricSuffix = "completate";
    calendar.binding = { sourceId: "tasks", state: "data" }; chart.binding = { sourceId: "tasks", state: "data" }; kpi.binding = { sourceId: "tasks", state: "data" };
    project.pages.push({ id: "page", name: "Dati", path: "/dati", components: [calendar, chart, kpi] });
    project.dataSources.push({ id: "tasks", name: "Attività", provider: "indexeddb", collection: "tasks", schema: { id: "string", dueDate: "datetime", completed: "boolean" }, capabilities: ["get", "query", "insert", "update", "delete", "subscribe"], secretStrategy: "none" });
    const files = generateFiles(project), source = files["src/main.ts"];
    expect(files["index.html"]).toContain('id="agenda" data-kind="calendar"');
    expect(files["index.html"].match(/<rect/g)).toHaveLength(7);
    expect(source).toContain('"kind":"calendar"');
    expect(source).toContain('"metric":"completed"');
    expect(source).toContain("const renderBoundData");
    expect(source).toContain("Nessun elemento in questa data");
  });
  it("esporta notifiche locali web e Android solo quando il grafo le usa", () => {
    const project = createProject("Reminder app");
    project.exportConfig.target = "android";
    project.pages.push({ id: "page", name: "Home", path: "/", components: [] });
    project.flows.push({ id: "reminder", name: "Promemoria", nodes: [
      { id: "event", type: "event", label: "Click", position: { x: 0, y: 0 }, config: {} },
      { id: "notification", type: "localNotification", label: "Programma", position: { x: 1, y: 0 }, config: { title: "Promemoria", body: "Controlla", delayMs: "2000" } },
    ], edges: [{ id: "edge", source: "event", target: "notification", path: "success" }] });
    const files = generateFiles(project), pkg = JSON.parse(files["package.json"]);
    expect(files["src/main.ts"]).toContain("graphScheduleLocalNotification");
    expect(files["src/main.ts"]).toContain("LocalNotifications.schedule");
    expect(files["src/main.ts"]).toContain("current.type === 'localNotification'");
    expect(pkg.dependencies["@capacitor/local-notifications"]).toBe("^8.0.0");
    expect(files["scripts/configure-android.mjs"]).toContain("android.permission.POST_NOTIFICATIONS");
  });

  it("deriva capacità native, dipendenze e permessi Android dal grafo", () => {
    const project = createProject("Native graph export");
    project.pages.push({ id: "home", name: "Home", path: "/", components: [] });
    project.exportConfig = { target: "android", capacitor: true, android: { packageId: "studio.kyro.nativegraph", appName: "Native graph", orientation: "any", themeColor: "#00b8c8", versionName: "1.0.0", versionCode: 1, permissions: [], statusBarStyle: "dark", keyboardResize: true, backButton: true } };
    project.flows.push({ id: "device", name: "Device", nodes: [
      { id: "event", type: "event", label: "Tap", position: { x: 0, y: 0 }, config: { trigger: "pageLoad", pageId: "home" } },
      { id: "permission", type: "requestPermission", label: "Permission", position: { x: 1, y: 0 }, config: { permission: "camera", rationale: "Take a profile photo" } },
      { id: "platform", type: "platformCondition", label: "Android 15", position: { x: 2, y: 0 }, config: { platform: "android", minVersion: "15" } },
      { id: "photo", type: "nativeAction", label: "Photo", position: { x: 3, y: 0 }, config: { capability: "camera", action: "takePhoto" } },
    ], edges: [
      { id: "1", source: "event", target: "permission", path: "success" },
      { id: "2", source: "permission", target: "platform", path: "success" },
      { id: "3", source: "platform", target: "photo", path: "success" },
    ] });
    const files = generateFiles(project), pkg = JSON.parse(files["package.json"]);
    expect(pkg.dependencies).toMatchObject({ "@capacitor/camera": "^8.0.0", "@capacitor/device": "^8.0.0" });
    expect(files["src/native.ts"]).toContain("Camera.getPhoto");
    expect(files["src/main.ts"]).toContain("requestNativePermission");
    expect(files["src/main.ts"]).toContain("graphPlatformMatches");
    expect(files["scripts/configure-android.mjs"]).toContain("android.permission.CAMERA");
  });
  it("mantiene la navigazione mobile configurata nell'app esportata", () => {
    const project = createProject("Mobile routes");
    project.pages.push(
      { id: "home", name: "Home", path: "/home", components: [] },
      { id: "data", name: "Dati", path: "/data", components: [] },
      { id: "settings", name: "Impostazioni", path: "/settings", components: [] },
    );
    project.appConfig.mobileBottomNavigation = {
      enabled: true,
      items: [{ label: "Home", path: "/home" }, { label: "Dati", path: "/data" }],
    };
    const files = generateFiles(project);
    expect(files["index.html"]).toContain('class="app-bottom-nav"');
    expect(files["src/main.ts"]).toContain("aria-current");
    expect(files["src/style.css"]).toContain("safe-area-inset-bottom");
    expect(files["index.html"]).toContain('class="app-nav-more"');
    expect(files["index.html"]).toContain('href="#/settings"');
    expect(files["src/main.ts"]).toContain(".app-nav-more");
  });

  it("mantiene tipi, vincoli e opzioni dei form visuali", () => {
    const project = createProject("Form parity");
    const time = makeComponent("input"), description = makeComponent("textarea"), status = makeComponent("select"), toast = makeComponent("toast");
    time.props.inputType = "time"; time.props.required = true;
    description.props.required = true; description.props.placeholder = "Dettagli";
    status.props.options = "Nuovo|Attivo|Concluso";
    project.pages.push({ id: "form", name: "Form", path: "/", components: [time, description, status, toast] });
    const html = generateFiles(project)["index.html"];
    expect(html).toContain('type="time"');
    expect(html).toContain('required');
    expect(html).toContain('placeholder="Dettagli"');
    expect(html).toContain('<option>Concluso</option>');
    expect(html).toContain('aria-live="polite" hidden');
    const checkbox = makeComponent("checkbox"); checkbox.id = "enabled"; checkbox.props.label = "Attivo";
    project.pages[0].components.push(checkbox);
    const choiceFiles = generateFiles(project);
    expect(choiceFiles["index.html"]).toContain('id="enabled" class="choice-control"');
    expect(choiceFiles["src/style.css"]).toContain(".choice-control input{width:20px");
  });

  it("isola più sorgenti e binding nel runtime esportato", () => {
    const project = createProject("Multi data");
    const tasks = makeComponent("list"), habits = makeComponent("list");
    tasks.id = "tasks-list";
    habits.id = "habits-list";
    tasks.binding = { sourceId: "tasks", state: "data" };
    habits.binding = { sourceId: "habits", state: "data" };
    project.pages.push(
      { id: "tasks-page", name: "Attività", path: "/tasks", components: [tasks] },
      { id: "habits-page", name: "Abitudini", path: "/habits", components: [habits] },
    );
    project.dataSources.push(
      { id: "tasks", name: "Attività", provider: "indexeddb", collection: "tasks", schema: { id: "string", title: "string" }, capabilities: ["get", "query", "insert", "update", "delete", "subscribe"], secretStrategy: "none" },
      { id: "habits", name: "Abitudini", provider: "indexeddb", collection: "habits", schema: { id: "string", name: "string" }, capabilities: ["get", "query", "insert", "update", "delete", "subscribe"], secretStrategy: "none" },
    );
    project.flows.push({ id: "load-habits", name: "Carica abitudini", nodes: [
      { id: "event", type: "event", label: "Apertura", position: { x: 0, y: 0 }, config: { trigger: "pageLoad" } },
      { id: "query", type: "query", label: "Leggi", position: { x: 1, y: 0 }, config: { sourceId: "habits" } },
      { id: "refresh", type: "refresh", label: "Aggiorna", position: { x: 2, y: 0 }, config: { componentId: "habits-list" } },
    ], edges: [
      { id: "e1", source: "event", target: "query", path: "success" },
      { id: "e2", source: "query", target: "refresh", path: "success" },
    ] });
    const source = generateFiles(project)["src/main.ts"];
    expect(source).toContain('"componentId":"tasks-list","sourceId":"tasks"');
    expect(source).toContain('"componentId":"habits-list","sourceId":"habits"');
    expect(source).toContain("query(current.config.sourceId)");
    expect(source).toContain("refresh(current.config.componentId)");
    expect(source).toContain("getAll(selectedSourceId)");
    expect(source).toContain("const fields: Record<string, unknown>");
    expect(source).toContain("frontend-editor-theme");
  });

  it("emits a typed, runnable and secret-free project", () => {
    const project = createProject("Export Test");
    project.pages.push({
      id: "page",
      name: "Home",
      path: "/home",
      components: [
        makeComponent("input"),
        makeComponent("button"),
        makeComponent("list"),
      ],
    });
    project.dataSources.push({
      id: "source",
      name: "Items",
      provider: "indexeddb",
      collection: "items",
      schema: { id: "string", text: "string", date: "datetime" },
      capabilities: ["get", "query", "insert", "update", "delete", "subscribe"],
      secretStrategy: "none",
    });
    project.theme.tokens.pageBackground = "#dff9ee";
    project.theme.tokens.pageBackgroundImage =
      "linear-gradient(135deg, #6d5dfc, #21c8a4)";
    const files = generateFiles(project);
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        "package.json",
        "src/main.ts",
        "src/style.css",
        "capacitor.config.ts",
        "README.md",
      ]),
    );
    expect(files["src/main.ts"]).toContain("indexedDB.open");
    expect(files["src/style.css"]).toContain("background:#dff9ee");
    expect(files["src/style.css"]).toContain("linear-gradient(135deg, #6d5dfc, #21c8a4)");
    expect(files["src/main.ts"]).not.toMatch(
      /(?:password|apiKey|token)\s*[:=]\s*["'][^"']+/i,
    );
    expect(JSON.parse(files["package.json"]).scripts.build).toBe(
      "tsc && vite build",
    );
  });

  it("esporta i moduli protetti e li collega al percorso generato", () => {
    const project = createProject("Advanced export");
    project.pages.push({ id: "page", name: "Home", path: "/", components: [makeComponent("input"), makeComponent("button"), makeComponent("list")] });
    project.codeModules.push({ id: "clean", name: "Pulisci", description: "", inputType: "string", outputType: "string", operation: "trim", config: {}, tests: [] });
    project.flows.push({ id: "flow", name: "Create", nodes: [{ id: "start", type: "event", label: "Start", position: { x: 0, y: 0 }, config: {} }, { id: "module", type: "module", label: "Pulisci", position: { x: 1, y: 0 }, config: { moduleId: "clean" } }], edges: [{ id: "edge", source: "start", target: "module", path: "success" }] });
    project.pages[0].components[1].events.click = "flow";
    const files = generateFiles(project);
    expect(files["src/extensions/module-clean.ts"]).toContain("export function run");
    expect(files["src/main.ts"]).toContain("async function runGraph");
    expect(files["src/main.ts"]).toContain("extensionRunners");
  });

  it("esporta trigger visuali per apertura pagina, timer e input utente", () => {
    const project = createProject("Trigger export");
    const input = makeComponent("input");
    input.id = "search";
    input.events.change = "search-flow";
    const button = makeComponent("button");
    button.id = "hold";
    button.events.longPress = "hold-flow";
    project.pages.push({ id: "page", name: "Home", path: "/", components: [input, button] });
    project.flows.push(
      { id: "search-flow", name: "Cerca", nodes: [{ id: "change", type: "event", label: "Quando cambia", position: { x: 0, y: 0 }, config: { trigger: "change", componentId: "search" } }, { id: "ui", type: "updateUI", label: "Cambia campo", position: { x: 1, y: 0 }, config: { componentId: "search", operation: "background", value: "#22d3ee" } }], edges: [{ id: "edge", source: "change", target: "ui", path: "success" }] },
      { id: "hold-flow", name: "Tieni premuto", nodes: [{ id: "hold-event", type: "event", label: "Pressione lunga", position: { x: 0, y: 0 }, config: { trigger: "longPress", componentId: "hold" } }], edges: [] },
      { id: "load-flow", name: "Carica", nodes: [{ id: "load", type: "event", label: "Apertura", position: { x: 0, y: 0 }, config: { trigger: "pageLoad" } }], edges: [] },
      { id: "timer-flow", name: "Aggiorna", nodes: [{ id: "timer", type: "event", label: "Timer", position: { x: 0, y: 0 }, config: { trigger: "timer", interval: "1200" } }], edges: [] },
      { id: "online-flow", name: "Online", nodes: [{ id: "online", type: "event", label: "Online", position: { x: 0, y: 0 }, config: { trigger: "online", pageId: "page" } }], edges: [] },
    );
    const source = generateFiles(project)["src/main.ts"];
    expect(source).toContain('graphListen(element, "change"');
    expect(source).toContain('graphListen(element, "longPress"');
    expect(source).toContain("name === 'longPress'");
    expect(source).toContain('void runGraph("load-flow")');
    expect(source).toContain('setInterval(() => { if (graphPageMatches(undefined)) void runGraph("timer-flow") }, 1200)');
    expect(source).toContain('addEventListener("online"');
    expect(source).toContain("current.type === 'updateUI'");
    expect(source).toContain("typeof value === 'object'");
    expect(source).toContain("Object.fromEntries(new FormData");
    expect(source).toContain("current.config.rule || 'required'");
  });

  it("esporta la scelta e la preparazione sicura dei file", () => {
    const project = createProject("File export");
    const upload = makeComponent("upload");
    upload.id = "asset";
    upload.events.change = "upload-flow";
    project.pages.push({ id: "page", name: "Home", path: "/", components: [upload] });
    project.flows.push({ id: "upload-flow", name: "Carica", nodes: [
      { id: "event", type: "event", label: "File scelto", position: { x: 0, y: 0 }, config: { trigger: "change", componentId: "asset" } },
      { id: "file", type: "file", label: "Prepara file", position: { x: 1, y: 0 }, config: { maxMb: "2", accept: "image/*" } },
    ], edges: [{ id: "edge", source: "event", target: "file", path: "success" }] });
    const source = generateFiles(project)["src/main.ts"];
    expect(source).toContain("const graphPrepareFile");
    expect(source).toContain("target.files?.[0]");
    expect(source).toContain("current.type === 'file'");
  });

  it("esporta controllo ruolo e logout dal grafo", () => {
    const project = createProject("Access flow");
    project.pages.push({ id: "page", name: "Home", path: "/", components: [] });
    project.flows.push({ id: "access", name: "Accesso", nodes: [
      { id: "event", type: "event", label: "Apertura", position: { x: 0, y: 0 }, config: { trigger: "pageLoad" } },
      { id: "role", type: "requireRole", label: "Solo admin", position: { x: 1, y: 0 }, config: { roles: "admin" } },
      { id: "logout", type: "signOut", label: "Esci", position: { x: 2, y: 0 }, config: {} },
    ], edges: [{ id: "1", source: "event", target: "role", path: "success" }, { id: "2", source: "role", target: "logout", path: "success" }] });
    const source = generateFiles(project)["src/main.ts"];
    expect(source).toContain("const graphRole");
    expect(source).toContain("current.type === 'requireRole'");
    expect(source).toContain("sessionStorage.removeItem('frontend-editor-session')");
  });

  it("esporta pagina, indietro e URL sicuro dal nodo navigazione", () => {
    const project = createProject("Navigation export");
    project.pages.push({ id: "page", name: "Home", path: "/", components: [] });
    project.flows.push({ id: "navigation", name: "Naviga", nodes: [
      { id: "event", type: "event", label: "Apertura", position: { x: 0, y: 0 }, config: { trigger: "pageLoad" } },
      { id: "navigate", type: "navigate", label: "Indietro", position: { x: 1, y: 0 }, config: { mode: "back" } },
    ], edges: [{ id: "edge", source: "event", target: "navigate", path: "success" }] });
    const source = generateFiles(project)["src/main.ts"];
    expect(source).toContain("const graphNavigate");
    expect(source).toContain("history.back()");
    expect(source).toContain("location.assign(url.toString())");
  });

  it("esporta apertura e chiusura modal dal medesimo nodo", () => {
    const project = createProject("Modal export");
    project.pages.push({ id: "page", name: "Home", path: "/", components: [] });
    project.flows.push({ id: "modal", name: "Modal", nodes: [
      { id: "event", type: "event", label: "Apertura", position: { x: 0, y: 0 }, config: { trigger: "pageLoad" } },
      { id: "close", type: "openModal", label: "Chiudi", position: { x: 1, y: 0 }, config: { componentId: "dialog", operation: "close" } },
    ], edges: [{ id: "edge", source: "event", target: "close", path: "success" }] });
    const source = generateFiles(project)["src/main.ts"];
    expect(source).toContain("current.config.operation === 'close'");
    expect(source).toContain("setAttribute('hidden', '')");
  });

  it("esegue i flow automatici solo nella pagina configurata", () => {
    const project = createProject("Scoped automatic flows");
    project.pages.push(
      { id: "home", name: "Home", path: "/", components: [] },
      { id: "stats", name: "Statistiche", path: "/statistiche", components: [] },
    );
    project.flows.push({ id: "stats-load", name: "Carica statistiche", nodes: [
      { id: "event", type: "event", label: "Apertura", position: { x: 0, y: 0 }, config: { trigger: "pageLoad", pageId: "stats" } },
    ], edges: [] });
    const source = generateFiles(project)["src/main.ts"];
    expect(source).toContain('const graphPageMatches');
    expect(source).toContain('graphPageMatches("/statistiche")');
    expect(source).toContain("addEventListener('hashchange', graphRunPageLoads)");
  });

  it("esporta il caricamento di un singolo record per ID", () => {
    const project = createProject("Get export");
    project.pages.push({ id: "page", name: "Home", path: "/", components: [] });
    project.flows.push({ id: "get", name: "Leggi", nodes: [
      { id: "event", type: "event", label: "Input", position: { x: 0, y: 0 }, config: { trigger: "pageLoad" } },
      { id: "query", type: "query", label: "Uno", position: { x: 1, y: 0 }, config: { mode: "one", id: "fixed-id" } },
    ], edges: [{ id: "edge", source: "event", target: "query", path: "success" }] });
    const source = generateFiles(project)["src/main.ts"];
    expect(source).toContain("current.config.mode === 'one'");
    expect(source).toContain("Record ' + String(id) + ' non trovato");
  });

  it("preserves nested containers in the exported markup", () => {
    const project = createProject("Nested Export");
    const stack = makeComponent("stack"),
      button = makeComponent("button");
    stack.id = "stack";
    stack.props.label = "Titolo contenitore";
    button.id = "nested-button";
    button.parentId = stack.id;
    project.pages.push({
      id: "page",
      name: "Home",
      path: "/",
      components: [stack, button],
    });
    const html = generateFiles(project)["index.html"];
    expect(html).toContain("Titolo contenitore");
    expect(html).toContain(
      '<div id="stack" class="generated-container generated-stack"',
    );
    expect(html.indexOf('id="stack"')).toBeLessThan(
      html.indexOf('id="nested-button"'),
    );
    expect(html).toMatch(/id="stack"[^]*id="nested-button"[^]*<\/div>/);
  });

  it("exports responsive visual styles and interaction states", () => {
    const project = createProject("Visual states"),
      button = makeComponent("button");
    button.id = "action";
    button.styles.mobile.display = "none";
    button.states.hover = {
      transform: "scale(1.05)",
      boxShadow: "0 10px 30px #0003",
    };
    button.props.tooltip = "Azione principale";
    project.pages.push({
      id: "page",
      name: "Home",
      path: "/",
      components: [button],
    });
    const files = generateFiles(project);
    expect(files["index.html"]).toContain('title="Azione principale"');
    expect(files["src/style.css"]).toContain(
      '[id="action"]:hover{transform:scale(1.05);box-shadow:0 10px 30px #0003}',
    );
    expect(files["src/style.css"]).toMatch(
      /@media\(max-width:600px\)[^{]*\{[^]*display:none/,
    );
  });

  it("generates installable PWA assets without a plugin dependency", () => {
    const project = createProject("Offline Notes");
    project.exportConfig = { target: "pwa", capacitor: false };
    project.pages.push({
      id: "page",
      name: "Home",
      path: "/",
      components: [makeComponent("title")],
    });
    const files = generateFiles(project);
    expect(files["index.html"]).toContain('rel="manifest"');
    expect(files["src/main.ts"]).toContain("serviceWorker.register");
    expect(JSON.parse(files["public/app.webmanifest"])).toMatchObject({
      name: "Offline Notes",
      display: "standalone",
    });
    expect(files["public/service-worker.js"]).toContain("caches.open");
  });

  it("exports semantic multipage templates instead of empty component placeholders", () => {
    const files = generateFiles(
      createTemplateProject("portfolio", "Studio Forma"),
    );
    expect(files["index.html"]).toContain("<header");
    expect(files["index.html"]).toContain("<footer");
    expect(files["index.html"]).toContain('href="#/projects"');
    expect(files["index.html"]).toContain("A complete, responsive, and fully editable starting point.");
  });

  it("mantiene il grafo unificato negli export landing e dashboard rifiniti", () => {
    for (const template of ["landing", "dashboard"] as const) {
      const project = createTemplateProject(template, `Graph ${template}`);
      const button = project.pages.flatMap((page) => page.components).find((component) => component.type === "button")!;
      const flowId = `flow-${template}`;
      button.events.click = flowId;
      project.flows.push({ id: flowId, name: "Azione personalizzata", nodes: [
        { id: "event", type: "event", label: "Click", position: { x: 0, y: 0 }, config: { trigger: "click", componentId: button.id } },
        { id: "ui", type: "updateUI", label: "Cambia", position: { x: 1, y: 0 }, config: { componentId: button.id, operation: "text", value: "Fatto" } },
      ], edges: [{ id: "edge", source: "event", target: "ui", path: "success" }] });
      if (template === "dashboard" && !project.dataSources.length) project.dataSources.push({ id: "source", name: "Progetti", provider: "indexeddb", collection: "projects", schema: { id: "string", text: "string", date: "datetime" }, capabilities: ["get", "query", "insert", "update", "delete"], secretStrategy: "none" });
      const files = generateFiles(project);
      expect(files["src/main.ts"]).toContain("async function runGraph");
      expect(files["src/main.ts"]).toContain(`void runGraph(${JSON.stringify(flowId)}`);
      expect(files["index.html"]).toContain(`data-component="${button.id}"`);
      expect(files["src/main.ts"]).toContain("const graphElement");
    }
  });

  it("generates a Capacitor 8 Android configuration and guided scripts", () => {
    const project = createProject("Field App");
    project.exportConfig = {
      target: "android",
      capacitor: true,
      android: {
        packageId: "com.example.fieldapp",
        appName: "Field App",
        orientation: "portrait",
        themeColor: "#123456",
        versionName: "1.0.0",
        versionCode: 1,
        permissions: ["camera"],
        statusBarStyle: "dark",
        keyboardResize: true,
        backButton: true,
      },
    };
    project.pages.push({
      id: "page",
      name: "Home",
      path: "/home",
      components: [makeComponent("title")],
    });
    const files = generateFiles(project),
      pkg = JSON.parse(files["package.json"]);
    expect(pkg.dependencies).toMatchObject({
      "@capacitor/core": "^8.0.0",
      "@capacitor/android": "^8.0.0",
      "@capacitor/app": "^8.0.0",
      "@capacitor/status-bar": "^8.0.0",
    });
    expect(pkg.scripts["android:sync"]).toContain("cap sync android");
    expect(pkg.scripts["android:configure"]).toContain("configure-android.mjs");
    expect(files["capacitor.config.ts"]).toContain(
      'appId: "com.example.fieldapp"',
    );
    expect(JSON.parse(files["android.frontend-editor.json"])).toMatchObject({
      orientation: "portrait",
      permissions: ["camera"],
    });
    expect(files["scripts/configure-android.mjs"]).toContain(
      "android:screenOrientation",
    );
    expect(files["scripts/configure-android.mjs"]).toContain("portrait");
    expect(files["scripts/configure-android.mjs"]).toContain(
      "android.permission.CAMERA",
    );
    expect(files["src/main.ts"]).toContain("NativeApp.addListener");
    expect(files["src/main.ts"]).toContain("StatusBar.setStyle");
    expect(files["src/main.ts"]).toContain("Capacitor.isNativePlatform()");
    expect(files["src/main.ts"]).toContain("location.hash.slice(1) || \"/home\"");
    expect(files["src/main.ts"]).toContain("StatusBarStyle.Light");
    expect(files["src/style.css"]).toContain("safe-area-inset-top");
    expect(files["index.html"]).toContain("viewport-fit=cover");
  });

  it("generates a persistent REST backend and keeps secrets in the environment", () => {
    const project = createProject("Backend Notes");
    project.pages.push({
      id: "page",
      name: "Home",
      path: "/",
      components: [
        makeComponent("input"),
        makeComponent("button"),
        makeComponent("list"),
      ],
    });
    project.dataSources.push({
      id: "backend",
      name: "Notes backend",
      provider: "generated",
      collection: "records",
      schema: { id: "string", text: "string", date: "datetime" },
      capabilities: ["get", "query", "insert", "update", "delete", "subscribe"],
      secretStrategy: "none",
      endpoint: "http://127.0.0.1:8787/records",
    });
    project.appConfig = {
      authentication: {
        mode: "generated",
        roles: ["admin", "editor", "viewer"],
      },
      realtime: { mode: "sse", url: "http://127.0.0.1:8787/events" },
      offline: true,
      environmentVariables: [
        { name: "AUTH_SECRET", description: "Firma sessioni", required: true },
      ],
    };
    const files = generateFiles(project),
      pkg = JSON.parse(files["package.json"]);
    expect(pkg.scripts.server).toBe("node server/index.mjs");
    expect(files["server/index.mjs"]).toContain("writeFile(file");
    expect(files["server/index.mjs"]).toContain("request.method === 'DELETE'");
    expect(files["src/main.ts"]).toContain("fetch(endpoint");
    expect(files["src/main.ts"]).toContain("let authToken");
    expect(files["index.html"]).toContain('id="auth-gate"');
    expect(files["server/index.mjs"]).toContain("scryptSync");
    expect(files["src/main.ts"]).toContain("new EventSource");
    expect(files["server/index.mjs"]).toContain("text/event-stream");
    expect(files[".env.example"]).toContain("AUTH_SECRET=");
    expect(files["index.html"]).toContain('rel="manifest"');
    expect(files["project.kyro.json"]).not.toContain("API_TOKEN=");
    expect(files["project.frontend-editor.json"]).toBe(files["project.kyro.json"]);
  });
});
