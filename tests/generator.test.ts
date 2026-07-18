import { describe, expect, it } from "vitest";
import { generateFiles } from "../src/generator";
import { createProject, makeComponent } from "../src/model";
import { createTemplateProject } from "../src/templates";

describe("web generator", () => {
  it("emits a typed, runnable and secret-free project", () => {
    const project = createProject("Export Test");
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
    project.pages.push({ id: "page", name: "Home", path: "/", components: [input] });
    project.flows.push(
      { id: "search-flow", name: "Cerca", nodes: [{ id: "change", type: "event", label: "Quando cambia", position: { x: 0, y: 0 }, config: { trigger: "change", componentId: "search" } }, { id: "ui", type: "updateUI", label: "Cambia campo", position: { x: 1, y: 0 }, config: { componentId: "search", operation: "background", value: "#22d3ee" } }], edges: [{ id: "edge", source: "change", target: "ui", path: "success" }] },
      { id: "load-flow", name: "Carica", nodes: [{ id: "load", type: "event", label: "Apertura", position: { x: 0, y: 0 }, config: { trigger: "pageLoad" } }], edges: [] },
      { id: "timer-flow", name: "Aggiorna", nodes: [{ id: "timer", type: "event", label: "Timer", position: { x: 0, y: 0 }, config: { trigger: "timer", interval: "1200" } }], edges: [] },
    );
    const source = generateFiles(project)["src/main.ts"];
    expect(source).toContain('addEventListener("change"');
    expect(source).toContain('void runGraph("load-flow")');
    expect(source).toContain('setInterval(() => { void runGraph("timer-flow") }, 1200)');
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

  it("preserves nested containers in the exported markup", () => {
    const project = createProject("Nested Export");
    const stack = makeComponent("stack"),
      button = makeComponent("button");
    stack.id = "stack";
    button.id = "nested-button";
    button.parentId = stack.id;
    project.pages.push({
      id: "page",
      name: "Home",
      path: "/",
      components: [stack, button],
    });
    const html = generateFiles(project)["index.html"];
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
    expect(files["index.html"]).toContain('href="#/progetti"');
    expect(files["index.html"]).toContain("Un punto di partenza completo");
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
      path: "/",
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
    expect(files["project.frontend-editor.json"]).not.toContain("API_TOKEN=");
  });
});
