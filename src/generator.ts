import JSZip from "jszip";
import type { Breakpoint, EditorComponent, Project } from "./model";
import { parseProject, serializeProject } from "./model";
import { buildExperienceAssets } from "./PreviewFrame";
import { canContain, componentTree, type ComponentBranch } from "./hierarchy";
import { generateCodeModule } from "./codeModules";

const htmlEscape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!,
  );
const cssEscape = (value: unknown) => String(value ?? "").replace(/[{};]/g, "");

function componentHtml(component: EditorComponent, children = "") {
  const label = htmlEscape(component.props.label || component.name);
  const fieldName = htmlEscape(component.props.fieldName || component.id);
  const attributes = `${component.props.tooltip ? ` title="${htmlEscape(component.props.tooltip)}"` : ""}${component.props.disabled === true ? ' aria-disabled="true"' : ""}`;
  if (component.type === "input")
    return `<label>${htmlEscape(component.accessibility.label)}<input id="${component.id}" name="${fieldName}" type="${["text", "email", "number", "password", "search", "date"].includes(String(component.props.inputType)) ? htmlEscape(component.props.inputType) : "text"}" placeholder="${htmlEscape(component.props.placeholder)}" /></label>`;
  if (component.type === "button")
    return `<button id="${component.id}" type="${["button", "submit", "reset"].includes(String(component.props.buttonType)) ? htmlEscape(component.props.buttonType) : "button"}"${attributes}${component.props.disabled === true ? " disabled" : ""}>${label}</button>`;
  if (component.type === "list")
    return `<section id="${component.id}" aria-label="${htmlEscape(component.accessibility.label)}"><div class="status" role="status">Caricamento…</div><ul></ul></section>`;
  if (component.type === "title")
    return `<h1 id="${component.id}">${label}</h1>`;
  if (component.type === "textarea")
    return `<label>${htmlEscape(component.accessibility.label)}<textarea id="${component.id}" name="${fieldName}"></textarea></label>`;
  if (component.type === "select")
    return `<label>${htmlEscape(component.accessibility.label)}<select id="${component.id}" name="${fieldName}"><option>${label}</option></select></label>`;
  if (component.type === "checkbox")
    return `<label><input id="${component.id}" name="${fieldName}" type="checkbox" /> ${label}</label>`;
  if (component.type === "image")
    return `<img id="${component.id}" src="${htmlEscape(component.props.src || "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22160%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%23e8eaf2%22/%3E%3C/svg%3E")}" alt="${htmlEscape(component.accessibility.label)}">`;
  if (component.type === "link")
    return `<a id="${component.id}" href="${htmlEscape(component.props.href || "#")}">${label}</a>`;
  if (component.type === "upload")
    return `<label>${label}<input id="${component.id}" type="file"></label>`;
  if (component.type === "progress")
    return `<label>${label}<progress id="${component.id}" max="100" value="${htmlEscape(component.props.value || 60)}"></progress></label>`;
  if (component.type === "table")
    return `<div id="${component.id}" class="table-scroll"><table><caption>${label}</caption><thead><tr><th>Nome</th><th>Stato</th><th>Data</th></tr></thead><tbody><tr><td>Elemento di esempio</td><td>Attivo</td><td>Oggi</td></tr></tbody></table></div>`;
  if (component.type === "chart")
    return `<figure id="${component.id}"><svg viewBox="0 0 320 140" role="img" aria-label="${htmlEscape(component.accessibility.label)}"><rect x="24" y="70" width="48" height="54" rx="6"></rect><rect x="92" y="38" width="48" height="86" rx="6"></rect><rect x="160" y="52" width="48" height="72" rx="6"></rect><rect x="228" y="18" width="48" height="106" rx="6"></rect></svg><figcaption>${label}</figcaption></figure>`;
  if (component.type === "calendar")
    return `<label>${label}<input id="${component.id}" type="date"></label>`;
  if (component.type === "audio" || component.type === "video")
    return `<${component.type} id="${component.id}" controls src="${htmlEscape(component.props.src || "")}">${label}</${component.type}>`;
  if (component.type === "avatar")
    return `<span id="${component.id}" class="avatar" role="img" aria-label="${htmlEscape(component.accessibility.label)}">${htmlEscape(
      String(component.props.initials || label)
        .slice(0, 2)
        .toUpperCase(),
    )}</span>`;
  if (component.type === "badge")
    return `<span id="${component.id}" class="chip">${label}</span>`;
  if (component.type === "accordion")
    return `<details id="${component.id}"><summary>${label}</summary>${children || `<p>${htmlEscape(component.props.description || "Contenuto espandibile")}</p>`}</details>`;
  if (canContain(component)) {
    const content =
      children ||
      `<strong>${label}</strong>${component.props.description ? `<p>${htmlEscape(component.props.description)}</p>` : ""}`;
    const tag =
      component.type === "header" ||
      component.type === "footer" ||
      component.type === "section" ||
      component.type === "form"
        ? component.type
        : component.type === "sidebar" ||
            component.type === "drawer" ||
            component.type === "menu"
          ? "aside"
          : component.type === "navbar"
            ? "nav"
            : "div";
    const role =
      component.type === "modal"
        ? "dialog"
        : component.accessibility.role ||
          (component.type === "hero" ? "region" : "group");
    return `<${tag} id="${component.id}" class="generated-container generated-${component.type}" role="${htmlEscape(role)}">${content}</${tag}>`;
  }
  return `<div id="${component.id}" role="${htmlEscape(component.accessibility.role || "group")}">${label}</div>`;
}

const branchHtml = ({ component, children }: ComponentBranch): string =>
  componentHtml(component, children.map(branchHtml).join("\n"));

function componentCss(component: EditorComponent, breakpoint: Breakpoint) {
  const style = {
    ...component.styles.desktop,
    ...(breakpoint === "desktop" ? {} : component.styles[breakpoint]),
  };
  const declarations = (value: Record<string, unknown>) =>
    Object.entries(value)
      .map(
        ([key, item]) =>
          `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${cssEscape(item)}`,
      )
      .join(";");
  const rules = (target: string) =>
    `${target}{${declarations(style)}}${target}:hover{${declarations(component.states.hover)}}${target}:focus-visible,${target}:focus-within{${declarations(component.states.focus)}}${target}:active{${declarations(component.states.active)}}${target}:disabled,${target}[aria-disabled="true"]{${declarations(component.states.disabled)}}`;
  return (
    rules(`[id="${component.id}"]`) +
    rules(`[data-component="${component.id}"]`)
  );
}

function pageBackgroundCss(project: Project) {
  return `body{background:${project.theme.tokens.pageBackground ?? "#ffffff"};background-image:${project.theme.tokens.pageBackgroundImage ?? "none"};background-size:cover;background-position:center}`;
}

function preservedSourceFiles(project: Project) {
  return Object.fromEntries(
    (project.importedSource?.files ?? []).map((file) => [
      `original-project/${file.path}`,
      file.content,
    ]),
  );
}

