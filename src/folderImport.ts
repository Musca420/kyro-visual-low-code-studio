import {
  containerTypes,
  createProject,
  makeComponent,
  parseProject,
  type EditorComponent,
  type Project,
} from "./model";

export type FolderTextFile = { path: string; content: string };

const textExtensions = new Set([
  "css",
  "html",
  "htm",
  "js",
  "jsx",
  "json",
  "md",
  "mjs",
  "svg",
  "ts",
  "tsx",
  "txt",
  "vue",
  "svelte",
  "xml",
  "gradle",
  "properties",
]);

const normalizedPath = (file: File) => {
  const value = (file.webkitRelativePath || file.name).replaceAll("\\", "/");
  return value.includes("/") ? value.slice(value.indexOf("/") + 1) : value;
};

export async function readFolderFiles(input: FileList | File[]) {
  const candidates = [...input].filter((file) => {
    const path = normalizedPath(file);
    const extension = path.split(".").at(-1)?.toLowerCase() ?? "";
    return (
      file.size <= 750_000 &&
      textExtensions.has(extension) &&
      !/(^|\/)(node_modules|\.git|\.gradle|build|coverage|test-results)(\/|$)/.test(
        path,
      )
    );
  });
  if (candidates.length > 250)
    throw new Error(
      "La cartella contiene troppi file testuali: seleziona la sorgente senza dipendenze o cartelle di build.",
    );
  const total = candidates.reduce((sum, file) => sum + file.size, 0);
  if (total > 6_000_000)
    throw new Error(
      "La sorgente supera 6 MB di testo. Escludi dipendenze e build generate.",
    );
  return Promise.all(
    candidates.map(async (file) => ({
      path: normalizedPath(file),
      content: await file.text(),
    })),
  );
}

function detectStack(files: FolderTextFile[]) {
  const packageFile = files.find((file) => file.path === "package.json");
  let packageValue: Record<string, unknown> = {};
  try {
    packageValue = packageFile ? JSON.parse(packageFile.content) : {};
  } catch {
    /* la diagnosi segnalerà package non leggibile tramite il fallback */
  }
  const dependencies = {
    ...((packageValue.dependencies as Record<string, string>) ?? {}),
    ...((packageValue.devDependencies as Record<string, string>) ?? {}),
  };
  const labels = [
    dependencies["@capacitor/core"] && "Capacitor",
    dependencies.react && "React",
    dependencies.vue && "Vue",
    dependencies.svelte && "Svelte",
    dependencies["@angular/core"] && "Angular",
    files.some((file) => /\.html?$/.test(file.path)) && "HTML/CSS",
  ].filter(Boolean);
  return {
    detected: labels.join(" + ") || "progetto Web",
    dependencies,
  };
}

const typeFor = (element: Element): EditorComponent["type"] => {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role");
  if (role === "dialog") return "modal";
  if (tag === "nav") return "navbar";
  if (tag === "header") return "header";
  if (tag === "footer") return "footer";
  if (tag === "section" || tag === "main") return "section";
  if (tag === "article") return "card";
  if (/^h[1-6]$/.test(tag)) return "title";
  if (tag === "a") return "link";
  if (tag === "button") return "button";
  if (tag === "input") {
    const inputType = element.getAttribute("type");
    if (inputType === "checkbox") return "checkbox";
    if (inputType === "radio") return "radio";
    return "input";
  }
  if (tag === "textarea") return "textarea";
  if (tag === "select") return "select";
  if (tag === "form") return "form";
  if (tag === "img") return "image";
  if (tag === "table") return "table";
  if (tag === "ul" || tag === "ol") return "list";
  if (tag === "audio") return "audio";
  if (tag === "video") return "video";
  if (tag === "progress") return "progress";
  return element.children.length ? "container" : "text";
};

