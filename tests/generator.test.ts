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
    expect(files["src/main.ts"]).not.toMatch(/password|apiKey|token/i);
    expect(JSON.parse(files["package.json"]).scripts.build).toBe(
      "tsc && vite build",
    );
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
    });
    expect(pkg.scripts["android:sync"]).toContain("cap sync android");
    expect(files["capacitor.config.ts"]).toContain(
      'appId: "com.example.fieldapp"',
    );
    expect(JSON.parse(files["android.frontend-editor.json"])).toMatchObject({
      orientation: "portrait",
      permissions: ["camera"],
    });
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
    const files = generateFiles(project),
      pkg = JSON.parse(files["package.json"]);
    expect(pkg.scripts.server).toBe("node server/index.mjs");
    expect(files["server/index.mjs"]).toContain("writeFile(file");
    expect(files["server/index.mjs"]).toContain("request.method === 'DELETE'");
    expect(files["src/main.ts"]).toContain("fetch(endpoint");
    expect(files["src/main.ts"]).toContain("import.meta.env.VITE_API_TOKEN");
    expect(files["project.frontend-editor.json"]).not.toContain("API_TOKEN=");
  });
});