function commonExportFiles(project: Project) {
  return {
    "package.json": JSON.stringify(
      {
        name:
          project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
          "generated-app",
        private: true,
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "tsc && vite build",
          preview: "vite preview",
        },
        devDependencies: { typescript: "^5.8.3", vite: "^7.1.4" },
      },
      null,
      2,
    ),
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          noEmit: true,
          allowJs: true,
          checkJs: false,
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "capacitor.config.ts": `export default { appId: 'com.frontendeditor.${project.id.replace(/-/g, "").slice(0, 12)}', appName: ${JSON.stringify(project.name)}, webDir: 'dist' }`,
    "project.frontend-editor.json": serializeProject(project),
    "app.frontend-editor.json": JSON.stringify(project.appConfig, null, 2),
    ...(project.appConfig.environmentVariables.length
      ? {
          ".env.example": project.appConfig.environmentVariables
            .map((item) => `# ${item.description}\n${item.name}=`)
            .join("\n\n"),
        }
      : {}),
    ...preservedSourceFiles(project),
    "README.md": `# ${project.name}\n\n\`npm install\`, poi \`npm run dev\`. Build: \`npm run build\`. Per Android installare @capacitor/cli e @capacitor/android, quindi \`npx cap add android\` e \`npx cap sync\`. Nessun segreto è incluso.`,
  };
}

