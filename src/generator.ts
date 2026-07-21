import JSZip from "jszip";
import type { Breakpoint, EditorComponent, Project } from "./model";
import { parseProject, serializeProject } from "./model";
import { buildExperienceAssets } from "./PreviewFrame";
import { nativePermissionsForProject } from "./nativeCapabilities";
import { compileRuntimeProgram, exportRuntimeAdapter, runtimeComponentCss, runtimeComponentHtml } from "./runtimeProgram";
import { assertProductConsistency } from "./productConsistency";
import { withGeneratedBackend } from "./generator/backendFiles";
import { withNativeCapabilities } from "./generator/nativeFiles";
import { generatedFlowRuntime, moduleImports, modulePipeline, withCodeModules } from "./generator/flowRuntime";

const htmlEscape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!,
  );
export function componentHtml(component: EditorComponent, children = "") {
  return runtimeComponentHtml(component, children);
}

function componentCss(component: EditorComponent, breakpoint: Breakpoint) {
  return runtimeComponentCss(component, breakpoint);
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
  const runtime = compileRuntimeProgram(project);
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
    "project.kyro.json": serializeProject(project),
    "runtime-program.json": JSON.stringify(runtime, null, 2),
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
    "README.md": `# ${project.name}\n\nRun \`npm install\`, then \`npm run dev\`. Build with \`npm run build\`. For Android, install @capacitor/cli and @capacitor/android, then run \`npx cap add android\` and \`npx cap sync\`. No secrets are included.`,
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
      `const CACHE='kyro-pwa-v2',CORE=['/app.webmanifest','/app-icon.svg'];self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE),response=await fetch('/'),html=await response.clone().text(),assets=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]).filter(url=>url.startsWith('/assets/'));await cache.put('/',response);await cache.addAll([...CORE,...assets])})()));self.addEventListener('activate',event=>event.waitUntil((async()=>{await Promise.all((await caches.keys()).filter(key=>key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim()})()));self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(async()=>await caches.match(event.request)||(event.request.mode==='navigate'?await caches.match('/'):new Response('Offline resource unavailable',{status:503}))))})`;
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
  const usesLocalNotifications = project.flows.some((flow) =>
    flow.nodes.some((node) => node.type === "localNotification"),
  );
  const usesLocalHttpBackend = project.dataSources.some((source) => {
    try {
      const url = new URL(source.endpoint ?? "");
      return url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
    } catch {
      return false;
    }
  });
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
    ...(usesLocalNotifications ? { "@capacitor/local-notifications": "^8.0.0" } : {}),
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
  const permissions = [...new Set([
    ...android.permissions,
    ...nativePermissionsForProject(project),
    ...(usesLocalNotifications ? ["notifications" as const] : []),
  ])]
    .map(
      (permission) =>
        ({
          camera: "android.permission.CAMERA",
          geolocation: "android.permission.ACCESS_FINE_LOCATION",
          notifications: "android.permission.POST_NOTIFICATIONS",
          microphone: "android.permission.RECORD_AUDIO",
          bluetoothScan: "android.permission.BLUETOOTH_SCAN",
          bluetoothConnect: "android.permission.BLUETOOTH_CONNECT",
          geolocationLegacy: "android.permission.ACCESS_FINE_LOCATION",
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
const applicationAttributes = ${JSON.stringify(
      usesLocalHttpBackend ? ['android:usesCleartextTraffic="true"'] : [],
    )}
for (const attribute of applicationAttributes) if (!manifest.includes(attribute)) manifest = manifest.replace('<application', '<application\\n        ' + attribute)
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
  const androidRuntime = `\nimport { Capacitor } from '@capacitor/core'\nimport { App as NativeApp } from '@capacitor/app'\nimport { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar'\n${usesLocalNotifications ? "import { LocalNotifications } from '@capacitor/local-notifications'" : ""}\nif (Capacitor.isNativePlatform()) {\n  void StatusBar.setStyle({ style: StatusBarStyle.${android.statusBarStyle === "dark" ? "Light" : "Dark"} })\n  void StatusBar.setBackgroundColor({ color: ${JSON.stringify(android.themeColor)} })\n  ${android.backButton ? "void NativeApp.addListener('backButton', ({ canGoBack }) => canGoBack ? history.back() : NativeApp.minimizeApp())" : ""}\n  ${usesLocalNotifications ? ";(window as typeof window & { frontendEditorLocalNotification?: (title: string, body: string, delayMs: number) => Promise<void> }).frontendEditorLocalNotification = async (title, body, delayMs) => { const permission = await LocalNotifications.requestPermissions(); if (permission.display !== 'granted') throw new Error('Notification permission was not granted'); await LocalNotifications.schedule({ notifications: [{ id: Math.max(1, Math.floor(Date.now() % 2147483647)), title, body, schedule: { at: new Date(Date.now() + delayMs) } }] }) }" : ""}\n}\n`;
  files["src/main.ts"] += androidRuntime;
  files["src/main.ts"] += "\nif (Capacitor.isNativePlatform()) void NativeApp.addListener('appUrlOpen', ({ url }) => window.dispatchEvent(new CustomEvent('kyroDeepLink', { detail: { url } })))\n";
  files["src/style.css"] +=
    "\nhtml{background:var(--safe-area-color,#fff)}body{padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left)}";
  files["index.html"] = files["index.html"].replace(
    'content="width=device-width,initial-scale=1"',
    'content="width=device-width,initial-scale=1,viewport-fit=cover"',
  );
  files["android.frontend-editor.json"] = JSON.stringify(android, null, 2);
  files["README-ANDROID.md"] =
    `# Android\n\nTarget: Capacitor 8 / Android API 24+.\n\nKyro can prepare the native folder automatically. Manual path: npm install, npm run build, npm run android:add, npm run android:sync. Open it with npm run android:open. Release signing intentionally remains external.\n\nOrientation: ${android.orientation}. Required permissions: ${android.permissions.join(", ") || "none"}. Version: ${android.versionName} (${android.versionCode}).${usesLocalHttpBackend ? "\n\nCleartext traffic is enabled only because this project uses Kyro's loopback development backend. Replace the endpoint with HTTPS before production release." : ""}`;
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
    markup: `<section id="auth-gate"><form><p>PRIVATE AREA</p><h1>Sign in</h1><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><div role="alert"></div><button type="submit">Sign in</button><button id="create-account" type="button">Create the first account</button></form></section>`,
    open: `<div id="protected-app" hidden>`,
    close: `</div>`,
    runtime: `let authToken = localStorage.getItem('frontend-editor-session') || ''
const authGate = document.getElementById('auth-gate')!, protectedApp = document.getElementById('protected-app')!, authForm = authGate.querySelector('form') as HTMLFormElement, authError = authGate.querySelector('[role="alert"]') as HTMLElement
const showApp = () => { authGate.hidden = true; protectedApp.hidden = false }
const validateSession = async (): Promise<void> => { try { const response = await fetch(${JSON.stringify(base)} + '/auth/session', { headers: { authorization: 'Bearer ' + authToken } }); if (!response.ok) throw new Error('Session expired'); showApp() } catch { authToken = ''; localStorage.removeItem('frontend-editor-session'); authError.textContent = 'Your session expired. Sign in again.' } }
if (authToken) await validateSession()
const authenticate = async (path: string): Promise<void> => { if (!authForm.reportValidity()) return; const input = Object.fromEntries(new FormData(authForm)), response = await fetch(${JSON.stringify(base)} + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }); const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Access failed'); if (path === '/auth/register') return authenticate('/auth/login'); authToken = value.token; localStorage.setItem('frontend-editor-session', authToken); showApp(); location.reload() }
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
  const dashboardPage = experience === "dashboard"
    ? project.pages.find((item) => item.components.some((component) => component.props.slot === "sidebar" || component.props.slot === "dashboard-title"))
    : undefined;
  const multiPageDashboard = Boolean(dashboardPage && project.pages.length > 1);
  const runtimePages = multiPageDashboard ? compileRuntimeProgram(project).pages : [];
  const experienceMarkup = multiPageDashboard
    ? `<nav class="app-page-nav" aria-label="Pages">${project.pages.map((item) => `<a href="#${htmlEscape(item.path)}">${htmlEscape(item.name)}</a>`).join("")}</nav>${runtimePages.map((item) => `<section data-route="${htmlEscape(item.path)}">${item.path === dashboardPage!.path ? assets.markup : item.markup}</section>`).join("")}`
    : assets.markup;
  const routeRuntime = multiPageDashboard
    ? `const route = () => { const path = decodeURIComponent(location.hash.slice(1) || ${JSON.stringify(dashboardPage!.path)}); document.querySelectorAll<HTMLElement>('[data-route]').forEach((section) => section.hidden = section.dataset.route !== path); document.querySelectorAll<HTMLAnchorElement>('.app-page-nav a').forEach((link) => link.toggleAttribute('aria-current', link.hash === '#' + path)) }; addEventListener('hashchange', route); route();`
    : "";
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
async function insert(value: unknown): Promise<void> { const fields = value && typeof value === 'object' ? value : { text: String(value) }; const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(authToken ? { authorization: 'Bearer ' + authToken } : {}) }, body: JSON.stringify(fields) }); if (!response.ok) throw new Error('Save failed (' + response.status + ')') }
async function update(value: unknown) { const item = value as Record<string, unknown>; const response = await fetch(endpoint + '/' + encodeURIComponent(String(item.id ?? '')), { method: 'PUT', headers: { 'content-type': 'application/json', ...(authToken ? { authorization: 'Bearer ' + authToken } : {}) }, body: JSON.stringify(item) }); if (!response.ok) throw new Error('Update failed (' + response.status + ')'); return response.json() }
async function remove(value: unknown) { const item = value as Record<string, unknown>; const response = await fetch(endpoint + '/' + encodeURIComponent(String(item.id ?? value ?? '')), { method: 'DELETE', headers: authToken ? { authorization: 'Bearer ' + authToken } : {} }); if (!response.ok) throw new Error('Delete failed (' + response.status + ')') }`
      : landingSource
        ? `const openDb = () => new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('frontend-editor-export', 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records', { keyPath: 'id' }).createIndex('sourceId', 'sourceId') }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
async function query(): Promise<SiteItem[]> { const db = await openDb(); return new Promise((resolve, reject) => { const request = db.transaction('records').objectStore('records').index('sourceId').getAll(sourceId); request.onsuccess = () => resolve((request.result as SiteItem[]).sort((a, b) => b.date.localeCompare(a.date))); request.onerror = () => reject(request.error) }) }
async function insert(value: unknown): Promise<void> { const db = await openDb(); const fields = value && typeof value === 'object' ? value as Record<string, unknown> : { text: String(value) }; await new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put({ ...fields, id: crypto.randomUUID(), sourceId, text: String(fields.text ?? fields.name ?? 'Item'), date: new Date().toISOString() }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }) }
async function update(value: unknown) { const db = await openDb(), item = value as SiteItem; await new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put(item); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }); return item }
async function remove(value: unknown) { const db = await openDb(), item = value as Partial<SiteItem>; await new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').delete(String(item.id ?? value)); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }) }`
        : `async function query(): Promise<SiteItem[]> { return [] }
async function insert(_value?: unknown): Promise<void> { throw new Error('Configure a data source to save requests') }
async function update(_value?: unknown): Promise<void> { throw new Error('Configure a data source') }
async function remove(_value?: unknown): Promise<void> { throw new Error('Configure a data source') }`;
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
if (!sourceId) throw new Error('Dashboard data source is not configured')
${dashboardDataRuntime}
const status = document.querySelector<HTMLElement>('[role="status"]')
const refresh = async () => { const records = await query(); dispatchEvent(new MessageEvent('message', { data: { channel: 'frontend-editor-host', records } })) }
declare global { interface Window { dashboardData: { query: () => Promise<Item[]>; action: (action: string, payload: ProjectInput) => Promise<Item[]> } } }
window.dashboardData = { query, action: async (action, payload) => { if (action === 'delete') await remove(String(payload.id)); else await save(payload); return query() } }
await import('./ui.js')
${routeRuntime}
${project.flows.length ? generatedFlowRuntime(project) : ""}
${project.appConfig.realtime.mode === "sse" ? `const updates = new EventSource(${JSON.stringify(project.appConfig.realtime.url)}); updates.addEventListener('records', () => void window.dashboardData.query().then((records) => dispatchEvent(new MessageEvent('message', { data: { channel: 'frontend-editor-host', records } }))))` : ""}
`;
  const ui =
    experience === "landing"
      ? `export {};const deliver=(detail)=>dispatchEvent(new MessageEvent('message',{data:{channel:'frontend-editor-host',...detail}}));const send=async(type,payload={})=>{try{if(type==='READY')deliver({records:await window.siteData.query()});if(type==='ADD'){await window.siteData.insert(payload.value);deliver({records:await window.siteData.query(),action:'add'})}}catch(error){deliver({records:await window.siteData.query(),error:error instanceof Error?error.message:String(error)})}};${assets.script}`
      : `export {};const deliver=(detail)=>dispatchEvent(new MessageEvent('message',{data:{channel:'frontend-editor-host',...detail}}));const send=async(type,payload={})=>{try{if(type==='READY')deliver({records:await window.dashboardData.query()});if(type==='DASHBOARD_ACTION')deliver({records:await window.dashboardData.action(payload.action,payload.payload),action:payload.action})}catch(error){deliver({records:await window.dashboardData.query(),error:error instanceof Error?error.message:String(error)})}};${assets.script}`;
  return {
    ...commonExportFiles(project),
    "index.html": `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%230f172a'/%3E%3Ctext x='50' y='70' text-anchor='middle' font-size='64' fill='%2322d3ee'%3EK%3C/text%3E%3C/svg%3E"><title>${htmlEscape(project.name)}</title></head><body data-runtime-adapter="${exportRuntimeAdapter(project.exportConfig.target).target}">${auth.markup}${auth.open}${experienceMarkup}${auth.close}<script type="module" src="/src/main.ts"></script></body></html>`,
    "src/main.ts": experience === "landing" ? landingMain : dashboardMain,
    "src/ui.js": ui,
    "src/style.css": `${baseCss}${multiPageDashboard ? ".app-page-nav{display:flex;flex-wrap:wrap;gap:12px;padding:12px 20px;background:#0f172a}.app-page-nav a{color:#fff;font-weight:700}.app-page-nav a[aria-current]{color:#67e8f9}[data-route][hidden]{display:none!important}" : ""}`,
  };
}

export function generateFiles(input: Project): Record<string, string> {
  const project = parseProject(input);
  const runtime = compileRuntimeProgram(project);
  assertProductConsistency(project, runtime);
  const page = project.pages[0];
  if (!page) throw new Error("Add at least one page before exporting");
  if (
    project.appConfig.authentication.mode === "generated" &&
    !project.dataSources.some((source) => source.provider === "generated")
  )
    throw new Error(
      "Il login richiede il backend: apri Dati e scegli Genera anche il backend",
    );
  const standaloneDashboard = project.state.experience === "dashboard" && project.pages.some((item) => item.components.some((component) => component.props.slot === "sidebar" || component.props.slot === "dashboard-title"));
  if (project.state.experience === "landing" || standaloneDashboard) {
    const experience = project.state.experience === "landing" ? "landing" : "dashboard";
    if (!project.flows.length)
      throw new Error("Configura i flow prima dell’export");
    if (standaloneDashboard && !project.dataSources.length)
      throw new Error("Configura la sorgente dati prima dell’export");
    const files = withGeneratedBackend(
      project,
      platformFiles(
        project,
        generateExperienceFiles(project, experience),
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
  const configuredNavigation = project.appConfig.mobileBottomNavigation;
  const useBottomNavigation = Boolean(configuredNavigation?.enabled || project.exportConfig.target !== "web");
  const navigationItems = configuredNavigation?.enabled
    ? configuredNavigation.items
    : project.pages.map((item) => ({ label: item.name, path: item.path }));
  const navigationClass = useBottomNavigation ? "app-bottom-nav" : "app-page-nav";
  const remainingNavigation: { label: string; path: string }[] = [];
  const navigationOverflow = useBottomNavigation && navigationItems.length > 5
    ? [...navigationItems.slice(4), ...remainingNavigation]
    : remainingNavigation;
  const primaryNavigation = navigationOverflow.length ? navigationItems.slice(0, 4) : navigationItems;
  const navigationLink = (item: { label: string; path: string }) => `<a href="#${htmlEscape(item.path)}">${htmlEscape(item.label)}</a>`;
  const navigationMore = navigationOverflow.length ? `<style>.app-nav-more{position:relative;display:grid}.app-nav-more summary{display:grid;place-items:center;min-height:44px;padding:8px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;list-style:none}.app-nav-more summary::-webkit-details-marker{display:none}.app-nav-more summary[aria-current]{background:#6d5dfc;color:#fff}.app-nav-more>div{position:absolute;right:0;bottom:calc(100% + 8px);z-index:30;display:grid;min-width:180px;gap:4px;padding:8px;border:1px solid #cfd4df;border-radius:12px;background:#171a1f;color:#fff;box-shadow:0 16px 40px #0005}.app-nav-more>div a{justify-content:start}</style><details class="app-nav-more"><summary>More</summary><div role="menu">${navigationOverflow.map(navigationLink).join("")}</div></details>` : "";
  const body = `<nav class="${navigationClass}" aria-label="Pages">${primaryNavigation.map(navigationLink).join("")}${navigationMore}</nav>${runtime.pages.map((item) => `<section data-route="${htmlEscape(item.path)}">${item.markup}</section>`).join("")}`;
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
  const singleSourceRuntime =
    source?.provider === "rest" || source?.provider === "generated"
      ? `const endpoint = ${JSON.stringify(source.endpoint)}
type OfflineMutation = { id: string; path: string; method: string; body?: string }
const offlineQueueKey = 'kyro-offline-mutations'
const readOfflineQueue = (): OfflineMutation[] => { try { const value = JSON.parse(localStorage.getItem(offlineQueueKey) || '[]'); return Array.isArray(value) ? value : [] } catch { return [] } }
const writeOfflineQueue = (value: OfflineMutation[]) => localStorage.setItem(offlineQueueKey, JSON.stringify(value))
const queueOfflineMutation = (path: string, init: RequestInit) => { const queue = readOfflineQueue(); queue.push({ id: crypto.randomUUID(), path, method: init.method || 'POST', body: typeof init.body === 'string' ? init.body : undefined }); writeOfflineQueue(queue); dispatchEvent(new Event('kyro-offline-queued')); return { queued: true } }
async function request(path = '', init: RequestInit = {}, allowQueue = true) { if (${JSON.stringify(project.appConfig.offline)} && allowQueue && init.method && init.method !== 'GET' && !navigator.onLine) return queueOfflineMutation(path, init); const response = await fetch(endpoint + path, { ...init, headers: { 'content-type': 'application/json', ...(authToken ? { authorization: 'Bearer ' + authToken } : {}), ...init.headers } }); if (!response.ok) throw new Error('API unavailable (' + response.status + ')'); return response.status === 204 ? undefined : response.json() }
async function replayOfflineMutations() { if (!navigator.onLine) return; const queue = readOfflineQueue(); let synced = 0; while (queue.length) { const item = queue[0]; try { await request(item.path, { method: item.method, body: item.body }, false); queue.shift(); writeOfflineQueue(queue); synced += 1 } catch { break } } if (synced) dispatchEvent(new CustomEvent('kyro-offline-synced', { detail: synced })) }
addEventListener('online', () => void replayOfflineMutations())
async function query(selectedSourceId = sourceId): Promise<Item[]> { const value = await request(); if (!Array.isArray(value)) throw new Error('L’API deve restituire un elenco JSON'); return value.map((item, index) => ({ ...item, id: String(item.id ?? index), sourceId: selectedSourceId, text: String(item.text ?? item.name ?? item.title ?? 'Item'), date: String(item.date ?? new Date().toISOString()) })) }
async function insert(value: unknown, _selectedSourceId = sourceId) { const fields = value && typeof value === 'object' && !Array.isArray(value) ? value : { text: String(value) }; await request('', { method: 'POST', body: JSON.stringify(fields) }) }
async function update(value: unknown, _selectedSourceId = sourceId) { const item = value as Record<string, unknown>; return request('/' + encodeURIComponent(String(item.id ?? '')), { method: 'PUT', body: JSON.stringify(item) }) }
async function remove(value: unknown, _selectedSourceId = sourceId) { const item = value as Record<string, unknown>; return request('/' + encodeURIComponent(String(item.id ?? '')), { method: 'DELETE' }) }`
      : `const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('frontend-editor-export', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' }).createIndex('sourceId', 'sourceId')
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})
async function query(selectedSourceId = sourceId): Promise<Item[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => { const request = db.transaction('records').objectStore('records').index('sourceId').getAll(selectedSourceId); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
}
async function insert(value: unknown, selectedSourceId = sourceId) {
  const db = await openDb()
  const fields = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : { text: String(value) }
  const item = { ...fields, id: typeof fields.id === 'string' && fields.id ? fields.id : crypto.randomUUID(), sourceId: selectedSourceId, text: String(fields.text ?? fields.name ?? fields.title ?? 'Item'), date: typeof fields.date === 'string' ? fields.date : new Date().toISOString() }
  return new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').add(item); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}
async function update(value: unknown, selectedSourceId = sourceId) {
  const db = await openDb(), item = value as Item
  return new Promise<Item>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put({ ...item, sourceId: selectedSourceId }); tx.oncomplete = () => resolve(item); tx.onerror = () => reject(tx.error) })
}
async function remove(value: unknown, _selectedSourceId = sourceId) {
  const db = await openDb(), item = value as Item
  return new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').delete(item.id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}`;
  const dataRuntime = project.dataSources.length <= 1 ? singleSourceRuntime : `type SourceConfig = { id: string; provider: string; endpoint?: string }
type OfflineMutation = { id: string; sourceId: string; path: string; method: string; body?: string }
const graphSources: SourceConfig[] = ${JSON.stringify(project.dataSources.map(({ id, provider, endpoint }) => ({ id, provider, ...(endpoint ? { endpoint } : {}) })))}
const sourceConfig = (selectedSourceId = sourceId) => { const source = graphSources.find((item) => item.id === selectedSourceId); if (!source) throw new Error('Data source not found: ' + selectedSourceId); return source }
const openDb = () => new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('frontend-editor-export', 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records', { keyPath: 'id' }).createIndex('sourceId', 'sourceId') }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
const offlineQueueKey = 'kyro-offline-mutations'
const readOfflineQueue = (): OfflineMutation[] => { try { const value = JSON.parse(localStorage.getItem(offlineQueueKey) || '[]'); return Array.isArray(value) ? value : [] } catch { return [] } }
const writeOfflineQueue = (value: OfflineMutation[]) => localStorage.setItem(offlineQueueKey, JSON.stringify(value))
const queueOfflineMutation = (source: SourceConfig, path: string, init: RequestInit) => { const queue = readOfflineQueue(); queue.push({ id: crypto.randomUUID(), sourceId: source.id, path, method: init.method || 'POST', body: typeof init.body === 'string' ? init.body : undefined }); writeOfflineQueue(queue); dispatchEvent(new Event('kyro-offline-queued')); return { queued: true } }
async function sourceRequest(source: SourceConfig, path = '', init: RequestInit = {}, allowQueue = true) { if (!source.endpoint) throw new Error('Endpoint not configured for ' + source.id); if (${JSON.stringify(project.appConfig.offline)} && allowQueue && init.method && init.method !== 'GET' && !navigator.onLine) return queueOfflineMutation(source, path, init); const response = await fetch(source.endpoint + path, { ...init, headers: { 'content-type': 'application/json', ...(authToken ? { authorization: 'Bearer ' + authToken } : {}), ...init.headers } }); if (!response.ok) throw new Error('API unavailable (' + response.status + ')'); return response.status === 204 ? undefined : response.json() }
async function replayOfflineMutations() { if (!navigator.onLine) return; const queue = readOfflineQueue(); let synced = 0; while (queue.length) { const item = queue[0]; try { await sourceRequest(sourceConfig(item.sourceId), item.path, { method: item.method, body: item.body }, false); queue.shift(); writeOfflineQueue(queue); synced += 1 } catch { break } } if (synced) dispatchEvent(new CustomEvent('kyro-offline-synced', { detail: synced })) }
addEventListener('online', () => void replayOfflineMutations())
async function query(selectedSourceId = sourceId): Promise<Item[]> { const source = sourceConfig(selectedSourceId); if (source.provider === 'rest' || source.provider === 'generated') { const value = await sourceRequest(source); if (!Array.isArray(value)) throw new Error('L\u2019API deve restituire un elenco JSON'); return value.map((item, index) => ({ ...item, id: String(item.id ?? index), sourceId: selectedSourceId, text: String(item.text ?? item.name ?? item.title ?? 'Item'), date: String(item.date ?? new Date().toISOString()) })) } const db = await openDb(); return new Promise((resolve, reject) => { const request = db.transaction('records').objectStore('records').index('sourceId').getAll(selectedSourceId); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
async function insert(value: unknown, selectedSourceId = sourceId) { const source = sourceConfig(selectedSourceId), fields = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : { text: String(value) }; if (source.provider === 'rest' || source.provider === 'generated') return sourceRequest(source, '', { method: 'POST', body: JSON.stringify(fields) }); const db = await openDb(), item = { ...fields, id: typeof fields.id === 'string' && fields.id ? fields.id : crypto.randomUUID(), sourceId: selectedSourceId, text: String(fields.text ?? fields.name ?? fields.title ?? 'Item'), date: typeof fields.date === 'string' ? fields.date : new Date().toISOString() }; return new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').add(item); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }) }
async function update(value: unknown, selectedSourceId = sourceId) { const source = sourceConfig(selectedSourceId), item = value as Item; if (source.provider === 'rest' || source.provider === 'generated') return sourceRequest(source, '/' + encodeURIComponent(String(item.id ?? '')), { method: 'PUT', body: JSON.stringify(item) }); const db = await openDb(); return new Promise<Item>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put({ ...item, sourceId: selectedSourceId }); tx.oncomplete = () => resolve(item); tx.onerror = () => reject(tx.error) }) }
async function remove(value: unknown, selectedSourceId = sourceId) { const source = sourceConfig(selectedSourceId), item = value as Item; if (source.provider === 'rest' || source.provider === 'generated') return sourceRequest(source, '/' + encodeURIComponent(String(item.id ?? '')), { method: 'DELETE' }); const db = await openDb(); return new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').delete(item.id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }) }
`;
  const dataBindings = project.pages.flatMap((item) => item.components
    .filter((component) => component.binding?.sourceId && (component.type === "list" || component.type === "chart" || component.type === "calendar" || component.props.metric))
    .map((component) => {
      const boundSource = project.dataSources.find((source) => source.id === component.binding!.sourceId);
      return {
        componentId: component.id,
        sourceId: component.binding!.sourceId,
        kind: component.type,
        metric: String(component.props.metric || ""),
        suffix: String(component.props.metricSuffix || ""),
        updateFlowId: component.events.recordUpdate ?? "",
        deleteFlowId: component.events.recordDelete ?? "",
        completion: boundSource && Object.hasOwn(boundSource.schema, "completedToday") && Object.hasOwn(boundSource.schema, "currentStreak") ? "streak" : boundSource && (Object.hasOwn(boundSource.schema, "completed") || Object.hasOwn(boundSource.schema, "status")) ? "status" : "none",
        editable: Boolean(boundSource && Object.hasOwn(boundSource.schema, "title") && Object.hasOwn(boundSource.schema, "dueDate")),
        removable: Boolean(boundSource?.capabilities.includes("delete")),
      };
    }));
  const main = `import './style.css'
${moduleImports(project)}

${auth.runtime}

type Item = { id: string; sourceId: string; text: string; date: string }
const sourceId = ${JSON.stringify(source?.id ?? "local-items")}
${dataRuntime}
type DataBinding = { componentId: string; sourceId: string; kind: string; metric: string; suffix: string; updateFlowId: string; deleteFlowId: string; completion: 'streak' | 'status' | 'none'; editable: boolean; removable: boolean }
const dataBindings: DataBinding[] = ${JSON.stringify(dataBindings)}
const status = document.querySelector<HTMLElement>('.status')
const normalizeTheme = (value = '') => /scur|dark/i.test(value) ? 'dark' : /chiar|light/i.test(value) ? 'light' : 'system'
const applyTheme = (mode: string) => { const resolved = mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode; document.documentElement.dataset.theme = resolved; const control = document.querySelector<HTMLSelectElement>('[name="theme"]'); if (control) control.value = [...control.options].find((option) => normalizeTheme(option.value) === mode)?.value ?? control.value }
const initialTheme = localStorage.getItem('frontend-editor-theme') || ${JSON.stringify(project.appConfig.themeMode ?? "system")}; applyTheme(initialTheme)
document.querySelector<HTMLSelectElement>('[name="theme"]')?.addEventListener('change', (event) => { const mode = normalizeTheme((event.currentTarget as HTMLSelectElement).value); localStorage.setItem('frontend-editor-theme', mode); applyTheme(mode) })
document.querySelectorAll<HTMLCanvasElement>('[data-signature-canvas]').forEach((canvas) => { const input = canvas.parentElement?.querySelector<HTMLInputElement>('input[type="hidden"]'), clear = canvas.parentElement?.querySelector<HTMLButtonElement>('[data-clear-signature]'), context = canvas.getContext('2d'); if (!input || !clear || !context) return; const resize = () => { const ratio = Math.max(1, window.devicePixelRatio || 1), box = canvas.getBoundingClientRect(), width = Math.max(1, Math.round(box.width * ratio)), height = Math.max(1, Math.round(140 * ratio)); if (canvas.width === width && canvas.height === height) return; canvas.width = width; canvas.height = height; context.setTransform(ratio, 0, 0, ratio, 0, 0); context.lineWidth = 2.5; context.lineCap = 'round'; context.strokeStyle = getComputedStyle(canvas).color }, point = (event: PointerEvent) => { const bounds = canvas.getBoundingClientRect(); return { x: event.clientX - bounds.left, y: event.clientY - bounds.top } }; let drawing = false; requestAnimationFrame(resize); new ResizeObserver(resize).observe(canvas); canvas.addEventListener('pointerdown', (event) => { resize(); drawing = true; const value = point(event); context.beginPath(); context.moveTo(value.x, value.y); try { canvas.setPointerCapture(event.pointerId) } catch {} }); canvas.addEventListener('pointermove', (event) => { if (!drawing) return; const value = point(event); context.lineTo(value.x, value.y); context.stroke() }); const finish = () => { if (!drawing) return; drawing = false; input.value = canvas.toDataURL('image/png'); input.dispatchEvent(new Event('change', { bubbles: true })) }; canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', finish); clear.addEventListener('click', () => { context.clearRect(0, 0, canvas.width, canvas.height); input.value = ''; input.dispatchEvent(new Event('change', { bubbles: true })) }) })
const sortDirection = new Map<string, number>()
let lastDeleted: { item: Item; sourceId: string; componentId: string } | undefined
const routeBindings = (element: Element) => { const route = element.closest('[data-route]'); return dataBindings.filter((binding) => route?.contains(document.getElementById(binding.componentId))) }
const refreshRoute = (element: Element) => Promise.all(routeBindings(element).map((binding) => refresh(binding.componentId)))
type ViewState = { pending: number; empty: boolean; error: boolean }
const viewStates = new WeakMap<HTMLElement, ViewState>()
const viewStateRoot = (element: Element) => element.closest<HTMLElement>('[data-route]')
const showViewState = (element: Element, state: 'loading' | 'empty' | 'error' | 'ready') => { const route = viewStateRoot(element); route?.querySelectorAll<HTMLElement>('[data-view-state]').forEach((item) => { item.hidden = item.dataset.viewState !== state }) }
const beginViewState = (element: Element) => { const route = viewStateRoot(element); if (!route) return; const current = viewStates.get(route) ?? { pending: 0, empty: true, error: false }; if (current.pending === 0) { current.empty = true; current.error = false } current.pending += 1; viewStates.set(route, current); showViewState(element, 'loading') }
const finishViewState = (element: Element, count: number, failed = false) => { const route = viewStateRoot(element); if (!route) return; const current = viewStates.get(route) ?? { pending: 1, empty: true, error: false }; current.pending = Math.max(0, current.pending - 1); current.empty = current.empty && count === 0; current.error = current.error || failed; viewStates.set(route, current); if (current.pending === 0) showViewState(element, current.error ? 'error' : current.empty ? 'empty' : 'ready') }
const fillForm = (form: HTMLFormElement, item: Item) => { Object.entries(item as Record<string, unknown>).forEach(([name, value]) => { const field = form.elements.namedItem(name) as HTMLInputElement | null; if (!field) return; if (field.type === 'checkbox') field.checked = Boolean(value); else field.value = String(value ?? '') }); form.dataset.editingId = item.id; form.dataset.sourceId = item.sourceId }
async function saveEdit(form: HTMLFormElement) { if (!form.checkValidity()) return form.reportValidity(); const id = form.dataset.editingId, selectedSourceId = form.dataset.sourceId; if (!id || !selectedSourceId) return; const previous = (await query(selectedSourceId)).find((item) => item.id === id); if (!previous) throw new Error('Item to edit was not found'); const fields: Record<string, unknown> = Object.fromEntries(new FormData(form)); form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((field) => fields[field.name] = field.checked); await update({ ...previous, ...fields, id, sourceId: selectedSourceId, text: String(fields.title ?? fields.name ?? previous.text) }, selectedSourceId); delete form.dataset.editingId; delete form.dataset.sourceId; form.reset(); await refreshRoute(form) }
const makeRow = (item: Item, binding: DataBinding, root: HTMLElement, state: HTMLElement) => { const row = document.createElement('li'), title = document.createElement('strong'), description = document.createElement('p'), actions = document.createElement('div'), record = item as Record<string, unknown>, dateValue = String(record.dueDate ?? record.date ?? '').trim(); row.dataset.id = item.id; title.textContent = item.text; description.textContent = String(record.description ?? record.frequency ?? ''); actions.className = 'record-actions'; if (binding.editable) { const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Edit'; edit.addEventListener('click', () => { const form = root.closest('[data-route]')?.querySelector<HTMLFormElement>('form'); if (form) { fillForm(form, item); form.scrollIntoView({ behavior: 'smooth', block: 'start' }) } }); actions.append(edit) } if (binding.completion !== 'none') { const done = binding.completion === 'streak' ? Boolean(record.completedToday) : Boolean(record.completed) || record.status === 'Completed'; const complete = document.createElement('button'); complete.type = 'button'; complete.textContent = done ? 'Completed' : 'Complete'; complete.disabled = done; complete.addEventListener('click', async () => { const streak = Number(record.currentStreak) || 0, value = binding.completion === 'streak' ? { ...item, completedToday: true, currentStreak: streak + 1, bestStreak: Math.max(Number(record.bestStreak)||0,streak+1), lastCompletedAt:new Date().toISOString() } : { ...item, completed:true, status:'Completed' }; if (binding.updateFlowId) await runGraph(binding.updateFlowId, value); else await update(value,binding.sourceId); await refresh(binding.componentId) }); actions.append(complete) } if (binding.removable) { const removeButton = document.createElement('button'); removeButton.type = 'button'; removeButton.textContent = 'Delete'; removeButton.addEventListener('click', async () => { if (!confirm('Delete ' + item.text + '?')) return; lastDeleted = { item, sourceId: binding.sourceId, componentId: binding.componentId }; if (binding.deleteFlowId) await runGraph(binding.deleteFlowId,item); else await remove(item,binding.sourceId); await refresh(binding.componentId); const undo=document.createElement('button'); undo.type='button'; undo.textContent='Undo'; undo.addEventListener('click',async()=>{if(!lastDeleted)return;await insert(lastDeleted.item,lastDeleted.sourceId);const target=lastDeleted.componentId;lastDeleted=undefined;await refresh(target)}); state.replaceChildren(document.createTextNode('Item deleted. '),undo) }); actions.append(removeButton) } row.append(title, description); if (dateValue) { const time = document.createElement('time'); time.dateTime = dateValue; time.textContent = new Date(dateValue).toLocaleDateString('en'); row.append(time) } if (actions.childElementCount) row.append(actions); return row }
const itemDate = (item: Item) => String((item as Record<string, unknown>).dueDate ?? item.date ?? (item as Record<string, unknown>).lastCompletedAt ?? '').slice(0, 10)
const itemDone = (item: Item) => { const value = item as Record<string, unknown>; return Boolean(value.completed || value.completedToday) || /complet/i.test(String(value.status ?? '')) }
const renderBoundData = (binding: DataBinding, root: HTMLElement, items: Item[]) => { if (binding.kind === 'chart') { const today = new Date(), days = Array.from({ length: 7 }, (_, index) => { const day = new Date(today); day.setDate(today.getDate() - 6 + index); return day.toISOString().slice(0, 10) }), values = days.map((day) => items.filter((item) => itemDate(item) === day && (binding.metric !== 'completed' || itemDone(item))).length), max = Math.max(1, ...values); root.querySelectorAll('rect').forEach((bar, index) => { const height = Math.max(4, Math.round((values[index] || 0) / max * 106)); bar.setAttribute('y', String(124 - height)); bar.setAttribute('height', String(height)) }); root.querySelector('svg')?.setAttribute('aria-label', 'Last seven days: ' + values.join(', ')); const caption = root.querySelector<HTMLElement>('figcaption'); if (caption) { const label = caption.dataset.label || caption.textContent || 'Chart'; caption.dataset.label = label.split(' · ')[0]; caption.textContent = caption.dataset.label + ' · ' + values.reduce((sum, value) => sum + value, 0) + ' total' } return } if (binding.kind === 'calendar') { const input = root.querySelector<HTMLInputElement>('input[type="date"]'), list = root.querySelector<HTMLUListElement>('ul'); if (!input || !list) return; if (!input.value) input.value = new Date().toISOString().slice(0, 10); const renderDay = () => { const shown = items.filter((item) => itemDate(item) === input.value); list.replaceChildren(...(shown.length ? shown.map((item) => { const row = document.createElement('li'), value = item as Record<string, unknown>; row.textContent = String(value.title ?? value.name ?? item.text) + (value.time ? ' · ' + String(value.time) : ''); return row }) : [Object.assign(document.createElement('li'), { textContent: 'No items on this date' })])) }; renderDay(); if (!input.dataset.bound) { input.dataset.bound = 'true'; input.addEventListener('change', renderDay) } return } if (binding.metric) { const values = items.map((item) => item as Record<string, unknown>), number = binding.metric === 'completed' ? items.filter(itemDone).length : binding.metric === 'active' ? items.filter((item) => !itemDone(item)).length : binding.metric === 'maxStreak' ? Math.max(0, ...values.map((item) => Number(item.bestStreak ?? item.currentStreak) || 0)) : items.length, target = root.querySelector<HTMLElement>('strong') ?? root; target.textContent = String(number) + (binding.suffix ? ' ' + binding.suffix : '') } }
async function refresh(componentId = '') {
  const targets: DataBinding[] = componentId ? dataBindings.filter((binding) => binding.componentId === componentId) : dataBindings.length ? dataBindings : [{ componentId: ${JSON.stringify(list?.id ?? "")}, sourceId, kind: 'list', metric: '', suffix: '', updateFlowId: '', deleteFlowId: '', completion: 'none', editable: false, removable: false }]
  await Promise.all(targets.map(async (binding) => { const root = document.getElementById(binding.componentId); if (!root) return; const state = root.querySelector<HTMLElement>('.status'), list = binding.kind === 'list' ? root.querySelector<HTMLUListElement>('ul') : null; beginViewState(root); if (state) state.textContent = 'Loading…'; try { const route = root.closest('[data-route]'), search = route?.querySelector<HTMLInputElement>('[name="search"]')?.value.trim().toLowerCase() ?? '', filter = route?.querySelector<HTMLSelectElement>('[name="filter"]')?.value ?? '', direction = sortDirection.get(binding.componentId) ?? -1; const items = (await query(binding.sourceId)).filter((item) => !search || Object.values(item).some((value) => String(value ?? '').toLowerCase().includes(search))).filter((item) => !filter || /^(tutti|all)/i.test(filter) || String((item as Record<string, unknown>).status ?? '') === filter).sort((a, b) => String(a.date).localeCompare(String(b.date)) * direction); if (list && state) { list.replaceChildren(...items.map((item) => makeRow(item, binding, root, state))); state.textContent = items.length ? '' : 'No items yet. Add one to get started.' } else renderBoundData(binding, root, items); finishViewState(root, items.length) } catch (error) { finishViewState(root, 0, true); if (state) state.textContent = 'Error: ' + (error instanceof Error ? error.message : String(error)); else graphNotify('Data error: ' + (error instanceof Error ? error.message : String(error)), true) } }))
}
document.querySelectorAll<HTMLInputElement>('[name="search"], [name="filter"]').forEach((control) => control.addEventListener(control.name === 'search' ? 'input' : 'change', () => void refreshRoute(control)))
document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { if (!/(ordina|sort)/i.test(button.textContent ?? '')) return; button.addEventListener('click', () => { routeBindings(button).forEach((binding) => sortDirection.set(binding.componentId, -(sortDirection.get(binding.componentId) ?? -1))); void refreshRoute(button) }) })
document.addEventListener('click', (event) => { const button = (event.target as Element).closest<HTMLButtonElement>('button[type="submit"]'), form = button?.form; if (!form?.dataset.editingId) return; event.preventDefault(); event.stopImmediatePropagation(); void saveEdit(form).catch((error) => { const state = form.closest('[data-route]')?.querySelector<HTMLElement>('.status'); if (state) state.textContent = 'Error: ' + (error instanceof Error ? error.message : String(error)) }) }, true)
const routeMatches = (pattern: string, path: string) => { const expected = pattern.split('/').filter(Boolean), actual = path.split('/').filter(Boolean); return expected.length === actual.length && expected.every((part, index) => part.startsWith(':') || part === actual[index]) }
function route() { const path = decodeURIComponent(location.hash.slice(1) || ${JSON.stringify(project.pages[0].path)}); document.querySelectorAll<HTMLElement>('[data-route]').forEach((section) => { section.hidden = !routeMatches(section.dataset.route || '', path) }); document.querySelectorAll<HTMLAnchorElement>('nav a').forEach((link) => link.toggleAttribute('aria-current', link.hash === '#' + path)); const more = document.querySelector<HTMLDetailsElement>('.app-nav-more'), active = more?.querySelector('a[aria-current]'); more?.querySelector('summary')?.toggleAttribute('aria-current', Boolean(active)); if (active) more?.removeAttribute('open') }
addEventListener('hashchange', route); addEventListener('hashchange', () => { const path = decodeURIComponent(location.hash.slice(1)); void Promise.all(dataBindings.filter((binding) => routeMatches(document.getElementById(binding.componentId)?.closest<HTMLElement>('[data-route]')?.dataset.route || '', path)).map((binding) => refresh(binding.componentId))) }); route()
${project.flows.length ? generatedFlowRuntime(project) : `async function runGraph(flowId: string, _input: unknown = ''): Promise<never> { throw new Error('Flow not found: ' + flowId) }
const graphNotify = (message: string, error = false) => { let toast = document.querySelector<HTMLElement>('[data-flow-status]'); if (!toast) { toast = document.createElement('div'); toast.dataset.flowStatus = ''; toast.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;padding:12px 16px;border-radius:10px;background:#172033;color:white'; document.body.append(toast) } toast.setAttribute('role', error ? 'alert' : 'status'); toast.style.background = error ? '#b42318' : '#172033'; toast.textContent = message; toast.hidden = false; window.setTimeout(() => { if (toast) toast.hidden = true }, 2600) }
document.getElementById('${button?.id ?? ""}')?.addEventListener('click', async () => {
  const input = document.getElementById('${inputComponent?.id ?? ""}') as HTMLInputElement | null
  if (!input?.value.trim()) { input?.setAttribute('aria-invalid', 'true'); status!.textContent = 'A value is required'; return }
  const value = ${modulePipeline(project, "input.value.trim()")}; await insert(String(value)); input.value = ''; input.removeAttribute('aria-invalid'); await refresh()
})`}
${project.appConfig.offline && project.dataSources.some((item) => item.provider === "rest" || item.provider === "generated") ? `addEventListener('kyro-offline-queued', () => graphNotify('Saved offline. Changes will sync when the connection returns.'))
addEventListener('kyro-offline-synced', (event) => { const count = Number((event as CustomEvent).detail) || 0; graphNotify(count + (count === 1 ? ' offline change synced.' : ' offline changes synced.')); void refresh() })
void replayOfflineMutations()` : ""}
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
    "runtime-program.json": JSON.stringify(runtime, null, 2),
    "index.html": `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%230f172a'/%3E%3Ctext x='50' y='70' text-anchor='middle' font-size='64' fill='%2322d3ee'%3EK%3C/text%3E%3C/svg%3E"><title>${htmlEscape(project.name)}</title></head><body data-runtime-adapter="${exportRuntimeAdapter(project.exportConfig.target).target}">${auth.markup}${auth.open}<main>${body}</main>${auth.close}<script type="module" src="/src/main.ts"></script></body></html>`,
    "src/main.ts": main,
    "src/style.css": `:root{font-family:Inter,system-ui,sans-serif;color:#172033;background:#f5f7fb}html[data-theme=dark]{color-scheme:dark;color:#f3f4f6;background:#0f1115}html[data-theme=dark] body{color:#f3f4f6!important;background:#0f1115!important;background-image:none!important}html[data-theme=dark] input,html[data-theme=dark] textarea,html[data-theme=dark] select,html[data-theme=dark] li{color:#f3f4f6;background:#1d2229;border-color:#4b5563}html[data-theme=dark] .generated-container{color:#f3f4f6!important;background:#171a1f!important;border-color:#374151!important}html[data-theme=dark] .app-bottom-nav{color:#f3f4f6;background:#171a1ff2;border-color:#374151}*{box-sizing:border-box}[hidden]{display:none!important}html,body{max-width:100%;overflow-x:hidden}body{margin:0;${useBottomNavigation ? "padding-bottom:calc(68px + env(safe-area-inset-bottom));" : ""}}${authenticationCss}main{position:relative;min-height:680px;width:min(680px,calc(100% - 32px));margin:48px auto;display:grid;gap:16px}.app-page-nav{display:flex;flex-wrap:wrap;gap:12px;padding:12px}.app-page-nav a{color:#5547d9}.app-bottom-nav{position:fixed;z-index:20;left:0;right:0;bottom:0;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:4px;padding:8px max(8px,env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));border-top:1px solid #cfd4df;background:#fffffff0;backdrop-filter:blur(16px)}.app-bottom-nav a{display:grid;place-items:center;min-width:0;min-height:44px;padding:8px 4px;border-radius:10px;color:inherit;text-decoration:none;font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis}.app-bottom-nav a[aria-current]{background:#6d5dfc;color:#fff}[data-route]{display:grid;gap:16px;max-width:100%;overflow:hidden}[data-route][hidden]{display:none}.generated-container{display:grid;gap:12px;max-width:100%}.generated-form{display:grid!important;gap:16px!important}.generated-form>strong{display:block;font-size:1.15rem}.generated-form>label{display:grid!important;gap:6px!important;font-weight:600}.generated-form input,.generated-form textarea,.generated-form select{width:100%;min-height:44px;padding:10px 12px;border:1px solid #4b5563;border-radius:10px;background:#111827;color:inherit}.generated-form textarea{min-height:96px;resize:vertical}.generated-form>.choice-control{display:flex!important;align-items:center;gap:10px!important}.generated-form>button{display:grid!important;place-items:center;min-height:48px;background:#16a6a1!important;color:#0f1115!important;border-radius:12px;font-weight:800}.generated-grid{display:grid!important;gap:16px!important;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}.generated-grid>strong{display:block;font-size:1.15rem}.choice-control{display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer}.choice-control input{width:20px;height:20px;min-width:20px;margin:0;padding:0;accent-color:#6d5dfc}.choice-control span{line-height:1.35}.signature-pad{display:grid;gap:8px}.signature-pad canvas{width:100%;height:140px;touch-action:none;border:1px solid #4b5563;border-radius:10px;background:#fff;color:#172033}.signature-pad button{justify-self:start}@keyframes fe-fade{from{opacity:0}to{opacity:1}}@keyframes fe-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}@keyframes fe-pulse{50%{transform:scale(1.04)}}@keyframes fe-float{50%{transform:translateY(-8px)}}${desktop}\n@media(max-width:900px){${tablet}}\n@media(max-width:600px){main{margin:20px auto}${mobile}}button,input,textarea{font:inherit;max-width:100%}button{cursor:pointer}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #8b7fff;outline-offset:2px}ul{display:grid;gap:8px;padding:0;list-style:none}li{padding:12px;background:rgba(127,127,127,.14);border:1px solid rgba(127,127,127,.28);border-radius:10px;color:inherit}.record-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.record-actions button{min-height:40px;padding:8px 12px;border:0;border-radius:9px;background:#6d5dfc;color:#fff;font-weight:700}${pageBackgroundCss(project)}`,
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
    "project.kyro.json": serializeProject(project),
    "project.frontend-editor.json": serializeProject(project),
    "README.md": `# ${project.name}\n\nRun \`npm install\`, then \`npm run dev\`. Build with \`npm run build\`. For Android, install @capacitor/cli and @capacitor/android, then run \`npx cap add android\` and \`npx cap sync\`. No secrets are included.`,
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
  return withNativeCapabilities(project, withCodeModules(project, withGeneratedBackend(project, files)));
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