function componentFromElement(
  element: HTMLElement,
  parentId?: string,
): EditorComponent {
  const component = makeComponent(typeFor(element));
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  component.name =
    element.getAttribute("aria-label") ||
    element.id ||
    text.slice(0, 48) ||
    element.tagName.toLowerCase();
  component.parentId = parentId;
  component.props = {
    ...component.props,
    label: text.slice(0, 240) || component.name,
    ...(element.getAttribute("href")
      ? { href: element.getAttribute("href")! }
      : {}),
    ...(element.getAttribute("src")
      ? { src: element.getAttribute("src")! }
      : {}),
    ...(element.getAttribute("placeholder")
      ? { placeholder: element.getAttribute("placeholder")! }
      : {}),
    ...(element.id ? { importedId: element.id } : {}),
    ...(element.className ? { importedClass: element.className } : {}),
  };
  component.accessibility = {
    label:
      element.getAttribute("aria-label") ||
      element.getAttribute("alt") ||
      component.name,
    role: element.getAttribute("role") || component.accessibility.role,
  };
  const style = element.style;
  component.styles.desktop = {
    ...component.styles.desktop,
    ...(style.width ? { width: style.width } : {}),
    ...(style.height ? { height: style.height } : {}),
    ...(style.color ? { color: style.color } : {}),
    ...(style.background || style.backgroundColor
      ? { background: style.background || style.backgroundColor }
      : {}),
    ...(style.padding ? { padding: style.padding } : {}),
    ...(style.marginTop ? { marginTop: style.marginTop } : {}),
    ...(style.marginLeft ? { marginLeft: style.marginLeft } : {}),
    ...(style.borderRadius ? { borderRadius: style.borderRadius } : {}),
    ...(style.boxShadow ? { boxShadow: style.boxShadow } : {}),
    ...(style.fontSize ? { fontSize: style.fontSize } : {}),
    ...(style.display === "flex" || style.display === "grid"
      ? { display: style.display }
      : {}),
    ...(style.gap ? { gap: style.gap } : {}),
  };
  return component;
}

function pageFromHtml(file: FolderTextFile, index: number) {
  const documentValue = new DOMParser().parseFromString(
    file.content,
    "text/html",
  );
  const components: EditorComponent[] = [];
  const visit = (element: HTMLElement, parentId?: string) => {
    if (
      ["SCRIPT", "STYLE", "NOSCRIPT", "META", "LINK"].includes(element.tagName)
    )
      return;
    const component = componentFromElement(element, parentId);
    components.push(component);
    const canParent = (containerTypes as readonly string[]).includes(
      component.type,
    );
    [...element.children].forEach((child) =>
      visit(child as HTMLElement, canParent ? component.id : parentId),
    );
  };
  [...documentValue.body.children].forEach((element) =>
    visit(element as HTMLElement),
  );
  if (!components.length) {
    const placeholder = makeComponent("alert");
    placeholder.name = "Sorgente preservata";
    placeholder.props.label =
      "Il progetto usa rendering JavaScript. I file sono preservati; collega Codex per convertirne gradualmente i componenti visuali.";
    components.push(placeholder);
  }
  const filename = file.path
    .split("/")
    .at(-1)!
    .replace(/\.html?$/, "");
  return {
    id: crypto.randomUUID(),
    name: filename === "index" ? "Home" : filename,
    path: index === 0 ? "/" : `/${filename}`,
    components,
  };
}

function returnedMarkup(source: string) {
  const marker = /(?:return|=>)\s*\(/g.exec(source);
  if (!marker) return "";
  const start = marker.index + marker[0].length;
  let depth = 1, quote = "";
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) { if (character === quote && source[index - 1] !== "\\") quote = ""; continue; }
    if (["'", '"', "`"].includes(character)) { quote = character; continue; }
    if (character === "(") depth += 1;
    if (character === ")" && --depth === 0) return source.slice(start, index);
  }
  return "";
}

function frameworkMarkup(file: FolderTextFile) {
  const extension = file.path.split(".").at(-1)?.toLowerCase();
  let markup = file.content;
  if (extension === "vue") markup = markup.match(/<template[^>]*>([\s\S]*?)<\/template>/i)?.[1] ?? "";
  else if (extension === "svelte") markup = markup.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  else {
    markup = returnedMarkup(markup);
  }
  if (!markup.trim()) return "";
  return markup
    .replace(/<>/g, "<div>").replace(/<\/>/g, "</div>")
    .replace(/className=/g, "class=").replace(/htmlFor=/g, "for=")
    .replace(/\s+on[A-Z][A-Za-z]*=\{[^{}]*\}/g, "")
    .replace(/\s+[A-Za-z_:][\w:.-]*=\{[^{}]*\}/g, "")
    .replace(/\{[^{}]*\}/g, "")
    .replace(/<([A-Z][A-Za-z0-9.]*)\b[^>]*\/>/g, '<div data-imported-component="$1"></div>')
    .replace(/<([A-Z][A-Za-z0-9.]*)\b[^>]*>/g, '<div data-imported-component="$1">')
    .replace(/<\/([A-Z][A-Za-z0-9.]*)>/g, "</div>");
}