function platformFiles(
  project: Project,
  files: Record<string, string>,
): Record<string, string> {
  if (project.exportConfig.target === "web" && !project.appConfig.offline)
    return files;
  const themeColor =
    project.exportConfig.android?.themeColor ??
    project.theme.tokens.primary ??
    "#6d5dfc";
  if (
    project.exportConfig.target === "pwa" ||
    (project.exportConfig.target === "web" && project.appConfig.offline)
  ) {
    files["index.html"] = files["index.html"].replace(
      "</head>",
      `<meta name="theme-color" content="${htmlEscape(themeColor)}"><link rel="manifest" href="/app.webmanifest"></head>`,
    );
    files["src/main.ts"] +=
      `\nif ('serviceWorker' in navigator) addEventListener('load', () => void navigator.serviceWorker.register('/service-worker.js'))\n`;
    files["public/app.webmanifest"] = JSON.stringify(
      {
        name: project.name,
        short_name: project.name.slice(0, 12),
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: themeColor,
        icons: [
          {
            src: "/app-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      null,
      2,
    );
    files["public/app-icon.svg"] =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${htmlEscape(themeColor)}"/><text x="256" y="310" text-anchor="middle" font-family="system-ui" font-size="190" font-weight="800" fill="white">${htmlEscape(project.name.slice(0, 1).toUpperCase())}</text></svg>`;
    files["public/service-worker.js"] =
      `const CACHE='frontend-editor-v1';const CORE=['/','/app.webmanifest','/app-icon.svg'];self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE))));self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(value=>value||caches.match('/'))))})`;
    return files;
  }
  const android = project.exportConfig.android ?? {
    packageId: `com.frontendeditor.${project.id.replace(/-/g, "").slice(0, 12)}`,
    appName: project.name,
    orientation: "any" as const,
    themeColor,
    versionName: "1.0.0",
    versionCode: 1,
    permissions: [],
    statusBarStyle: "dark" as const,
    keyboardResize: true,
    backButton: true,
  };
  const pkg = JSON.parse(files["package.json"]) as {
    scripts: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  pkg.dependencies = {
    ...pkg.dependencies,
    "@capacitor/core": "^8.0.0",
    "@capacitor/android": "^8.0.0",
    "@capacitor/app": "^8.0.0",
    "@capacitor/status-bar": "^8.0.0",
  };
  pkg.devDependencies = { ...pkg.devDependencies, "@capacitor/cli": "^8.0.0" };
  pkg.scripts = {
    ...pkg.scripts,
    "android:add": "npx cap add android && npm run android:configure",
    "android:configure": "node scripts/configure-android.mjs",
    "android:sync":
      "npm run android:configure && npm run build && npx cap sync android",
    "android:open": "npx cap open android",
    "android:run": "npm run build && npx cap run android",
  };
  files["package.json"] = JSON.stringify(pkg, null, 2);
  files["capacitor.config.ts"] =
    `import type { CapacitorConfig } from '@capacitor/cli'\nconst config: CapacitorConfig = { appId: ${JSON.stringify(android.packageId)}, appName: ${JSON.stringify(android.appName)}, webDir: 'dist', backgroundColor: ${JSON.stringify(themeColor)}, android: { backgroundColor: ${JSON.stringify(themeColor)}, allowMixedContent: false, captureInput: true }, plugins: { App: { disableBackButtonHandler: ${!android.backButton} } } }\nexport default config\n`;
  const permissions = android.permissions
    .map(
      (permission) =>
        ({
          camera: "android.permission.CAMERA",
          geolocation: "android.permission.ACCESS_FINE_LOCATION",
          notifications: "android.permission.POST_NOTIFICATIONS",
          microphone: "android.permission.RECORD_AUDIO",
        })[permission],
    )
    .filter(Boolean);
  files["scripts/configure-android.mjs"] =
    `import { readFile, writeFile } from 'node:fs/promises'
const manifestPath = 'android/app/src/main/AndroidManifest.xml'
let manifest = await readFile(manifestPath, 'utf8')
const activityAttributes = ${JSON.stringify(
      [
        android.orientation === "any"
          ? ""
          : `android:screenOrientation="${android.orientation}"`,
        android.keyboardResize
          ? 'android:windowSoftInputMode="adjustResize"'
          : "",
      ].filter(Boolean),
    )}
for (const attribute of activityAttributes) if (!manifest.includes(attribute)) manifest = manifest.replace('<activity', '<activity\\n            ' + attribute)
for (const permission of ${JSON.stringify(permissions)}) { const declaration = '<uses-permission android:name="' + permission + '" />'; if (!manifest.includes(declaration)) manifest = manifest.replace('</manifest>', '    ' + declaration + '\\n</manifest>') }
await writeFile(manifestPath, manifest)
const gradlePath = 'android/app/build.gradle'
let gradle = await readFile(gradlePath, 'utf8')
gradle = gradle.replace(/versionCode \\d+/, ${JSON.stringify(`versionCode ${android.versionCode}`)}).replace(/versionName "[^"]+"/, ${JSON.stringify(`versionName "${android.versionName}"`)})
await writeFile(gradlePath, gradle)
const stylesPath = 'android/app/src/main/res/values/styles.xml'
let styles = await readFile(stylesPath, 'utf8')
const systemBars = '<item name="android:statusBarColor">${android.themeColor}</item>\\n        <item name="android:navigationBarColor">${android.themeColor}</item>\\n        <item name="android:windowLightStatusBar">${android.statusBarStyle === "dark"}</item>'
if (!styles.includes('android:statusBarColor')) styles = styles.replace('<item name="windowActionBar">false</item>', '<item name="windowActionBar">false</item>\\n        ' + systemBars)
const splash = '<item name="windowSplashScreenBackground">${android.themeColor}</item>\\n        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>'
if (!styles.includes('windowSplashScreenBackground')) styles = styles.replace('<item name="android:background">@drawable/splash</item>', '<item name="android:background">@drawable/splash</item>\\n        ' + splash)
await writeFile(stylesPath, styles)
await writeFile('android/app/src/main/res/values/ic_launcher_background.xml', '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">${android.themeColor}</color></resources>')
await writeFile('android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml', '<?xml version="1.0" encoding="utf-8"?><vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#FFFFFF" android:pathData="M30,31h48v10h-48zM30,49h36v10h-36zM30,67h24v10h-24z"/></vector>')
console.log('Configurazione Android applicata')
`;
  const androidRuntime = `\nimport { App as NativeApp } from '@capacitor/app'\nimport { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar'\nvoid StatusBar.setStyle({ style: StatusBarStyle.${android.statusBarStyle === "dark" ? "Light" : "Dark"} })\nvoid StatusBar.setBackgroundColor({ color: ${JSON.stringify(android.themeColor)} })\n${android.backButton ? "void NativeApp.addListener('backButton', ({ canGoBack }) => canGoBack ? history.back() : NativeApp.minimizeApp())" : ""}\n`;
  files["src/main.ts"] += androidRuntime;
  files["src/style.css"] +=
    "\nhtml{background:var(--safe-area-color,#fff)}body{padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left)}";
  files["index.html"] = files["index.html"].replace(
    'content="width=device-width,initial-scale=1"',
    'content="width=device-width,initial-scale=1,viewport-fit=cover"',
  );
  files["android.frontend-editor.json"] = JSON.stringify(android, null, 2);
  files["README-ANDROID.md"] =
    `# Android\n\nTarget: Capacitor 8 / Android API 24+.\n\nFrontend Editor può preparare automaticamente la cartella nativa. Manualmente: npm install, npm run build, npm run android:add, npm run android:sync. Aprire con npm run android:open. La firma di pubblicazione resta intenzionalmente esterna.\n\nOrientamento: ${android.orientation}. Permessi richiesti: ${android.permissions.join(", ") || "nessuno"}. Versione: ${android.versionName} (${android.versionCode}).`;
  return files;
}

const authenticationCss = `#auth-gate{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f2f0ff}#auth-gate form{width:min(420px,100%);display:grid;gap:14px;padding:30px;border:1px solid #dedbe9;border-radius:18px;background:#fff;box-shadow:0 24px 70px #20264b24}#auth-gate form>p{margin:0;color:#6d5dfc;font-size:11px;font-weight:800;letter-spacing:.12em}#auth-gate form>h1{margin:0}#auth-gate [role=alert]{min-height:20px;color:#b42318;font-size:12px}#create-account{background:#fff;color:#4b3fd0;border:1px solid #c9c3ff}`;

function authenticationAssets(project: Project) {
  if (project.appConfig.authentication.mode !== "generated")
    return {
      markup: "",
      open: "",
      close: "",
      runtime:
        "let authToken = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env.VITE_API_TOKEN || ''",
    };
  const endpoint =
    project.dataSources.find((source) => source.provider === "generated")
      ?.endpoint ?? "http://127.0.0.1:8787/records";
  const base = endpoint.replace(/\/records\/?$/, "");
  return {
    markup: `<section id="auth-gate"><form><p>AREA RISERVATA</p><h1>Accedi</h1><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><div role="alert"></div><button type="submit">Accedi</button><button id="create-account" type="button">Crea il primo account</button></form></section>`,
    open: `<div id="protected-app" hidden>`,
    close: `</div>`,
    runtime: `let authToken = sessionStorage.getItem('frontend-editor-session') || ''
const authGate = document.getElementById('auth-gate')!, protectedApp = document.getElementById('protected-app')!, authForm = authGate.querySelector('form') as HTMLFormElement, authError = authGate.querySelector('[role="alert"]') as HTMLElement
const showApp = () => { authGate.hidden = true; protectedApp.hidden = false }
if (authToken) showApp()
const authenticate = async (path: string): Promise<void> => { if (!authForm.reportValidity()) return; const input = Object.fromEntries(new FormData(authForm)), response = await fetch(${JSON.stringify(base)} + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }); const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Accesso non riuscito'); if (path === '/auth/register') return authenticate('/auth/login'); authToken = value.token; sessionStorage.setItem('frontend-editor-session', authToken); showApp(); location.reload() }
authForm.addEventListener('submit', (event) => { event.preventDefault(); void authenticate('/auth/login').catch((error) => authError.textContent = error.message) })
document.getElementById('create-account')!.addEventListener('click', () => void authenticate('/auth/register').catch((error) => authError.textContent = error.message))`,
  };
}

function generateExperienceFiles(
  project: Project,
  experience: "landing" | "dashboard",
): Record<string, string> {
  const components = project.pages.flatMap((item) => item.components);
  const auth = authenticationAssets(project);
  const assets = buildExperienceAssets(experience, components);
  const desktop = components
    .map((component) => componentCss(component, "desktop"))
    .join("\n");
  const tablet = components
    .map((component) => componentCss(component, "tablet"))
    .join("\n");
  const mobile = components
    .map((component) => componentCss(component, "mobile"))
    .join("\n");
  const baseCss = `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#172033;background:#f7f8fc}*{box-sizing:border-box}body{margin:0}button,input,textarea,select{font:inherit}button{cursor:pointer;border:0;border-radius:10px;padding:11px 14px;background:#6d5dfc;color:#fff;font-weight:700}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #8b7fff;outline-offset:3px}input,textarea,select{width:100%;border:1px solid #cfd4df;border-radius:9px;padding:10px;background:#fff}label{display:grid;gap:5px;font-size:12px;font-weight:700}${authenticationCss}@keyframes fe-fade{from{opacity:0}to{opacity:1}}@keyframes fe-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}@keyframes fe-pulse{50%{transform:scale(1.04)}}@keyframes fe-float{50%{transform:translateY(-8px)}}${assets.css}${desktop}\n@media(max-width:900px){${tablet}}\n@media(max-width:600px){${mobile}}${pageBackgroundCss(project)}`;
  const landingSource = project.dataSources[0];
  const landingDataRuntime =
    landingSource?.provider === "rest" ||
    landingSource?.provider === "generated"
      ? `const endpoint = ${JSON.stringify(landingSource.endpoint)}
async function query(): Promise<SiteItem[]> { const response = await fetch(endpoint, { headers: authToken ? { authorization: 'Bearer ' + authToken } : {} }); if (!response.ok) throw new Error('API non disponibile (' + response.status + ')'); const value = await response.json(); if (!Array.isArray(value)) throw new Error('L’API deve restituire un elenco JSON'); return value }
async function insert(value: unknown): Promise<void> { const fields = value && typeof value === 'object' ? value : { text: String(value) }; const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(authToken ? { authorization: 'Bearer ' + authToken } : {}) }, body: JSON.stringify(fields) }); if (!response.ok) throw new Error('Salvataggio non riuscito (' + response.status + ')') }
async function update(value: unknown) { const item = value as Record<string, unknown>; const response = await fetch(endpoint + '/' + encodeURIComponent(String(item.id ?? '')), { method: 'PUT', headers: { 'content-type': 'application/json', ...(authToken ? { authorization: 'Bearer ' + authToken } : {}) }, body: JSON.stringify(item) }); if (!response.ok) throw new Error('Aggiornamento non riuscito (' + response.status + ')'); return response.json() }
async function remove(value: unknown) { const item = value as Record<string, unknown>; const response = await fetch(endpoint + '/' + encodeURIComponent(String(item.id ?? value ?? '')), { method: 'DELETE', headers: authToken ? { authorization: 'Bearer ' + authToken } : {} }); if (!response.ok) throw new Error('Eliminazione non riuscita (' + response.status + ')') }`
      : landingSource
        ? `const openDb = () => new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('frontend-editor-export', 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records', { keyPath: 'id' }).createIndex('sourceId', 'sourceId') }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
async function query(): Promise<SiteItem[]> { const db = await openDb(); return new Promise((resolve, reject) => { const request = db.transaction('records').objectStore('records').index('sourceId').getAll(sourceId); request.onsuccess = () => resolve((request.result as SiteItem[]).sort((a, b) => b.date.localeCompare(a.date))); request.onerror = () => reject(request.error) }) }
async function insert(value: unknown): Promise<void> { const db = await openDb(); const fields = value && typeof value === 'object' ? value as Record<string, unknown> : { text: String(value) }; await new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put({ ...fields, id: crypto.randomUUID(), sourceId, text: String(fields.text ?? fields.name ?? 'Elemento'), date: new Date().toISOString() }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }) }
async function update(value: unknown) { const db = await openDb(), item = value as SiteItem; await new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put(item); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }); return item }
async function remove(value: unknown) { const db = await openDb(), item = value as Partial<SiteItem>; await new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').delete(String(item.id ?? value)); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }) }`
        : `async function query(): Promise<SiteItem[]> { return [] }
async function insert(_value?: unknown): Promise<void> { throw new Error('Configura una sorgente dati per salvare le richieste') }
async function update(_value?: unknown): Promise<void> { throw new Error('Configura una sorgente dati') }
async function remove(_value?: unknown): Promise<void> { throw new Error('Configura una sorgente dati') }`;
  const landingMain = `import './style.css'
${moduleImports(project)}
${auth.runtime}
type SiteItem = { id: string; sourceId: string; text: string; date: string }
const sourceId = ${JSON.stringify(landingSource?.id ?? "")}
${landingDataRuntime}
declare global { interface Window { siteData: { query: () => Promise<SiteItem[]>; insert: (text: string) => Promise<void> } } }
const status = document.querySelector<HTMLElement>('[role="status"]')
const refresh = async () => { const records = await query(); dispatchEvent(new MessageEvent('message', { data: { channel: 'frontend-editor-host', records } })) }
window.siteData = { query, insert: (text) => insert(text) }
await import('./ui.js')
${project.flows.length ? generatedFlowRuntime(project) : ""}
`;
  const dashboardSource = project.dataSources[0];
  const dashboardDataRuntime =
    dashboardSource?.provider === "rest" ||
    dashboardSource?.provider === "generated"
      ? `const endpoint = ${JSON.stringify(dashboardSource.endpoint)}
const request = async (path = '', init?: RequestInit) => { const response = await fetch(endpoint + path, { ...init, headers: { 'content-type': 'application/json', ...(authToken ? { authorization: 'Bearer ' + authToken } : {}), ...init?.headers } }); if (!response.ok) throw new Error('API non disponibile (' + response.status + ')'); return response.status === 204 ? undefined : response.json() }
async function query(): Promise<Item[]> { const value = await request(); if (!Array.isArray(value)) throw new Error('L’API deve restituire un elenco JSON'); return value }
async function save(input: ProjectInput): Promise<void> { if (input.name.trim().length < 2 || input.description.trim().length < 4 || !/^\\d{4}-\\d{2}-\\d{2}$/.test(input.dueDate)) throw new Error('Complete all required fields with valid values.'); await request(input.id ? '/' + encodeURIComponent(input.id) : '', { method: input.id ? 'PUT' : 'POST', body: JSON.stringify({ ...input, text: input.name }) }) }
async function remove(value: unknown): Promise<void> { const item = value as Record<string, unknown>; await request('/' + encodeURIComponent(String(item.id ?? value)), { method: 'DELETE' }) }
async function insert(value: unknown) { const input = value as ProjectInput; await save(input); return value }
async function update(value: unknown) { const input = value as ProjectInput; await save(input); return value }`
      : `const openDb = () => new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('frontend-editor-export', 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records', { keyPath: 'id' }).createIndex('sourceId', 'sourceId') }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
async function query(): Promise<Item[]> { const db = await openDb(); return new Promise((resolve, reject) => { const request = db.transaction('records').objectStore('records').index('sourceId').getAll(sourceId); request.onsuccess = () => resolve((request.result as Item[]).sort((a, b) => b.date.localeCompare(a.date))); request.onerror = () => reject(request.error) }) }
async function save(input: ProjectInput): Promise<void> {
  if (input.name.trim().length < 2 || input.description.trim().length < 4 || !/^\\d{4}-\\d{2}-\\d{2}$/.test(input.dueDate)) throw new Error('Complete all required fields with valid values.')
  const db = await openDb(); const existingId = input.id; const existing = existingId ? (await new Promise<Item | undefined>((resolve, reject) => { const request = db.transaction('records').objectStore('records').get(existingId); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })) : undefined
  const item: Item = { id: existing?.id ?? crypto.randomUUID(), sourceId, text: input.name.trim(), description: input.description.trim(), status: input.status, priority: input.priority, dueDate: input.dueDate, date: new Date().toISOString() }
  await new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put(item); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}
async function remove(value: unknown): Promise<void> { const db = await openDb(); const item = value as Partial<Item>; await new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').delete(String(item.id ?? value)); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }) }
async function insert(value: unknown) { const input = value as ProjectInput; await save(input); return value }
async function update(value: unknown) { const input = value as ProjectInput; await save(input); return value }`;
  const dashboardMain = `import './style.css'
${moduleImports(project)}

${auth.runtime}

type Status = 'Planned' | 'In progress' | 'Completed' | 'On hold'
type Priority = 'Low' | 'Medium' | 'High'
type ProjectInput = { id?: string; name: string; description: string; status: Status; priority: Priority; dueDate: string }
type Item = { id: string; sourceId: string; text: string; description: string; status: Status; priority: Priority; dueDate: string; date: string }
const sourceId = ${JSON.stringify(project.dataSources[0]?.id ?? "")}
if (!sourceId) throw new Error('Sorgente dati dashboard non configurata')
${dashboardDataRuntime}
const status = document.querySelector<HTMLElement>('[role="status"]')
const refresh = async () => { const records = await query(); dispatchEvent(new MessageEvent('message', { data: { channel: 'frontend-editor-host', records } })) }
declare global { interface Window { dashboardData: { query: () => Promise<Item[]>; action: (action: string, payload: ProjectInput) => Promise<Item[]> } } }
window.dashboardData = { query, action: async (action, payload) => { if (action === 'delete') await remove(String(payload.id)); else await save(payload); return query() } }
await import('./ui.js')
${project.flows.length ? generatedFlowRuntime(project) : ""}
${project.appConfig.realtime.mode === "sse" ? `const updates = new EventSource(${JSON.stringify(project.appConfig.realtime.url)}); updates.addEventListener('records', () => void window.dashboardData.query().then((records) => dispatchEvent(new MessageEvent('message', { data: { channel: 'frontend-editor-host', records } }))))` : ""}
`;
  const ui =
    experience === "landing"
      ? `export {};const deliver=(detail)=>dispatchEvent(new MessageEvent('message',{data:{channel:'frontend-editor-host',...detail}}));const send=async(type,payload={})=>{try{if(type==='READY')deliver({records:await window.siteData.query()});if(type==='ADD'){await window.siteData.insert(payload.value);deliver({records:await window.siteData.query(),action:'add'})}}catch(error){deliver({records:await window.siteData.query(),error:error instanceof Error?error.message:String(error)})}};${assets.script}`
      : `export {};const deliver=(detail)=>dispatchEvent(new MessageEvent('message',{data:{channel:'frontend-editor-host',...detail}}));const send=async(type,payload={})=>{try{if(type==='READY')deliver({records:await window.dashboardData.query()});if(type==='DASHBOARD_ACTION')deliver({records:await window.dashboardData.action(payload.action,payload.payload),action:payload.action})}catch(error){deliver({records:await window.dashboardData.query(),error:error instanceof Error?error.message:String(error)})}};${assets.script}`;
  return {
    ...commonExportFiles(project),
    "index.html": `<!doctype html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(project.name)}</title></head><body>${auth.markup}${auth.open}${assets.markup}${auth.close}<script type="module" src="/src/main.ts"></script></body></html>`,
    "src/main.ts": experience === "landing" ? landingMain : dashboardMain,
    "src/ui.js": ui,
    "src/style.css": baseCss,
  };
}

function withGeneratedBackend(project: Project, files: Record<string, string>) {
  if (!project.dataSources.some((source) => source.provider === "generated"))
    return files;
  const pkg = JSON.parse(files["package.json"]) as {
    scripts: Record<string, string>;
  };
  pkg.scripts.server = "node server/index.mjs";
  files["package.json"] = JSON.stringify(pkg, null, 2);
  files["server/data.json"] = "[]";
  files["server/users.json"] = "[]";
  files["server/index.mjs"] = `import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
const file = new URL('./data.json', import.meta.url)
const usersFile = new URL('./users.json', import.meta.url)
const read = async () => JSON.parse(await readFile(file, 'utf8'))
const save = async (records) => writeFile(file, JSON.stringify(records, null, 2))
const readUsers = async () => JSON.parse(await readFile(usersFile, 'utf8'))
const saveUsers = async (users) => writeFile(usersFile, JSON.stringify(users, null, 2))
const body = async (request) => { let value = ''; for await (const chunk of request) value += chunk; return value ? JSON.parse(value) : {} }
const authEnabled = ${JSON.stringify(project.appConfig.authentication.mode === "generated")}
const allowedRoles = ${JSON.stringify(project.appConfig.authentication.roles)}
const authSecret = process.env.AUTH_SECRET || ''
if (authEnabled && !authSecret) throw new Error('AUTH_SECRET è obbligatoria: copia .env.example e configura un valore sicuro')
const sign = (user) => { const payload = Buffer.from(JSON.stringify({ id: user.id, role: user.role, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url'); return payload + '.' + createHmac('sha256', authSecret).update(payload).digest('base64url') }
const session = (request) => { if (!authEnabled) return { role: 'admin' }; const token = String(request.headers.authorization || '').replace(/^Bearer /, ''), [payload, signature] = token.split('.'); if (!payload || !signature) return; const expected = Buffer.from(createHmac('sha256', authSecret).update(payload).digest('base64url')), actual = Buffer.from(signature); if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return; const value = JSON.parse(Buffer.from(payload, 'base64url')); return value.exp > Date.now() ? value : undefined }
const clients = new Set()
const broadcast = () => clients.forEach((client) => client.write('event: records\\ndata: changed\\n\\n'))
createServer(async (request, response) => {
  try {
    response.setHeader('content-type', 'application/json')
    response.setHeader('access-control-allow-origin', 'http://127.0.0.1:5173')
    response.setHeader('access-control-allow-headers', 'content-type,authorization')
    response.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS')
    if (request.method === 'OPTIONS') { response.writeHead(204); return response.end() }
    const url = new URL(request.url, 'http://127.0.0.1:8787')
    if (url.pathname === '/events' && request.method === 'GET') { response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); response.write('event: ready\\ndata: connected\\n\\n'); clients.add(response); request.on('close', () => clients.delete(response)); return }
    if (url.pathname === '/auth/register' && request.method === 'POST') { const users = await readUsers(); if (users.length) { response.writeHead(409); return response.end(JSON.stringify({ error: 'Il primo account esiste già' })) } const input = await body(request); if (!/^\\S+@\\S+\\.\\S+$/.test(input.email) || String(input.password || '').length < 8) { response.writeHead(400); return response.end(JSON.stringify({ error: 'Email valida e password di almeno 8 caratteri richieste' })) } const salt = randomBytes(16).toString('hex'), hash = scryptSync(input.password, salt, 64).toString('hex'), user = { id: crypto.randomUUID(), email: input.email.toLowerCase(), salt, hash, role: allowedRoles.includes('admin') ? 'admin' : allowedRoles[0] || 'viewer' }; users.push(user); await saveUsers(users); response.writeHead(201); return response.end(JSON.stringify({ id: user.id, email: user.email, role: user.role })) }
    if (url.pathname === '/auth/login' && request.method === 'POST') { const input = await body(request), user = (await readUsers()).find((item) => item.email === String(input.email || '').toLowerCase()); if (!user) { response.writeHead(401); return response.end(JSON.stringify({ error: 'Credenziali non valide' })) } const actual = scryptSync(String(input.password || ''), user.salt, 64), expected = Buffer.from(user.hash, 'hex'); if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) { response.writeHead(401); return response.end(JSON.stringify({ error: 'Credenziali non valide' })) } return response.end(JSON.stringify({ token: sign(user), role: user.role })) }
    const current = session(request)
    if (authEnabled && !current) { response.writeHead(401); return response.end(JSON.stringify({ error: 'Accedi per continuare' })) }
    const records = await read(), id = url.pathname.split('/')[2]
    if (url.pathname === '/records' && request.method === 'GET') return response.end(JSON.stringify(records))
    if (url.pathname === '/records' && request.method === 'POST') { if (!['admin', 'editor'].includes(current.role)) { response.writeHead(403); return response.end(JSON.stringify({ error: 'Ruolo senza permesso di creazione' })) } const input = await body(request), record = { ...input, id: crypto.randomUUID(), date: new Date().toISOString() }; records.push(record); await save(records); broadcast(); response.writeHead(201); return response.end(JSON.stringify(record)) }
    const index = records.findIndex((record) => record.id === id)
    if (index < 0) { response.writeHead(404); return response.end(JSON.stringify({ error: 'Record non trovato' })) }
    if (request.method === 'PUT') { if (!['admin', 'editor'].includes(current.role)) { response.writeHead(403); return response.end(JSON.stringify({ error: 'Ruolo senza permesso di modifica' })) } records[index] = { ...records[index], ...(await body(request)), id }; await save(records); broadcast(); return response.end(JSON.stringify(records[index])) }
    if (request.method === 'DELETE') { if (current.role !== 'admin') { response.writeHead(403); return response.end(JSON.stringify({ error: 'Solo un amministratore può eliminare' })) } records.splice(index, 1); await save(records); broadcast(); response.writeHead(204); return response.end() }
    response.writeHead(404); response.end(JSON.stringify({ error: 'Percorso non trovato' }))
  } catch (error) { response.writeHead(500); response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })) }
}).listen(8787, '127.0.0.1', () => console.log('Backend pronto su http://127.0.0.1:8787'))
`;
  files["README-BACKEND.md"] =
    `# Backend generato\n\nAvviare con \`npm run server\`, poi in un secondo processo \`npm run dev\`. I record sono salvati in \`server/data.json\`. L'API ascolta solo su 127.0.0.1:8787 e accetta GET/POST/PUT/DELETE su /records.${project.appConfig.authentication.mode === "generated" ? " L’accesso è protetto: configura AUTH_SECRET prima dell’avvio; la prima registrazione crea l’amministratore." : " Prima di una pubblicazione pubblica configura autenticazione e origine consentita."}`;
  return files;
}

export function generateFiles(input: Project): Record<string, string> {
  const project = parseProject(input);
  const page = project.pages[0];
  if (!page) throw new Error("Aggiungi almeno una pagina prima dell’export");
  if (
    project.appConfig.authentication.mode === "generated" &&
    !project.dataSources.some((source) => source.provider === "generated")
  )
    throw new Error(
      "Il login richiede il backend: apri Dati e scegli Genera anche il backend",
    );
  if (
    project.state.experience === "landing" ||
    project.state.experience === "dashboard"
  ) {
    if (!project.flows.length)
      throw new Error("Configura i flow prima dell’export");
    if (project.state.experience === "dashboard" && !project.dataSources.length)
      throw new Error("Configura la sorgente dati prima dell’export");
    const files = withGeneratedBackend(
      project,
      platformFiles(
        project,
        generateExperienceFiles(project, project.state.experience),
      ),
    );
    return withCodeModules(project, files);
  }
  const inputComponent = page.components.find(
    (component) => component.type === "input",
  );
  const button = page.components.find(
    (component) => component.type === "button",
  );
  const list = page.components.find((component) => component.type === "list");
  const source = project.dataSources[0];
  const auth = authenticationAssets(project);
  const body = `<nav aria-label="Pagine">${project.pages.map((item) => `<a href="#${htmlEscape(item.path)}">${htmlEscape(item.name)}</a>`).join("")}</nav>${project.pages.map((item) => `<section data-route="${htmlEscape(item.path)}">${componentTree(item.components).map(branchHtml).join("\n")}</section>`).join("")}`;
  const allComponents = project.pages.flatMap((item) => item.components);
  const desktop = allComponents
    .map((component) => componentCss(component, "desktop"))
    .join("\n");
  const tablet = allComponents
    .map((component) => componentCss(component, "tablet"))
    .join("\n");
  const mobile = allComponents
    .map((component) => componentCss(component, "mobile"))
    .join("\n");
  const dataRuntime =
    source?.provider === "rest" || source?.provider === "generated"
      ? `const endpoint = ${JSON.stringify(source.endpoint)}
async function request(path = '', init?: RequestInit) { const response = await fetch(endpoint + path, { ...init, headers: { 'content-type': 'application/json', ...(authToken ? { authorization: 'Bearer ' + authToken } : {}), ...init?.headers } }); if (!response.ok) throw new Error('API non disponibile (' + response.status + ')'); return response.status === 204 ? undefined : response.json() }
async function query(): Promise<Item[]> { const value = await request(); if (!Array.isArray(value)) throw new Error('L’API deve restituire un elenco JSON'); return value.map((item, index) => ({ ...item, id: String(item.id ?? index), sourceId, text: String(item.text ?? item.name ?? item.title ?? 'Elemento'), date: String(item.date ?? new Date().toISOString()) })) }
async function insert(value: unknown) { const fields = value && typeof value === 'object' && !Array.isArray(value) ? value : { text: String(value) }; await request('', { method: 'POST', body: JSON.stringify(fields) }) }
async function update(value: unknown) { const item = value as Record<string, unknown>; return request('/' + encodeURIComponent(String(item.id ?? '')), { method: 'PUT', body: JSON.stringify(item) }) }
async function remove(value: unknown) { const item = value as Record<string, unknown>; return request('/' + encodeURIComponent(String(item.id ?? '')), { method: 'DELETE' }) }`
      : `const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('frontend-editor-export', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' }).createIndex('sourceId', 'sourceId')
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})
async function query(): Promise<Item[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => { const request = db.transaction('records').objectStore('records').index('sourceId').getAll(sourceId); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
}
async function insert(value: unknown) {
  const db = await openDb()
  const fields = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : { text: String(value) }
  const item = { ...fields, id: typeof fields.id === 'string' && fields.id ? fields.id : crypto.randomUUID(), sourceId, text: String(fields.text ?? fields.name ?? fields.title ?? 'Elemento'), date: typeof fields.date === 'string' ? fields.date : new Date().toISOString() }
  return new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').add(item); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}
async function update(value: unknown) {
  const db = await openDb(), item = value as Item
  return new Promise<Item>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put(item); tx.oncomplete = () => resolve(item); tx.onerror = () => reject(tx.error) })
}
async function remove(value: unknown) {
  const db = await openDb(), item = value as Item
  return new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').delete(item.id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}`;
  const main = `import './style.css'
${moduleImports(project)}

${auth.runtime}

type Item = { id: string; sourceId: string; text: string; date: string }
const sourceId = ${JSON.stringify(source?.id ?? "local-items")}
${dataRuntime}
const status = document.querySelector<HTMLElement>('.status')
const list = document.getElementById('${list?.id ?? ""}')?.querySelector('ul')
async function refresh() {
  if (!status || !list) return
  status.textContent = 'Caricamento…'
  try { const items = await query(); list.replaceChildren(...items.map((item) => { const li = document.createElement('li'); li.textContent = item.text; return li })); status.textContent = items.length ? '' : 'Nessuna attività. Aggiungine una.' }
  catch (error) { status.textContent = 'Errore: ' + (error instanceof Error ? error.message : String(error)) }
}
function route() { const path = decodeURIComponent(location.hash.slice(1) || '/'); document.querySelectorAll<HTMLElement>('[data-route]').forEach((section) => { section.hidden = section.dataset.route !== path }) }
addEventListener('hashchange', route); route()
${project.flows.length ? generatedFlowRuntime(project) : `document.getElementById('${button?.id ?? ""}')?.addEventListener('click', async () => {
  const input = document.getElementById('${inputComponent?.id ?? ""}') as HTMLInputElement | null
  if (!input?.value.trim()) { input?.setAttribute('aria-invalid', 'true'); status!.textContent = 'Il valore è obbligatorio'; return }
  const value = ${modulePipeline(project, "input.value.trim()")}; await insert(String(value)); input.value = ''; input.removeAttribute('aria-invalid'); await refresh()
})`}
${project.appConfig.realtime.mode === "sse" ? `const updates = new EventSource(${JSON.stringify(project.appConfig.realtime.url)}); updates.addEventListener('records', () => void refresh())` : ""}
void refresh()
`;
  const files = platformFiles(project, {
    "package.json": JSON.stringify(
      {
        name:
          project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
          "generated-app",
        private: true,
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "tsc && vite build",
          preview: "vite preview",
        },
        devDependencies: { typescript: "^5.8.3", vite: "^7.1.4" },
      },
      null,
      2,
    ),
    "index.html": `<!doctype html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(project.name)}</title></head><body>${auth.markup}${auth.open}<main>${body}</main>${auth.close}<script type="module" src="/src/main.ts"></script></body></html>`,
    "src/main.ts": main,
    "src/style.css": `:root{font-family:Inter,system-ui,sans-serif;color:#172033;background:#f5f7fb}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0}${authenticationCss}main{position:relative;min-height:680px;width:min(680px,calc(100% - 32px));margin:48px auto;display:grid;gap:16px}nav{display:flex;gap:12px}nav a{color:#5547d9}[data-route]{display:grid;gap:16px}[data-route][hidden]{display:none}.generated-container{display:grid;gap:12px}.generated-grid{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}@keyframes fe-fade{from{opacity:0}to{opacity:1}}@keyframes fe-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}@keyframes fe-pulse{50%{transform:scale(1.04)}}@keyframes fe-float{50%{transform:translateY(-8px)}}${desktop}\n@media(max-width:900px){${tablet}}\n@media(max-width:600px){main{margin:20px auto}${mobile}}button,input,textarea{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #8b7fff;outline-offset:2px}ul{display:grid;gap:8px;padding:0;list-style:none}li{padding:12px;background:white;border-radius:10px}${pageBackgroundCss(project)}`,
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          noEmit: true,
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "capacitor.config.ts": `export default { appId: 'com.frontendeditor.${project.id.replace(/-/g, "").slice(0, 12)}', appName: ${JSON.stringify(project.name)}, webDir: 'dist' }`,
    "project.frontend-editor.json": serializeProject(project),
    "README.md": `# ${project.name}\n\n\`npm install\`, poi \`npm run dev\`. Build: \`npm run build\`. Per Android installare @capacitor/cli e @capacitor/android, quindi \`npx cap add android\` e \`npx cap sync\`. Nessun segreto è incluso.`,
  });
  files["app.frontend-editor.json"] = JSON.stringify(
    project.appConfig,
    null,
    2,
  );
  if (project.appConfig.environmentVariables.length)
    files[".env.example"] = project.appConfig.environmentVariables
      .map((item) => `# ${item.description}\n${item.name}=`)
      .join("\n\n");
  Object.assign(files, preservedSourceFiles(project));
  return withCodeModules(project, withGeneratedBackend(project, files));
}

function withCodeModules(project: Project, files: Record<string, string>) {
  if (!project.codeModules.length) return files;
  for (const module of project.codeModules)
    files[`src/extensions/${moduleFile(module.id)}.ts`] = generateCodeModule(module);
  return files;
}

const moduleFile = (id: string) => `module-${id.replace(/[^a-z0-9-]/gi, "").slice(0, 36)}`;

function referencedModules(project: Project) {
  const ids = project.flows.flatMap((flow) => flow.nodes.filter((node) => node.type === "module").map((node) => node.config.moduleId));
  return project.codeModules.filter((module) => ids.includes(module.id));
}

function moduleImports(project: Project) {
  return referencedModules(project).map((module, index) => `import { run as runExtension${index} } from './extensions/${moduleFile(module.id)}'`).join("\n");
}

function modulePipeline(project: Project, initial: string) {
  return referencedModules(project).reduce((value, _module, index) => `runExtension${index}(${value} as never)`, initial);
}

function generatedFlowRuntime(project: Project) {
  const runners = referencedModules(project).map((module, index) => `${JSON.stringify(module.id)}: runExtension${index}`).join(",");
  const bindings = project.pages.flatMap((page) => page.components.flatMap((component) => Object.entries(component.events).map(([event, flowId]) => ({ componentId: component.id, event, flowId }))));
  const automatic = project.flows.flatMap((flow) => flow.nodes.filter((node) => node.type === "event" && ["pageLoad", "timer"].includes(node.config.trigger)).map((node) => ({ flowId: flow.id, trigger: node.config.trigger, interval: Math.min(3600000, Math.max(500, Number(node.config.interval) || 5000)) })));
  return `type GraphNode = { id: string; type: string; label: string; position: { x: number; y: number }; config: Record<string, string> }
type GraphFlow = { id: string; name: string; nodes: GraphNode[]; edges: { id: string; source: string; target: string; path: string }[] }
const graphFlows: GraphFlow[] = ${JSON.stringify(project.flows)}
const graphState: Record<string, unknown> = ${JSON.stringify(project.state)}
const graphDebounce = new Map<string, number>()
const extensionRunners: Record<string, (value: never) => unknown> = { ${runners} }
const graphField = (value: unknown, key = '') => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
const graphElement = (id = '') => document.getElementById(id) ?? document.querySelector<HTMLElement>('[data-component="' + CSS.escape(id) + '"]')
const graphMatches = (value: unknown, key = '', operator = 'equals', expected = '') => { const actual = key ? graphField(value, key) : value; if (operator === 'exists') return actual !== undefined && actual !== null && actual !== ''; if (operator === 'notEquals') return String(actual) !== expected; if (operator === 'contains') return String(actual).toLowerCase().includes(expected.toLowerCase()); if (operator === 'greater') return Number(actual) > Number(expected); if (operator === 'less') return Number(actual) < Number(expected); return String(actual) === expected }
const graphNavigate = (mode = 'page', path = '/') => { if (mode === 'back') return history.back(); if (mode === 'url') { const url = new URL(path); if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Usa un indirizzo HTTP o HTTPS'); return location.assign(url.toString()) } location.hash = path }
const graphRole = () => { try { const payload = authToken.split('.')[0]; return String(JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/'))).role || 'viewer') } catch { return 'viewer' } }
const graphSignOut = () => { authToken = ''; sessionStorage.removeItem('frontend-editor-session'); location.reload() }
const graphPrepareFile = (value: unknown, maxMb = '2', accept = '') => new Promise<{ name: string; type: string; size: number; dataUrl: string }>((resolve, reject) => { if (!(value instanceof File)) return reject(new Error('Scegli un file')); const limit = Math.min(10, Math.max(1, Number(maxMb) || 2)) * 1024 * 1024; if (value.size > limit) return reject(new Error('Il file supera il limite di ' + Math.round(limit / 1024 / 1024) + ' MB')); const allowed = accept.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean); const extension = '.' + (value.name.split('.').pop() || '').toLowerCase(), mime = value.type.toLowerCase(); if (allowed.length && !allowed.some((item) => item === extension || item === mime || (item.endsWith('/*') && mime.startsWith(item.slice(0, -1))))) return reject(new Error('Questo tipo di file non è consentito')); const reader = new FileReader(); reader.onerror = () => reject(new Error('Non riesco a leggere il file')); reader.onload = () => resolve({ name: value.name, type: value.type, size: value.size, dataUrl: String(reader.result || '') }); reader.readAsDataURL(value) })
async function runGraph(flowId: string, input: unknown = '') {
  const flow = graphFlows.find((item) => item.id === flowId); if (!flow) throw new Error('Flow non trovato')
  const nodes = new Map(flow.nodes.map((node) => [node.id, node])); let node: GraphNode | undefined = flow.nodes.find((item) => item.type === 'event'), value = input, path = 'success', steps = 0; const visited = new Map<string, number>(), loops = new Map<string, { items: unknown[]; index: number }>()
  while (node) { if (++steps > 1000) throw new Error('Il flow ha superato il limite di 1000 passaggi'); const current: GraphNode = node, count = (visited.get(current.id) ?? 0) + 1; visited.set(current.id, count); if (count > 1 && loops.size === 0) throw new Error('Loop non controllato al nodo ' + current.label)
    try {
      if (current.type === 'readInput') value = (graphElement(current.config.componentId) as HTMLInputElement | null)?.value ?? input
      if (current.type === 'validate') { const actual = current.config.field ? graphField(value, current.config.field) : value, rule = current.config.rule || 'required', expected = current.config.value || ''; const valid = rule === 'required' ? actual !== undefined && actual !== null && String(actual).trim() !== '' : rule === 'email' ? /^\\S+@\\S+\\.\\S+$/.test(String(actual ?? '')) : rule === 'minLength' ? String(actual ?? '').length >= Math.max(0, Number(expected) || 0) : rule === 'min' ? Number(actual) >= Number(expected) : rule === 'max' ? Number(actual) <= Number(expected) : false; if (!valid) throw new Error(current.config.message || 'Il valore non è valido') }
      const condition = current.type === 'condition' ? graphMatches(value, current.config.field, current.config.operator, current.config.value) : true
      const switchValue = current.type === 'switch' ? String(current.config.field ? graphField(value, current.config.field) ?? '' : value ?? '') : '', switchMatch = current.type === 'switch' ? (current.config.cases || '').split(',').map((item) => item.trim()).filter(Boolean).find((item) => item === switchValue) : undefined
      let loopPath: string | undefined
      if (current.type === 'loop') { let state = loops.get(current.id); if (!state) { if (!Array.isArray(value)) throw new Error('Il ciclo richiede un elenco'); const limit = Math.min(100, Math.max(1, Number(current.config.max) || 100)); if (value.length > limit) throw new Error('Il ciclo supera il limite di ' + limit + ' elementi'); state = { items: value, index: 0 }; loops.set(current.id, state) } else state.index += 1; if (state.index < state.items.length) { value = state.items[state.index]; loopPath = 'each' } else { value = state.items; loops.delete(current.id); loopPath = 'done' } }
      if (current.type === 'getState') value = graphState[current.config.key || '']
      if (current.type === 'setState') graphState[current.config.key || ''] = value
      if (current.type === 'resetState') { delete graphState[current.config.key || '']; value = undefined }
      if (current.type === 'delay') await new Promise((resolve) => setTimeout(resolve, Math.min(10000, Math.max(0, Number(current.config.ms) || 0))))
      if (current.type === 'debounce') { const key = flow.id + ':' + current.id, version = (graphDebounce.get(key) ?? 0) + 1; graphDebounce.set(key, version); await new Promise((resolve) => setTimeout(resolve, Math.min(10000, Math.max(0, Number(current.config.ms) || 0)))); if (graphDebounce.get(key) !== version) return }
      if (current.type === 'format') value = (current.config.template || '{{value}}').replaceAll('{{value}}', String(value ?? ''))
      if (current.type === 'map') { if (!Array.isArray(value)) throw new Error('Il nodo trasformazione richiede un elenco'); value = value.map((item) => (current.config.template || '{{value}}').replaceAll('{{value}}', String(current.config.field ? graphField(item, current.config.field) ?? '' : item ?? ''))) }
      if (current.type === 'http') { const url = new URL(current.config.url); if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Usa un indirizzo API HTTP o HTTPS'); const method = current.config.method || 'GET', body = ['GET', 'DELETE'].includes(method) ? undefined : (current.config.body || '{{value}}').replaceAll('{{value}}', typeof value === 'string' ? value : JSON.stringify(value)); const response = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body }); if (!response.ok) throw new Error('API non disponibile (' + response.status + ')'); value = response.status === 204 ? undefined : response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text() }
      if (current.type === 'file') value = await graphPrepareFile(value, current.config.maxMb, current.config.accept)
      if (current.type === 'requireRole') { const role = graphRole(), allowed = (current.config.roles || 'admin').split(',').map((item) => item.trim()).filter(Boolean); if (!allowed.includes(role)) throw new Error(current.config.message || 'Non hai il permesso per questa azione'); value = { role, allowed: true } }
      if (current.type === 'signOut') graphSignOut()
      if (current.type === 'insert') { const next = typeof value === 'string' ? value.trim() : value; await insert(next); value = next }
      if (current.type === 'query') { const previous = value, records = await query(); if (current.config.mode === 'one') { const configured = current.config.id || '{{value}}', id = configured === '{{value}}' ? (previous && typeof previous === 'object' ? graphField(previous, current.config.field || 'id') : previous) : configured; if (id === undefined || id === null || String(id).trim() === '') throw new Error('Indica l’ID del record da caricare'); const record = records.find((item) => String(graphField(item, 'id') ?? '') === String(id)); if (!record) throw new Error('Record ' + String(id) + ' non trovato'); value = record } else value = records }
      if (current.type === 'update') value = await update(value)
      if (current.type === 'delete') { await remove(value); value = undefined }
      if (current.type === 'filter') { if (!Array.isArray(value)) throw new Error('Il nodo filtro richiede un elenco'); const needle = (current.config.value || '').toLowerCase(); value = value.filter((item) => String(graphField(item, current.config.field) ?? '').toLowerCase().includes(needle)) }
      if (current.type === 'sort') { if (!Array.isArray(value)) throw new Error('Il nodo ordinamento richiede un elenco'); value = [...value].sort((a, b) => String(graphField(a, current.config.field) ?? '').localeCompare(String(graphField(b, current.config.field) ?? '')) * (current.config.direction === 'desc' ? -1 : 1)) }
      if (current.type === 'kpi') { if (!Array.isArray(value)) throw new Error('Il nodo KPI richiede un elenco'); const values = value.map((item) => Number(graphField(item, current.config.field))).filter(Number.isFinite); value = current.config.operation === 'sum' ? values.reduce((a, b) => a + b, 0) : current.config.operation === 'average' ? (values.reduce((a, b) => a + b, 0) / (values.length || 1)) : value.length }
      if (current.type === 'module') { const runner = extensionRunners[current.config.moduleId]; if (!runner) throw new Error('Modulo non trovato'); value = runner(value as never) }
      if (current.type === 'refresh') await refresh()
      if (current.type === 'navigate') graphNavigate(current.config.mode, current.config.path)
      if (current.type === 'openModal') { const element = graphElement(current.config.componentId); if (current.config.operation === 'close') element?.setAttribute('hidden', ''); else element?.removeAttribute('hidden') }
      if (current.type === 'updateUI') { const element = graphElement(current.config.componentId) as (HTMLElement & { value?: string; disabled?: boolean }) | null, operation = current.config.operation || 'show', next = current.config.value || ''; if (!element) throw new Error('Elemento da cambiare non trovato'); if (operation === 'show') element.hidden = false; if (operation === 'hide') element.hidden = true; if (operation === 'enable') element.disabled = false; if (operation === 'disable') element.disabled = true; if (operation === 'text') element.textContent = next; if (operation === 'value') element.value = next; if (['background', 'color', 'opacity'].includes(operation)) element.style[operation as 'background' | 'color' | 'opacity'] = next }
      if (current.type === 'notify' && status) status.textContent = current.config.message || String(value)
      if (current.type === 'log') console.debug(current.config.message || current.label, value)
      path = loopPath ?? (current.type === 'switch' ? (switchMatch ? 'case:' + switchMatch : 'error') : condition ? 'success' : 'error')
    } catch (error) { path = 'error'; if (status) status.textContent = 'Errore: ' + (error instanceof Error ? error.message : String(error)) }
    const edge = flow.edges.find((item) => item.source === current.id && item.path === path); node = edge ? nodes.get(edge.target) : undefined
  }
}
${bindings.map((binding) => `{ const element = graphElement(${JSON.stringify(binding.componentId)}); const run = (event: Event) => { event.preventDefault(); const target = event.target as HTMLInputElement; const input = event.type === 'submit' && event.currentTarget instanceof HTMLFormElement ? Object.fromEntries(new FormData(event.currentTarget)) : target?.type === 'file' ? target.files?.[0] : target?.value ?? ''; void runGraph(${JSON.stringify(binding.flowId)}, input) }; element?.addEventListener(${JSON.stringify(binding.event)}, run); ${binding.event === "submit" ? `if (element instanceof HTMLFormElement) element.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach((button) => button.addEventListener('click', (event) => { event.preventDefault(); void runGraph(${JSON.stringify(binding.flowId)}, Object.fromEntries(new FormData(element))) }))` : ""} }`).join("\n")}
${automatic.map((item) => item.trigger === "pageLoad" ? `void runGraph(${JSON.stringify(item.flowId)})` : `setInterval(() => { void runGraph(${JSON.stringify(item.flowId)}) }, ${item.interval})`).join("\n")}`;
}

export async function downloadGeneratedApp(project: Project) {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(generateFiles(project)))
    zip.file(path, content);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileName = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "app"}.zip`;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return { blob, fileName };
}
