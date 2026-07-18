import { describe, expect, it } from "vitest";
import { importExistingFolder } from "../src/folderImport";
import { generateFiles } from "../src/generator";
import { createProject, makeComponent, serializeProject } from "../src/model";

describe("import cartella esistente", () => {
  it("ripristina integralmente un export Frontend Editor e preserva la sorgente", () => {
    const original = createProject("Field App");
    original.pages.push({
      id: "home",
      name: "Home",
      path: "/",
      components: [makeComponent("title"), makeComponent("button")],
    });
    original.exportConfig = {
      target: "android",
      capacitor: true,
      android: {
        packageId: "com.example.fieldapp",
        appName: "Field App",
        orientation: "portrait",
        themeColor: "#4455aa",
        versionName: "2.0.0",
        versionCode: 20,
        permissions: ["camera"],
        statusBarStyle: "dark",
        keyboardResize: true,
        backButton: true,
      },
    };
    const imported = importExistingFolder("field-app", [
      {
        path: "project.frontend-editor.json",
        content: serializeProject(original),
      },
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: { react: "^19", "@capacitor/core": "^8" },
        }),
      },
      { path: "src/main.ts", content: "console.log('app')" },
    ]);
    expect(imported.id).not.toBe(original.id);
    expect(imported.name).toBe("Field App importato");
    expect(imported.pages[0].components).toHaveLength(2);
    expect(imported.exportConfig).toEqual(original.exportConfig);
    expect(imported.importedSource).toMatchObject({
      exactModel: true,
      detected: "Capacitor + React",
    });
    const exported = generateFiles(imported);
    expect(exported["original-project/src/main.ts"]).toBe("console.log('app')");
  });

  it("converte HTML semantico in pagine e componenti modificabili", () => {
    const imported = importExistingFolder("studio-site", [
      {
        path: "index.html",
        content:
          '<!doctype html><nav aria-label="Principale"><a href="#work">Studio</a></nav><main><h1 style="color:#123456">Portfolio</h1><section id="work"><article><button>Apri progetto</button></article></section></main><footer>Contatti</footer>',
      },
      {
        path: "contact.html",
        content:
          '<main><h1>Scrivici</h1><form><input placeholder="Email"><button>Invia</button></form></main>',
      },
      {
        path: "styles/site.css",
        content: ".card{box-shadow:0 8px 20px #0002}",
      },
    ]);
    expect(imported.pages).toHaveLength(2);
    expect(imported.pages[0].components.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        "navbar",
        "title",
        "section",
        "card",
        "button",
        "footer",
      ]),
    );
    expect(
      imported.pages[0].components.find((item) => item.type === "title")?.styles
        .desktop.color,
    ).toBe("rgb(18, 52, 86)");
    expect(imported.importedSource).toMatchObject({
      exactModel: false,
      detected: "HTML/CSS",
    });
  });

  it("converte staticamente il markup React senza eseguire il progetto", () => {
    const imported = importExistingFolder("react-shop", [
      { path: "package.json", content: JSON.stringify({ dependencies: { react: "^19" } }) },
      { path: "src/App.tsx", content: `import React from 'react'; export function App(){ return (<><nav>Negozio</nav><main><h1>Catalogo</h1><section className="products"><article><button onClick={() => alert('no')}>Compra</button></article></section><form><input name="email" placeholder="Email" /><button>Iscriviti</button></form></main></>) }` },
      { path: "src/api.ts", content: "export const secret = process.env.API_TOKEN" },
    ]);
    expect(imported.importedSource).toMatchObject({ detected: "React", exactModel: false });
    expect(imported.pages[0].components.map((component) => component.type)).toEqual(expect.arrayContaining(["navbar", "title", "section", "card", "button", "form", "input"]));
    expect(imported.pages[0].components.find((component) => component.type === "title")?.props.label).toBe("Catalogo");
    expect(generateFiles(imported)["original-project/src/api.ts"]).toContain("process.env.API_TOKEN");
  });
});