function pageFromFramework(file: FolderTextFile, index: number) {
  const markup = frameworkMarkup(file);
  if (!markup) return undefined;
  const name = file.path.split("/").at(-1)!.replace(/\.(jsx?|tsx?|vue|svelte)$/, "");
  return pageFromHtml({ path: `${name}.html`, content: `<main>${markup}</main>` }, index);
}

export function importExistingFolder(
  originName: string,
  files: FolderTextFile[],
): Project {
  if (!files.length)
    throw new Error("Nessun file sorgente supportato trovato nella cartella.");
  const stack = detectStack(files);
  const exact = files.find((file) =>
    file.path.endsWith("project.kyro.json") || file.path.endsWith("project.frontend-editor.json"),
  );
  const now = new Date().toISOString();
  if (exact) {
    const original = parseProject(JSON.parse(exact.content));
    return parseProject({
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} importato`,
      createdAt: now,
      updatedAt: now,
      importedSource: {
        originName,
        detected: stack.detected,
        importedAt: now,
        exactModel: true,
        warnings: [],
        files,
      },
    });
  }

  const project = createProject(originName || "Progetto importato");
  const htmlFiles = files
    .filter((file) => /(^|\/)(index|[^/]+)\.html?$/.test(file.path))
    .sort(
      (a, b) =>
        Number(!a.path.endsWith("index.html")) -
        Number(!b.path.endsWith("index.html")),
    );
  const frameworkFiles = files
    .filter((file) => /\.(jsx|tsx|vue|svelte)$/.test(file.path) && /(^|\/)(App|page|index)\.(jsx|tsx|vue|svelte)$/.test(file.path))
    .map(pageFromFramework)
    .filter((page): page is NonNullable<typeof page> => Boolean(page));
  project.pages = htmlFiles.length ? htmlFiles.map(pageFromHtml) : frameworkFiles.length ? frameworkFiles : [pageFromHtml({ path: "index.html", content: "<main></main>" }, 0)];
  project.dependencies = stack.dependencies;
  project.state = { imported: true };
  const capacitor = files.find((file) =>
    /(^|\/)capacitor\.config\.(ts|js|json)$/.test(file.path),
  );
  if (capacitor) {
    const packageId =
        capacitor.content.match(/appId\s*[:=]\s*["']([^"']+)/)?.[1] ??
        `com.frontendeditor.${project.id.replaceAll("-", "").slice(0, 12)}`,
      appName =
        capacitor.content.match(/appName\s*[:=]\s*["']([^"']+)/)?.[1] ??
        project.name;
    project.exportConfig = {
      target: "android",
      capacitor: true,
      android: {
        packageId,
        appName,
        orientation: "any",
        themeColor: "#6d5dfc",
        versionName: "1.0.0",
        versionCode: 1,
        permissions: [],
        statusBarStyle: "dark",
        keyboardResize: true,
        backButton: true,
      },
    };
  }
  const warnings = [
    htmlFiles.length ? "HTML e stili inline sono stati convertiti in componenti visuali." : frameworkFiles.length ? `Il markup ${stack.detected} riconoscibile è stato convertito staticamente in componenti visuali senza eseguire il codice.` : "Non è stato trovato markup convertibile: la sorgente resta preservata per la conversione progressiva.",
    "CSS avanzato, componenti dinamici e codice JavaScript restano preservati nella sorgente originale e vanno convertiti progressivamente in flow.",
  ];
  project.importedSource = {
    originName,
    detected: stack.detected,
    importedAt: now,
    exactModel: false,
    warnings,
    files,
  };
  return parseProject(project);
}
