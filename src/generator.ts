import JSZip from "jszip";
import type { Breakpoint, EditorComponent, Project } from "./model";
import { parseProject, serializeProject } from "./model";
import { buildExperienceAssets } from "./PreviewFrame";
import { canContain, componentTree, type ComponentBranch } from "./hierarchy";
import { generateCodeModule } from "./codeModules";
import { nativePackagesForProject, nativePermissionsForProject } from "./nativeCapabilities";

const htmlEscape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!,
  );
const cssEscape = (value: unknown) => String(value ?? "").replace(/[{};]/g, "");

function componentHtml(component: EditorComponent, children = "") {
  const label = htmlEscape(component.props.label ?? component.name);
  const fieldName = htmlEscape(component.props.fieldName || component.id);
  const attributes = `${component.props.tooltip ? ` title="${htmlEscape(component.props.tooltip)}"` : ""}${component.props.disabled === true ? ' aria-disabled="true"' : ""}`;
  if (component.type === "input")
    return `<label>${htmlEscape(component.accessibility.label)}<input id="${component.id}" name="${fieldName}" type="${["text", "email", "number", "password", "search", "date", "time"].includes(String(component.props.inputType)) ? htmlEscape(component.props.inputType) : "text"}" placeholder="${htmlEscape(component.props.placeholder)}"${component.props.required === true ? " required" : ""} /></label>`;
  if (component.type === "button")
    return `<button id="${component.id}" type="${["button", "submit", "reset"].includes(String(component.props.buttonType)) ? htmlEscape(component.props.buttonType) : "button"}"${attributes}${component.props.disabled === true ? " disabled" : ""}>${label}</button>`;
  if (component.type === "list")
    return `<section id="${component.id}" aria-label="${htmlEscape(component.accessibility.label)}"><div class="status" role="status">Loading…</div><ul></ul></section>`;
  if (component.type === "title")
    return `<h1 id="${component.id}">${label}</h1>`;
  if (component.type === "textarea")
    return `<label>${htmlEscape(component.accessibility.label)}<textarea id="${component.id}" name="${fieldName}" placeholder="${htmlEscape(component.props.placeholder)}"${component.props.required === true ? " required" : ""}></textarea></label>`;
  if (component.type === "select")
    return `<label>${htmlEscape(component.accessibility.label)}<select id="${component.id}" name="${fieldName}">${String(component.props.options || component.props.label || component.name).split("|").map((option) => `<option>${htmlEscape(option)}</option>`).join("")}</select></label>`;
  if (component.type === "checkbox" || component.type === "radio")
    return `<label id="${component.id}" class="choice-control"${attributes}><input id="${component.id}-control" name="${fieldName}" type="${component.type}" /> <span>${label}</span></label>`;
  if (component.type === "toast")
    return `<div id="${component.id}" role="status" aria-live="polite" hidden>${label}</div>`;
  if (component.type === "image")
    return `<img id="${component.id}" src="${htmlEscape(component.props.src || "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22160%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%23e8eaf2%22/%3E%3C/svg%3E")}" alt="${htmlEscape(component.accessibility.label)}">`;
  if (component.type === "link")
    return `<a id="${component.id}" href="${htmlEscape(component.props.href || "#")}">${label}</a>`;
  if (component.type === "upload")
    return `<label>${label}<input id="${component.id}" type="file"></label>`;
  if (component.type === "signature")
    return `<label id="${component.id}" class="signature-pad">${label}<canvas data-signature-canvas role="img" aria-label="${htmlEscape(component.accessibility.label)}"></canvas><input type="hidden" name="${fieldName}"><button type="button" data-clear-signature>Clear signature</button></label>`;
  if (component.type === "progress")
    return `<label>${label}<progress id="${component.id}" max="100" value="${htmlEscape(component.props.value || 60)}"></progress></label>`;
  if (component.type === "table")
    return `<div id="${component.id}" class="table-scroll"><table><caption>${label}</caption><thead><tr><th>Name</th><th>Status</th><th>Date</th></tr></thead><tbody><tr><td>Example item</td><td>Active</td><td>Today</td></tr></tbody></table></div>`;
  if (component.type === "chart")
    return `<figure id="${component.id}" data-kind="chart"><svg viewBox="0 0 320 140" role="img" aria-label="${htmlEscape(component.accessibility.label)}"><rect x="18" y="70" width="34" height="54" rx="6"></rect><rect x="60" y="38" width="34" height="86" rx="6"></rect><rect x="102" y="52" width="34" height="72" rx="6"></rect><rect x="144" y="18" width="34" height="106" rx="6"></rect><rect x="186" y="58" width="34" height="66" rx="6"></rect><rect x="228" y="44" width="34" height="80" rx="6"></rect><rect x="270" y="30" width="34" height="94" rx="6"></rect></svg><figcaption>${label}</figcaption></figure>`;
  if (component.type === "calendar")
    return `<section id="${component.id}" data-kind="calendar"><label>${label}<input id="${component.id}-control" type="date"></label><ul aria-live="polite"></ul></section>`;
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
    return `<details id="${component.id}"><summary>${label}</summary>${children || `<p>${htmlEscape(component.props.description || "Expandable content")}</p>`}</details>`;
  if (canContain(component)) {
    const ownContent = `${label ? `<strong>${label}</strong>` : ""}${component.props.description ? `<p>${htmlEscape(component.props.description)}</p>` : ""}`;
    const content = `${ownContent}${children}`;
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
    "project.kyro.json": serializeProject(project),
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
    `# Android\n\nTarget: Capacitor 8 / Android API 24+.\n\nKyro can prepare the native folder automatically. Manual path: npm install, npm run build, npm run android:add, npm run android:sync. Open it with npm run android:open. Release signing intentionally remains external.\n\nOrientation: ${android.orientation}. Required permissions: ${android.permissions.join(", ") || "none"}. Version: ${android.versionName} (${android.versionCode}).`;
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
    runtime: `let authToken = sessionStorage.getItem('frontend-editor-session') || ''
const authGate = document.getElementById('auth-gate')!, protectedApp = document.getElementById('protected-app')!, authForm = authGate.querySelector('form') as HTMLFormElement, authError = authGate.querySelector('[role="alert"]') as HTMLElement
const showApp = () => { authGate.hidden = true; protectedApp.hidden = false }
if (authToken) showApp()
const authenticate = async (path: string): Promise<void> => { if (!authForm.reportValidity()) return; const input = Object.fromEntries(new FormData(authForm)), response = await fetch(${JSON.stringify(base)} + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }); const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Access failed'); if (path === '/auth/register') return authenticate('/auth/login'); authToken = value.token; sessionStorage.setItem('frontend-editor-session', authToken); showApp(); location.reload() }
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
async function insert(value: unknown): Promise<void> { const fields = value && typeof value === 'object' ? value : { text: String(value) }; const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(authToken ? { authorization: 'Bearer ' + authToken } : {}) }, body: JSON.stringify(fields) }); if (!response.ok) throw new Error('Save failed (' + response.status + ')') }
async function update(value: unknown) { const item = value as Record<string, unknown>; const response = await fetch(endpoint + '/' + encodeURIComponent(String(item.id ?? '')), { method: 'PUT', headers: { 'content-type': 'application/json', ...(authToken ? { authorization: 'Bearer ' + authToken } : {}) }, body: JSON.stringify(item) }); if (!response.ok) throw new Error('Aggiornamento non riuscito (' + response.status + ')'); return response.json() }
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
${project.flows.length ? generatedFlowRuntime(project) : ""}
${project.appConfig.realtime.mode === "sse" ? `const updates = new EventSource(${JSON.stringify(project.appConfig.realtime.url)}); updates.addEventListener('records', () => void window.dashboardData.query().then((records) => dispatchEvent(new MessageEvent('message', { data: { channel: 'frontend-editor-host', records } }))))` : ""}
`;
  const ui =
    experience === "landing"
      ? `export {};const deliver=(detail)=>dispatchEvent(new MessageEvent('message',{data:{channel:'frontend-editor-host',...detail}}));const send=async(type,payload={})=>{try{if(type==='READY')deliver({records:await window.siteData.query()});if(type==='ADD'){await window.siteData.insert(payload.value);deliver({records:await window.siteData.query(),action:'add'})}}catch(error){deliver({records:await window.siteData.query(),error:error instanceof Error?error.message:String(error)})}};${assets.script}`
      : `export {};const deliver=(detail)=>dispatchEvent(new MessageEvent('message',{data:{channel:'frontend-editor-host',...detail}}));const send=async(type,payload={})=>{try{if(type==='READY')deliver({records:await window.dashboardData.query()});if(type==='DASHBOARD_ACTION')deliver({records:await window.dashboardData.action(payload.action,payload.payload),action:payload.action})}catch(error){deliver({records:await window.dashboardData.query(),error:error instanceof Error?error.message:String(error)})}};${assets.script}`;
  return {
    ...commonExportFiles(project),
    "index.html": `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%230f172a'/%3E%3Ctext x='50' y='70' text-anchor='middle' font-size='64' fill='%2322d3ee'%3EK%3C/text%3E%3C/svg%3E"><title>${htmlEscape(project.name)}</title></head><body>${auth.markup}${auth.open}${assets.markup}${auth.close}<script type="module" src="/src/main.ts"></script></body></html>`,
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
const readOnlyRoles = new Set(['viewer'])
const canWrite = (role) => role === 'admin' || (allowedRoles.includes(role) && !readOnlyRoles.has(role))
const authSecret = process.env.AUTH_SECRET || ''
if (authEnabled && !authSecret) throw new Error('AUTH_SECRET is required: copy .env.example and configure a secure value')
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
    if (url.pathname === '/auth/register' && request.method === 'POST') { const users = await readUsers(); if (users.length) { response.writeHead(409); return response.end(JSON.stringify({ error: 'The first account already exists' })) } const input = await body(request); if (!/^\\S+@\\S+\\.\\S+$/.test(input.email) || String(input.password || '').length < 8) { response.writeHead(400); return response.end(JSON.stringify({ error: 'A valid email and a password of at least 8 characters are required' })) } const salt = randomBytes(16).toString('hex'), hash = scryptSync(input.password, salt, 64).toString('hex'), user = { id: crypto.randomUUID(), email: input.email.toLowerCase(), salt, hash, role: allowedRoles.includes('admin') ? 'admin' : allowedRoles[0] || 'viewer' }; users.push(user); await saveUsers(users); response.writeHead(201); return response.end(JSON.stringify({ id: user.id, email: user.email, role: user.role })) }
    if (url.pathname === '/auth/login' && request.method === 'POST') { const input = await body(request), user = (await readUsers()).find((item) => item.email === String(input.email || '').toLowerCase()); if (!user) { response.writeHead(401); return response.end(JSON.stringify({ error: 'Invalid credentials' })) } const actual = scryptSync(String(input.password || ''), user.salt, 64), expected = Buffer.from(user.hash, 'hex'); if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) { response.writeHead(401); return response.end(JSON.stringify({ error: 'Invalid credentials' })) } return response.end(JSON.stringify({ token: sign(user), role: user.role })) }
    const current = session(request)
    if (authEnabled && !current) { response.writeHead(401); return response.end(JSON.stringify({ error: 'Accedi per continuare' })) }
    const records = await read(), id = url.pathname.split('/')[2]
    if (url.pathname === '/records' && request.method === 'GET') return response.end(JSON.stringify(records))
    if (url.pathname === '/records' && request.method === 'POST') { if (!canWrite(current.role)) { response.writeHead(403); return response.end(JSON.stringify({ error: 'This role has read-only access' })) } const input = await body(request), record = { ...input, id: crypto.randomUUID(), date: new Date().toISOString() }; records.push(record); await save(records); broadcast(); response.writeHead(201); return response.end(JSON.stringify(record)) }
    const index = records.findIndex((record) => record.id === id)
    if (index < 0) { response.writeHead(404); return response.end(JSON.stringify({ error: 'Record non trovato' })) }
    if (request.method === 'PUT') { if (!canWrite(current.role)) { response.writeHead(403); return response.end(JSON.stringify({ error: 'This role has read-only access' })) } records[index] = { ...records[index], ...(await body(request)), id }; await save(records); broadcast(); return response.end(JSON.stringify(records[index])) }
    if (request.method === 'DELETE') { if (current.role !== 'admin') { response.writeHead(403); return response.end(JSON.stringify({ error: 'Only an administrator can delete records' })) } records.splice(index, 1); await save(records); broadcast(); response.writeHead(204); return response.end() }
    response.writeHead(404); response.end(JSON.stringify({ error: 'Percorso non trovato' }))
  } catch (error) { response.writeHead(500); response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })) }
}).listen(8787, '127.0.0.1', () => console.log('Backend pronto su http://127.0.0.1:8787'))
`;
  files["README-BACKEND.md"] =
    `# Generated backend\n\nRun \`npm run server\`, then \`npm run dev\` in another process. Records are stored in \`server/data.json\`. The API listens only on 127.0.0.1:8787 and accepts GET/POST/PUT/DELETE on /records.${project.appConfig.authentication.mode === "generated" ? " Access is protected: configure AUTH_SECRET before starting; the first registration creates the administrator." : " Configure authentication and an allowed origin before public deployment."}`;
  return files;
}

export function generateFiles(input: Project): Record<string, string> {
  const project = parseProject(input);
  const page = project.pages[0];
  if (!page) throw new Error("Add at least one page before exporting");
  if (
    project.appConfig.authentication.mode === "generated" &&
    !project.dataSources.some((source) => source.provider === "generated")
  )
    throw new Error(
      "Il login richiede il backend: apri Dati e scegli Genera anche il backend",
    );
  const standaloneDashboard = project.state.experience === "dashboard" && project.pages.length === 1 && page.components.some((component) => component.props.slot === "sidebar" || component.props.slot === "dashboard-title");
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
  const navigationPaths = new Set(navigationItems.map((item) => item.path));
  const remainingNavigation = configuredNavigation?.enabled
    ? project.pages.filter((page) => !page.path.includes(":") && !navigationPaths.has(page.path)).map((page) => ({ label: page.name, path: page.path }))
    : [];
  const navigationOverflow = useBottomNavigation && navigationItems.length > 5
    ? [...navigationItems.slice(4), ...remainingNavigation]
    : remainingNavigation;
  const primaryNavigation = navigationOverflow.length ? navigationItems.slice(0, 4) : navigationItems;
  const navigationLink = (item: { label: string; path: string }) => `<a href="#${htmlEscape(item.path)}">${htmlEscape(item.label)}</a>`;
  const navigationMore = navigationOverflow.length ? `<style>.app-nav-more{position:relative;display:grid}.app-nav-more summary{display:grid;place-items:center;min-height:44px;padding:8px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;list-style:none}.app-nav-more summary::-webkit-details-marker{display:none}.app-nav-more summary[aria-current]{background:#6d5dfc;color:#fff}.app-nav-more>div{position:absolute;right:0;bottom:calc(100% + 8px);z-index:30;display:grid;min-width:180px;gap:4px;padding:8px;border:1px solid #cfd4df;border-radius:12px;background:#171a1f;color:#fff;box-shadow:0 16px 40px #0005}.app-nav-more>div a{justify-content:start}</style><details class="app-nav-more"><summary>More</summary><div role="menu">${navigationOverflow.map(navigationLink).join("")}</div></details>` : "";
  const body = `<nav class="${navigationClass}" aria-label="Pages">${primaryNavigation.map(navigationLink).join("")}${navigationMore}</nav>${project.pages.map((item) => `<section data-route="${htmlEscape(item.path)}">${componentTree(item.components).map(branchHtml).join("\n")}</section>`).join("")}`;
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
async function request(path = '', init?: RequestInit) { const response = await fetch(endpoint + path, { ...init, headers: { 'content-type': 'application/json', ...(authToken ? { authorization: 'Bearer ' + authToken } : {}), ...init?.headers } }); if (!response.ok) throw new Error('API non disponibile (' + response.status + ')'); return response.status === 204 ? undefined : response.json() }
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
const graphSources: SourceConfig[] = ${JSON.stringify(project.dataSources.map(({ id, provider, endpoint }) => ({ id, provider, ...(endpoint ? { endpoint } : {}) })))}
const sourceConfig = (selectedSourceId = sourceId) => { const source = graphSources.find((item) => item.id === selectedSourceId); if (!source) throw new Error('Data source not found: ' + selectedSourceId); return source }
const openDb = () => new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('frontend-editor-export', 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records', { keyPath: 'id' }).createIndex('sourceId', 'sourceId') }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
async function sourceRequest(source: SourceConfig, path = '', init?: RequestInit) { if (!source.endpoint) throw new Error('Endpoint non configurato per ' + source.id); const response = await fetch(source.endpoint + path, { ...init, headers: { 'content-type': 'application/json', ...(authToken ? { authorization: 'Bearer ' + authToken } : {}), ...init?.headers } }); if (!response.ok) throw new Error('API non disponibile (' + response.status + ')'); return response.status === 204 ? undefined : response.json() }
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
const fillForm = (form: HTMLFormElement, item: Item) => { Object.entries(item as Record<string, unknown>).forEach(([name, value]) => { const field = form.elements.namedItem(name) as HTMLInputElement | null; if (!field) return; if (field.type === 'checkbox') field.checked = Boolean(value); else field.value = String(value ?? '') }); form.dataset.editingId = item.id; form.dataset.sourceId = item.sourceId }
async function saveEdit(form: HTMLFormElement) { if (!form.checkValidity()) return form.reportValidity(); const id = form.dataset.editingId, selectedSourceId = form.dataset.sourceId; if (!id || !selectedSourceId) return; const previous = (await query(selectedSourceId)).find((item) => item.id === id); if (!previous) throw new Error('Item to edit was not found'); const fields: Record<string, unknown> = Object.fromEntries(new FormData(form)); form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((field) => fields[field.name] = field.checked); await update({ ...previous, ...fields, id, sourceId: selectedSourceId, text: String(fields.title ?? fields.name ?? previous.text) }, selectedSourceId); delete form.dataset.editingId; delete form.dataset.sourceId; form.reset(); await refreshRoute(form) }
const makeRow = (item: Item, binding: DataBinding, root: HTMLElement, state: HTMLElement) => { const row = document.createElement('li'), title = document.createElement('strong'), description = document.createElement('p'), actions = document.createElement('div'); row.dataset.id = item.id; title.textContent = item.text; description.textContent = String((item as Record<string, unknown>).description ?? (item as Record<string, unknown>).frequency ?? ''); actions.className = 'record-actions'; if (binding.editable) { const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Edit'; edit.addEventListener('click', () => { const form = root.closest('[data-route]')?.querySelector<HTMLFormElement>('form'); if (form) { fillForm(form, item); form.scrollIntoView({ behavior: 'smooth', block: 'start' }) } }); actions.append(edit) } if (binding.completion !== 'none') { const record = item as Record<string, unknown>, done = binding.completion === 'streak' ? Boolean(record.completedToday) : Boolean(record.completed) || record.status === 'Completed'; const complete = document.createElement('button'); complete.type = 'button'; complete.textContent = done ? 'Completed' : 'Complete'; complete.disabled = done; complete.addEventListener('click', async () => { const streak = Number(record.currentStreak) || 0, value = binding.completion === 'streak' ? { ...item, completedToday: true, currentStreak: streak + 1, bestStreak: Math.max(Number(record.bestStreak)||0,streak+1), lastCompletedAt:new Date().toISOString() } : { ...item, completed:true, status:'Completed' }; if (binding.updateFlowId) await runGraph(binding.updateFlowId, value); else await update(value,binding.sourceId); await refresh(binding.componentId) }); actions.append(complete) } if (binding.removable) { const removeButton = document.createElement('button'); removeButton.type = 'button'; removeButton.textContent = 'Delete'; removeButton.addEventListener('click', async () => { if (!confirm('Delete ' + item.text + '?')) return; lastDeleted = { item, sourceId: binding.sourceId, componentId: binding.componentId }; if (binding.deleteFlowId) await runGraph(binding.deleteFlowId,item); else await remove(item,binding.sourceId); await refresh(binding.componentId); const undo=document.createElement('button'); undo.type='button'; undo.textContent='Undo'; undo.addEventListener('click',async()=>{if(!lastDeleted)return;await insert(lastDeleted.item,lastDeleted.sourceId);const target=lastDeleted.componentId;lastDeleted=undefined;await refresh(target)}); state.replaceChildren(document.createTextNode('Item deleted. '),undo) }); actions.append(removeButton) } row.append(title, description); if (actions.childElementCount) row.append(actions); return row }
const itemDate = (item: Item) => String((item as Record<string, unknown>).dueDate ?? item.date ?? (item as Record<string, unknown>).lastCompletedAt ?? '').slice(0, 10)
const itemDone = (item: Item) => { const value = item as Record<string, unknown>; return Boolean(value.completed || value.completedToday) || /complet/i.test(String(value.status ?? '')) }
const renderBoundData = (binding: DataBinding, root: HTMLElement, items: Item[]) => { if (binding.kind === 'chart') { const today = new Date(), days = Array.from({ length: 7 }, (_, index) => { const day = new Date(today); day.setDate(today.getDate() - 6 + index); return day.toISOString().slice(0, 10) }), values = days.map((day) => items.filter((item) => itemDate(item) === day && (binding.metric !== 'completed' || itemDone(item))).length), max = Math.max(1, ...values); root.querySelectorAll('rect').forEach((bar, index) => { const height = Math.max(4, Math.round((values[index] || 0) / max * 106)); bar.setAttribute('y', String(124 - height)); bar.setAttribute('height', String(height)) }); root.querySelector('svg')?.setAttribute('aria-label', 'Last seven days: ' + values.join(', ')); const caption = root.querySelector<HTMLElement>('figcaption'); if (caption) { const label = caption.dataset.label || caption.textContent || 'Chart'; caption.dataset.label = label.split(' · ')[0]; caption.textContent = caption.dataset.label + ' · ' + values.reduce((sum, value) => sum + value, 0) + ' total' } return } if (binding.kind === 'calendar') { const input = root.querySelector<HTMLInputElement>('input[type="date"]'), list = root.querySelector<HTMLUListElement>('ul'); if (!input || !list) return; if (!input.value) input.value = new Date().toISOString().slice(0, 10); const renderDay = () => { const shown = items.filter((item) => itemDate(item) === input.value); list.replaceChildren(...(shown.length ? shown.map((item) => { const row = document.createElement('li'), value = item as Record<string, unknown>; row.textContent = String(value.title ?? value.name ?? item.text) + (value.time ? ' · ' + String(value.time) : ''); return row }) : [Object.assign(document.createElement('li'), { textContent: 'No items on this date' })])) }; renderDay(); if (!input.dataset.bound) { input.dataset.bound = 'true'; input.addEventListener('change', renderDay) } return } if (binding.metric) { const values = items.map((item) => item as Record<string, unknown>), number = binding.metric === 'completed' ? items.filter(itemDone).length : binding.metric === 'active' ? items.filter((item) => !itemDone(item)).length : binding.metric === 'maxStreak' ? Math.max(0, ...values.map((item) => Number(item.bestStreak ?? item.currentStreak) || 0)) : items.length, target = root.querySelector<HTMLElement>('strong') ?? root; target.textContent = String(number) + (binding.suffix ? ' ' + binding.suffix : '') } }
async function refresh(componentId = '') {
  const targets: DataBinding[] = componentId ? dataBindings.filter((binding) => binding.componentId === componentId) : dataBindings.length ? dataBindings : [{ componentId: ${JSON.stringify(list?.id ?? "")}, sourceId, kind: 'list', metric: '', suffix: '', updateFlowId: '', deleteFlowId: '', completion: 'none', editable: false, removable: false }]
  await Promise.all(targets.map(async (binding) => { const root = document.getElementById(binding.componentId); if (!root) return; const state = root.querySelector<HTMLElement>('.status'), list = binding.kind === 'list' ? root.querySelector<HTMLUListElement>('ul') : null; if (state) state.textContent = 'Loading…'; try { const route = root.closest('[data-route]'), search = route?.querySelector<HTMLInputElement>('[name="search"]')?.value.trim().toLowerCase() ?? '', filter = route?.querySelector<HTMLSelectElement>('[name="filter"]')?.value ?? '', direction = sortDirection.get(binding.componentId) ?? -1; const items = (await query(binding.sourceId)).filter((item) => !search || Object.values(item).some((value) => String(value ?? '').toLowerCase().includes(search))).filter((item) => !filter || /^(tutti|all)/i.test(filter) || String((item as Record<string, unknown>).status ?? '') === filter).sort((a, b) => String(a.date).localeCompare(String(b.date)) * direction); if (list && state) { list.replaceChildren(...items.map((item) => makeRow(item, binding, root, state))); state.textContent = items.length ? '' : 'No items yet. Add one to get started.' } else renderBoundData(binding, root, items) } catch (error) { if (state) state.textContent = 'Error: ' + (error instanceof Error ? error.message : String(error)); else graphNotify('Data error: ' + (error instanceof Error ? error.message : String(error)), true) } }))
}
document.querySelectorAll<HTMLInputElement>('[name="search"], [name="filter"]').forEach((control) => control.addEventListener(control.name === 'search' ? 'input' : 'change', () => void refreshRoute(control)))
document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { if (!/(ordina|sort)/i.test(button.textContent ?? '')) return; button.addEventListener('click', () => { routeBindings(button).forEach((binding) => sortDirection.set(binding.componentId, -(sortDirection.get(binding.componentId) ?? -1))); void refreshRoute(button) }) })
document.addEventListener('click', (event) => { const button = (event.target as Element).closest<HTMLButtonElement>('button[type="submit"]'), form = button?.form; if (!form?.dataset.editingId) return; event.preventDefault(); event.stopImmediatePropagation(); void saveEdit(form).catch((error) => { const state = form.closest('[data-route]')?.querySelector<HTMLElement>('.status'); if (state) state.textContent = 'Error: ' + (error instanceof Error ? error.message : String(error)) }) }, true)
function route() { const path = decodeURIComponent(location.hash.slice(1) || ${JSON.stringify(project.pages[0].path)}); document.querySelectorAll<HTMLElement>('[data-route]').forEach((section) => { section.hidden = section.dataset.route !== path }); document.querySelectorAll<HTMLAnchorElement>('nav a').forEach((link) => link.toggleAttribute('aria-current', link.hash === '#' + path)); const more = document.querySelector<HTMLDetailsElement>('.app-nav-more'), active = more?.querySelector('a[aria-current]'); more?.querySelector('summary')?.toggleAttribute('aria-current', Boolean(active)); if (active) more?.removeAttribute('open') }
addEventListener('hashchange', route); addEventListener('hashchange', () => { const path = decodeURIComponent(location.hash.slice(1)); void Promise.all(dataBindings.filter((binding) => document.getElementById(binding.componentId)?.closest<HTMLElement>('[data-route]')?.dataset.route === path).map((binding) => refresh(binding.componentId))) }); route()
${project.flows.length ? generatedFlowRuntime(project) : `const graphNotify = (message: string, error = false) => { let toast = document.querySelector<HTMLElement>('[data-flow-status]'); if (!toast) { toast = document.createElement('div'); toast.dataset.flowStatus = ''; toast.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;padding:12px 16px;border-radius:10px;background:#172033;color:white'; document.body.append(toast) } toast.setAttribute('role', error ? 'alert' : 'status'); toast.style.background = error ? '#b42318' : '#172033'; toast.textContent = message; toast.hidden = false; window.setTimeout(() => { if (toast) toast.hidden = true }, 2600) }
document.getElementById('${button?.id ?? ""}')?.addEventListener('click', async () => {
  const input = document.getElementById('${inputComponent?.id ?? ""}') as HTMLInputElement | null
  if (!input?.value.trim()) { input?.setAttribute('aria-invalid', 'true'); status!.textContent = 'A value is required'; return }
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
    "index.html": `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%230f172a'/%3E%3Ctext x='50' y='70' text-anchor='middle' font-size='64' fill='%2322d3ee'%3EK%3C/text%3E%3C/svg%3E"><title>${htmlEscape(project.name)}</title></head><body>${auth.markup}${auth.open}<main>${body}</main>${auth.close}<script type="module" src="/src/main.ts"></script></body></html>`,
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

function withNativeCapabilities(project: Project, files: Record<string, string>) {
  if (!usesNativeRuntime(project)) return files;
  const requested = new Set(project.flows.flatMap((flow) => flow.nodes.filter((node) => node.type === "requestPermission").map((node) => node.config.permission)));
  const packages: Record<string, string> = { "@capacitor/core": "^8.0.0", ...nativePackagesForProject(project) };
  if (project.flows.some((flow) => flow.nodes.some((node) => node.type === "platformCondition"))) packages["@capacitor/device"] = "^8.0.0";
  if (requested.has("camera")) packages["@capacitor/camera"] = "^8.0.0";
  if (requested.has("geolocation")) packages["@capacitor/geolocation"] = "^8.0.0";
  if (requested.has("notifications")) packages["@capacitor/local-notifications"] = "^8.0.0";
  const pkg = JSON.parse(files["package.json"]) as { dependencies?: Record<string, string> };
  pkg.dependencies = { ...pkg.dependencies, ...packages };
  files["package.json"] = JSON.stringify(pkg, null, 2);
  const has = (name: string) => Boolean(packages[name]);
  const imports = [
    "import { Capacitor } from '@capacitor/core'",
    has("@capacitor/camera") ? "import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'" : "",
    has("@capacitor/geolocation") ? "import { Geolocation } from '@capacitor/geolocation'" : "",
    has("@capacitor/device") ? "import { Device } from '@capacitor/device'" : "",
    has("@capacitor/network") ? "import { Network } from '@capacitor/network'" : "",
    has("@capacitor/haptics") ? "import { Haptics, ImpactStyle } from '@capacitor/haptics'" : "",
    has("@capacitor/share") ? "import { Share } from '@capacitor/share'" : "",
    has("@capacitor/clipboard") ? "import { Clipboard } from '@capacitor/clipboard'" : "",
    has("@capacitor/filesystem") ? "import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'" : "",
    has("@capacitor/motion") ? "import { Motion } from '@capacitor/motion'" : "",
    has("@capacitor/local-notifications") ? "import { LocalNotifications } from '@capacitor/local-notifications'" : "",
    has("@capacitor/push-notifications") ? "import { PushNotifications } from '@capacitor/push-notifications'" : "",
    has("@capacitor-community/bluetooth-le") ? "import { BleClient } from '@capacitor-community/bluetooth-le'" : "",
    has("@capacitor-mlkit/barcode-scanning") ? "import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning'" : "",
  ].filter(Boolean).join("\n");
  files["src/native.ts"] = `${imports}
type Options = Record<string, string>
const parseOptions = (text = ''): Options => Object.fromEntries(text.split(/\\r?\\n|,/).map((line) => line.split('=')).filter((pair) => pair.length > 1).map(([key, ...rest]) => [key.trim(), rest.join('=').trim()]))
const webInfo = () => ({ platform: 'web', version: navigator.userAgent })
export async function getPlatformInfo() { ${has("@capacitor/device") ? "if (Capacitor.isNativePlatform()) { const info = await Device.getInfo(); return { platform: info.platform, version: info.osVersion } }" : ""} return webInfo() }
export async function requestNativePermission(permission: string, _rationale = '') { if (!Capacitor.isNativePlatform()) { if (permission === 'notifications' && 'Notification' in window) return (Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission) === 'granted'; if (permission === 'geolocation' && navigator.permissions) return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted'; return false }
  ${has("@capacitor/camera") ? "if (permission === 'camera') return (await Camera.requestPermissions({ permissions: ['camera', 'photos'] })).camera === 'granted'" : ""}
  ${has("@capacitor-mlkit/barcode-scanning") ? "if (permission === 'camera') return (await BarcodeScanner.requestPermissions()).camera === 'granted'" : ""}
  ${has("@capacitor/geolocation") ? "if (permission === 'geolocation') return (await Geolocation.requestPermissions()).location === 'granted'" : ""}
  ${has("@capacitor/local-notifications") ? "if (permission === 'notifications') return (await LocalNotifications.requestPermissions()).display === 'granted'" : ""}
  return false }
export async function runNativeAction(capability: string, action: string, value: unknown, raw: Options) { const options = { ...raw, ...parseOptions(raw.options) }
  ${has("@capacitor/camera") ? "if (capability === 'camera') { const photo = await Camera.getPhoto({ resultType: CameraResultType.Uri, source: action === 'takePhoto' ? CameraSource.Camera : CameraSource.Photos, quality: Math.min(100, Math.max(1, Number(options.quality) || 85)) }); return { path: photo.path, webPath: photo.webPath, format: photo.format, saved: photo.saved } }" : ""}
  ${has("@capacitor/geolocation") ? "if (capability === 'location' && action === 'getCurrentPosition') { const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: options.highAccuracy === 'true', timeout: 10000 }); return { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy } }" : ""}
  ${has("@capacitor/device") ? "if (capability === 'device' && action === 'getInfo') return Device.getInfo(); if (capability === 'device' && action === 'getBattery') return Device.getBatteryInfo()" : ""}
  ${has("@capacitor/network") ? "if (capability === 'network' && action === 'getStatus') return Network.getStatus()" : ""}
  ${has("@capacitor/haptics") ? "if (capability === 'haptics') { if (action === 'vibrate') await Haptics.vibrate({ duration: Math.min(1000, Math.max(20, Number(options.duration) || 100)) }); else await Haptics.impact({ style: options.style === 'heavy' ? ImpactStyle.Heavy : options.style === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }); return value }" : ""}
  ${has("@capacitor/share") ? "if (capability === 'share' && action === 'share') return Share.share({ title: options.title, text: options.text || String(value || ''), url: options.url || undefined })" : ""}
  ${has("@capacitor/clipboard") ? "if (capability === 'clipboard' && action === 'write') { await Clipboard.write({ string: options.value || String(value || '') }); return value } if (capability === 'clipboard' && action === 'read') return Clipboard.read()" : ""}
  ${has("@capacitor/filesystem") ? "if (capability === 'files' && action === 'writeFile') return Filesystem.writeFile({ path: options.path || 'file.txt', data: options.data || String(value || ''), directory: Directory.Data, encoding: Encoding.UTF8 }); if (capability === 'files' && action === 'readFile') return Filesystem.readFile({ path: options.path || 'file.txt', directory: Directory.Data, encoding: Encoding.UTF8 }); if (capability === 'files' && action === 'deleteFile') return Filesystem.deleteFile({ path: options.path || 'file.txt', directory: Directory.Data })" : ""}
  ${has("@capacitor/push-notifications") ? "if (capability === 'push' && action === 'register') { const permission = await PushNotifications.requestPermissions(); if (permission.receive !== 'granted') throw new Error('Push notification permission was denied'); await PushNotifications.register(); return { registered: true } }" : ""}
  ${has("@capacitor-community/bluetooth-le") ? "if (capability === 'bluetooth') { await BleClient.initialize(); if (action === 'requestDevice') return BleClient.requestDevice({ optionalServices: (options.services || '').split(',').filter(Boolean) }); if (action === 'scan') { const devices: unknown[] = []; await BleClient.requestLEScan({}, (result) => devices.push(result)); await new Promise((resolve) => setTimeout(resolve, Math.min(10000, Number(options.duration) || 3000))); await BleClient.stopLEScan(); return devices } if (action === 'connect') return BleClient.connect(String(options.deviceId || (value as { deviceId?: string })?.deviceId || '')); if (action === 'disconnect') return BleClient.disconnect(String(options.deviceId || (value as { deviceId?: string })?.deviceId || '')) }" : ""}
  ${has("@capacitor-mlkit/barcode-scanning") ? "if (capability === 'barcode') { const result = await BarcodeScanner.scan(action === 'scanQr' ? { formats: [BarcodeFormat.QrCode], autoZoom: true } : { autoZoom: true }); const barcode = result.barcodes[0]; if (!barcode) throw new Error('No QR code or barcode was detected'); return barcode }" : ""}
  if (capability === 'location' && action === 'openMap') { const input = value as { latitude?: number; longitude?: number }; location.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(String(options.latitude || input?.latitude || '') + ',' + String(options.longitude || input?.longitude || '')); return value }
  throw new Error('This device action is not available in the current target: ' + capability + '.' + action)
}
`;
  if (has("@capacitor-mlkit/barcode-scanning")) files["scripts/configure-android.mjs"] += `
manifest = await readFile(manifestPath, 'utf8')
const barcodeMetadata = '<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />'
if (!manifest.includes(barcodeMetadata)) manifest = manifest.replace('</application>', '    ' + barcodeMetadata + '\\n    </application>')
await writeFile(manifestPath, manifest)
`;
  return files;
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
  const extensions = referencedModules(project).map((module, index) => `import { run as runExtension${index} } from './extensions/${moduleFile(module.id)}'`);
  if (usesNativeRuntime(project)) extensions.push("import { getPlatformInfo, requestNativePermission, runNativeAction } from './native'");
  return extensions.join("\n");
}

const usesNativeRuntime = (project: Project) => project.flows.some((flow) => flow.nodes.some((node) => ["requestPermission", "nativeAction", "platformCondition"].includes(node.type)));

function modulePipeline(project: Project, initial: string) {
  return referencedModules(project).reduce((value, _module, index) => `runExtension${index}(${value} as never)`, initial);
}

function generatedFlowRuntime(project: Project) {
  const runners = referencedModules(project).map((module, index) => `${JSON.stringify(module.id)}: runExtension${index}`).join(",");
  const bindings = project.pages.flatMap((page) => page.components.flatMap((component) => Object.entries(component.events).map(([event, flowId]) => ({ componentId: component.id, event, flowId }))));
  const automatic = project.flows.flatMap((flow) => flow.nodes.filter((node) => node.type === "event" && ["pageLoad", "timer", "pageVisible", "pageHidden", "online", "offline", "deviceShake", "deepLink"].includes(node.config.trigger)).map((node) => ({ flowId: flow.id, trigger: node.config.trigger, interval: Math.min(3600000, Math.max(500, Number(node.config.interval) || 5000)), pagePath: project.pages.find((page) => page.id === node.config.pageId)?.path })));
  const nativeFallback = usesNativeRuntime(project) ? "" : `const requestNativePermission = async (_permission: string, _rationale = '') => false
const getPlatformInfo = async () => ({ platform: 'web', version: navigator.userAgent })
const runNativeAction = async (capability: string, action: string, _value: unknown, _config: Record<string, string>): Promise<never> => { throw new Error('Device action is not available: ' + capability + '.' + action) }`;
  return `type GraphNode = { id: string; type: string; label: string; position: { x: number; y: number }; config: Record<string, string> }
type GraphFlow = { id: string; name: string; nodes: GraphNode[]; edges: { id: string; source: string; target: string; path: string }[] }
const graphFlows: GraphFlow[] = ${JSON.stringify(project.flows)}
const graphState: Record<string, unknown> = ${JSON.stringify(project.state)}
const graphDebounce = new Map<string, number>()
const extensionRunners: Record<string, (value: never) => unknown> = { ${runners} }
${nativeFallback}
const graphField = (value: unknown, key = '') => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
const graphElement = (id = '') => document.getElementById(id) ?? document.querySelector<HTMLElement>('[data-component="' + CSS.escape(id) + '"]')
const graphListen = (element: HTMLElement | null, name: string, run: (event: Event) => void) => { if (!element) return; const native: Record<string, string> = { doubleClick: 'dblclick', pointerEnter: 'pointerenter', pointerLeave: 'pointerleave', keyDown: 'keydown' }; if (native[name]) return element.addEventListener(native[name], run); if (name === 'longPress') { let timer = 0, start: { x: number; y: number; time: number } | undefined; const cancel = () => { clearTimeout(timer); timer = 0 }; element.addEventListener('pointerdown', (event) => { start = { x: event.clientX, y: event.clientY, time: Date.now() }; timer = window.setTimeout(() => start && run(new CustomEvent('longPress', { detail: { kyroGesture: true, x: start.x, y: start.y, duration: Date.now() - start.time } })), 600) }); element.addEventListener('pointerup', cancel); element.addEventListener('pointercancel', cancel); element.addEventListener('pointerleave', cancel); return } if (name === 'swipeLeft' || name === 'swipeRight') { let start: { x: number; y: number; time: number } | undefined; element.addEventListener('pointerdown', (event) => { start = { x: event.clientX, y: event.clientY, time: Date.now() } }); element.addEventListener('pointerup', (event) => { if (!start) return; const dx = event.clientX - start.x, dy = event.clientY - start.y, duration = Math.max(1, Date.now() - start.time), matches = Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) && (name === 'swipeLeft' ? dx < 0 : dx > 0); if (matches) run(new CustomEvent(name, { detail: { kyroGesture: true, distanceX: dx, distanceY: dy, duration, velocity: dx / duration } })); start = undefined }); return } element.addEventListener(name, run) }
const graphMatches = (value: unknown, key = '', operator = 'equals', expected = '') => { const actual = key ? graphField(value, key) : value; if (operator === 'exists') return actual !== undefined && actual !== null && actual !== ''; if (operator === 'notEquals') return String(actual) !== expected; if (operator === 'contains') return String(actual).toLowerCase().includes(expected.toLowerCase()); if (operator === 'greater') return Number(actual) > Number(expected); if (operator === 'less') return Number(actual) < Number(expected); return String(actual) === expected }
const graphPlatformMatches = (info: { platform: string; version: string }, platform = '', minimum = '', maximum = '') => { if (platform && info.platform.toLowerCase() !== platform.toLowerCase()) return false; const current = Number.parseInt(info.version, 10), min = minimum ? Number.parseInt(minimum, 10) : undefined, max = maximum ? Number.parseInt(maximum, 10) : undefined; return !(min !== undefined && (!Number.isFinite(current) || current < min)) && !(max !== undefined && (!Number.isFinite(current) || current > max)) }
const graphNavigate = (mode = 'page', path = '/') => { if (mode === 'back') return history.back(); if (mode === 'url') { const url = new URL(path); if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Usa un indirizzo HTTP o HTTPS'); return location.assign(url.toString()) } location.hash = path }
const graphRole = () => { try { const payload = authToken.split('.')[0]; return String(JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/'))).role || 'viewer') } catch { return 'viewer' } }
const graphSignOut = () => { authToken = ''; sessionStorage.removeItem('frontend-editor-session'); location.reload() }
const graphNotify = (message: string, error = false) => { let toast = document.querySelector<HTMLElement>('[data-flow-status]'); if (!toast) { toast = document.createElement('div'); toast.dataset.flowStatus = ''; const bottom = document.querySelector('.app-bottom-nav') ? 'calc(76px + env(safe-area-inset-bottom))' : '16px'; toast.style.cssText = 'position:fixed;right:16px;bottom:' + bottom + ';z-index:9999;padding:12px 16px;border-radius:10px;background:#172033;color:white;box-shadow:0 12px 30px #0004'; document.body.append(toast) } toast.setAttribute('role', error ? 'alert' : 'status'); toast.style.background = error ? '#b42318' : '#172033'; toast.textContent = message; toast.hidden = false; window.setTimeout(() => { if (toast) toast.hidden = true }, 2600) }
const graphScheduleLocalNotification = async (title = 'Reminder', body = '', delayMs = '0') => { const delay = Math.min(604800000, Math.max(0, Number(delayMs) || 0)), native = (window as typeof window & { frontendEditorLocalNotification?: (title: string, body: string, delayMs: number) => Promise<void> }).frontendEditorLocalNotification; if (native) return native(title, body, delay); if (!('Notification' in window)) throw new Error('Notifications are not available on this device'); const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission; if (permission !== 'granted') throw new Error('Notification permission was not granted'); window.setTimeout(() => new Notification(title, { body }), delay) }
const graphPrepareFile = (value: unknown, maxMb = '2', accept = '') => new Promise<{ name: string; type: string; size: number; dataUrl: string }>((resolve, reject) => { if (!(value instanceof File)) return reject(new Error('Choose a file')); const limit = Math.min(10, Math.max(1, Number(maxMb) || 2)) * 1024 * 1024; if (value.size > limit) return reject(new Error('The file exceeds the ' + Math.round(limit / 1024 / 1024) + ' MB limit')); const allowed = accept.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean); const extension = '.' + (value.name.split('.').pop() || '').toLowerCase(), mime = value.type.toLowerCase(); if (allowed.length && !allowed.some((item) => item === extension || item === mime || (item.endsWith('/*') && mime.startsWith(item.slice(0, -1))))) return reject(new Error('This file type is not allowed')); const reader = new FileReader(); reader.onerror = () => reject(new Error('The file could not be read')); reader.onload = () => resolve({ name: value.name, type: value.type, size: value.size, dataUrl: String(reader.result || '') }); reader.readAsDataURL(value) })
async function runGraph(flowId: string, input: unknown = '', ancestry: string[] = []): Promise<unknown> {
  if (ancestry.includes(flowId)) throw new Error('Reusable flow cycle: ' + [...ancestry, flowId].join(' → ')); if (ancestry.length >= 20) throw new Error('Reusable flows exceeded the maximum depth of 20')
  const flow = graphFlows.find((item) => item.id === flowId); if (!flow) throw new Error('Flow non trovato')
  const nodes = new Map(flow.nodes.map((node) => [node.id, node])); let node: GraphNode | undefined = flow.nodes.find((item) => item.type === 'event'), value = input, path = 'success', steps = 0; const visited = new Map<string, number>(), loops = new Map<string, { items: unknown[]; index: number }>()
  while (node) { if (++steps > 1000) throw new Error('Il flow ha superato il limite di 1000 passaggi'); const current: GraphNode = node, count = (visited.get(current.id) ?? 0) + 1; visited.set(current.id, count); if (count > 1 && loops.size === 0) throw new Error('Loop non controllato al nodo ' + current.label)
    try {
      if (current.type === 'readInput') value = (graphElement(current.config.componentId) as HTMLInputElement | null)?.value ?? input
      if (current.type === 'validate') { const actual = current.config.field ? graphField(value, current.config.field) : value, rule = current.config.rule || 'required', expected = current.config.value || ''; const valid = rule === 'required' ? actual !== undefined && actual !== null && String(actual).trim() !== '' : rule === 'email' ? /^\\S+@\\S+\\.\\S+$/.test(String(actual ?? '')) : rule === 'minLength' ? String(actual ?? '').length >= Math.max(0, Number(expected) || 0) : rule === 'min' ? Number(actual) >= Number(expected) : rule === 'max' ? Number(actual) <= Number(expected) : false; if (!valid) throw new Error(current.config.message || 'The value is not valid') }
      let condition = current.type === 'condition' ? graphMatches(value, current.config.field, current.config.operator, current.config.value) : true
      if (current.type === 'requestPermission') { const granted = await requestNativePermission(current.config.permission, current.config.rationale); value = { permission: current.config.permission, granted }; condition = granted }
      if (current.type === 'platformCondition') { const info = await getPlatformInfo(); condition = graphPlatformMatches(info, current.config.platform, current.config.minVersion, current.config.maxVersion); value = { ...info, matches: condition } }
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
      if (current.type === 'requireRole') { const role = graphRole(), allowed = (current.config.roles || 'admin').split(',').map((item) => item.trim()).filter(Boolean); if (!allowed.includes(role)) throw new Error(current.config.message || 'You do not have permission for this action'); value = { role, allowed: true } }
      if (current.type === 'signOut') graphSignOut()
      if (current.type === 'insert') { const next = typeof value === 'string' ? value.trim() : value; await insert(next, current.config.sourceId); value = next }
      if (current.type === 'query') { const previous = value, records = await query(current.config.sourceId); if (current.config.mode === 'one') { const configured = current.config.id || '{{value}}', id = configured === '{{value}}' ? (previous && typeof previous === 'object' ? graphField(previous, current.config.field || 'id') : previous) : configured; if (id === undefined || id === null || String(id).trim() === '') throw new Error('Indica l’ID del record da caricare'); const record = records.find((item) => String(graphField(item, 'id') ?? '') === String(id)); if (!record) throw new Error('Record ' + String(id) + ' non trovato'); value = record } else value = records }
      if (current.type === 'update') value = await update(value, current.config.sourceId)
      if (current.type === 'delete') { await remove(value, current.config.sourceId); value = undefined }
      if (current.type === 'filter') { if (!Array.isArray(value)) throw new Error('Il nodo filtro richiede un elenco'); const needle = (current.config.value || '').toLowerCase(); value = value.filter((item) => String(graphField(item, current.config.field) ?? '').toLowerCase().includes(needle)) }
      if (current.type === 'sort') { if (!Array.isArray(value)) throw new Error('Il nodo ordinamento richiede un elenco'); value = [...value].sort((a, b) => String(graphField(a, current.config.field) ?? '').localeCompare(String(graphField(b, current.config.field) ?? '')) * (current.config.direction === 'desc' ? -1 : 1)) }
      if (current.type === 'kpi') { if (!Array.isArray(value)) throw new Error('Il nodo KPI richiede un elenco'); const values = value.map((item) => Number(graphField(item, current.config.field))).filter(Number.isFinite); value = current.config.operation === 'sum' ? values.reduce((a, b) => a + b, 0) : current.config.operation === 'average' ? (values.reduce((a, b) => a + b, 0) / (values.length || 1)) : value.length }
      if (current.type === 'module') { const runner = extensionRunners[current.config.moduleId]; if (!runner) throw new Error('Module not found'); value = runner(value as never) }
      if (current.type === 'refresh') await refresh(current.config.componentId)
      if (current.type === 'navigate') graphNavigate(current.config.mode, current.config.path)
      if (current.type === 'openModal') { const element = graphElement(current.config.componentId); if (current.config.operation === 'close') element?.setAttribute('hidden', ''); else element?.removeAttribute('hidden') }
      if (current.type === 'updateUI') { const element = graphElement(current.config.componentId) as (HTMLElement & { value?: string; disabled?: boolean }) | null, operation = current.config.operation || 'show', next = current.config.value || ''; if (!element) throw new Error('Item da cambiare non trovato'); if (operation === 'show') element.hidden = false; if (operation === 'hide') element.hidden = true; if (operation === 'enable') element.disabled = false; if (operation === 'disable') element.disabled = true; if (operation === 'text') element.textContent = next; if (operation === 'value') element.value = next; if (['background', 'color', 'opacity'].includes(operation)) element.style[operation as 'background' | 'color' | 'opacity'] = next }
      if (current.type === 'notify') graphNotify(current.config.message || String(value))
      if (current.type === 'localNotification') await graphScheduleLocalNotification(current.config.title, current.config.body || String(value ?? ''), current.config.delayMs)
      if (current.type === 'nativeAction') value = await runNativeAction(current.config.capability, current.config.action, value, current.config)
      if (current.type === 'runFlow') value = await runGraph(current.config.flowId, value, [...ancestry, flowId])
      if (current.type === 'log') console.debug(current.config.message || current.label, value)
      path = loopPath ?? (current.type === 'switch' ? (switchMatch ? 'case:' + switchMatch : 'error') : condition ? 'success' : 'error')
    } catch (error) { path = 'error'; graphNotify('Error: ' + (error instanceof Error ? error.message : String(error)), true); if (ancestry.length) throw error }
    const edge = flow.edges.find((item) => item.source === current.id && item.path === path); node = edge ? nodes.get(edge.target) : undefined
  }
  return value
}
${bindings.map((binding) => `{ const element = graphElement(${JSON.stringify(binding.componentId)}); const run = (event: Event) => { event.preventDefault(); const target = event.target as HTMLInputElement, gesture = (event as CustomEvent).detail?.kyroGesture ? (event as CustomEvent).detail : undefined; const input = gesture ?? (event.type === 'submit' && event.currentTarget instanceof HTMLFormElement ? Object.fromEntries(new FormData(event.currentTarget)) : target?.type === 'file' ? target.files?.[0] : target?.value ?? ''); void runGraph(${JSON.stringify(binding.flowId)}, input) }; graphListen(element, ${JSON.stringify(binding.event)}, run); ${binding.event === "submit" ? `if (element instanceof HTMLFormElement) element.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach((button) => button.addEventListener('click', (event) => { event.preventDefault(); void runGraph(${JSON.stringify(binding.flowId)}, Object.fromEntries(new FormData(element))) }))` : ""} }`).join("\n")}
const graphPath = () => decodeURIComponent(location.hash.slice(1) || ${JSON.stringify(project.pages[0]?.path ?? "/")})
const graphPageMatches = (pagePath?: string) => !pagePath || graphPath() === pagePath
const graphRunPageLoads = () => { ${automatic.filter((item) => item.trigger === "pageLoad").map((item) => `if (graphPageMatches(${JSON.stringify(item.pagePath)})) void runGraph(${JSON.stringify(item.flowId)})`).join("; ")} }
graphRunPageLoads()
addEventListener('hashchange', graphRunPageLoads)
${automatic.filter((item) => item.trigger === "timer").map((item) => `setInterval(() => { if (graphPageMatches(${JSON.stringify(item.pagePath)})) void runGraph(${JSON.stringify(item.flowId)}) }, ${item.interval})`).join("\n")}
${automatic.filter((item) => item.trigger === "online" || item.trigger === "offline").map((item) => `addEventListener(${JSON.stringify(item.trigger)}, () => { if (graphPageMatches(${JSON.stringify(item.pagePath)})) void runGraph(${JSON.stringify(item.flowId)}) })`).join("\n")}
${automatic.filter((item) => item.trigger === "pageVisible" || item.trigger === "pageHidden").map((item) => `document.addEventListener('visibilitychange', () => { if (graphPageMatches(${JSON.stringify(item.pagePath)}) && (${JSON.stringify(item.trigger)} === 'pageVisible') === !document.hidden) void runGraph(${JSON.stringify(item.flowId)}) })`).join("\n")}
${automatic.filter((item) => item.trigger === "deepLink").map((item) => `addEventListener('kyroDeepLink', (event) => { if (graphPageMatches(${JSON.stringify(item.pagePath)})) void runGraph(${JSON.stringify(item.flowId)}, (event as CustomEvent).detail) })`).join("\n")}
${automatic.filter((item) => item.trigger === "deviceShake").map((item, index) => `{ let graphLastShake${index} = 0; addEventListener('devicemotion', (event) => { const value = event.accelerationIncludingGravity, strength = Math.abs(value?.x ?? 0) + Math.abs(value?.y ?? 0) + Math.abs(value?.z ?? 0); if (strength > 28 && Date.now() - graphLastShake${index} > 1200 && graphPageMatches(${JSON.stringify(item.pagePath)})) { graphLastShake${index} = Date.now(); void runGraph(${JSON.stringify(item.flowId)}, { x: value?.x, y: value?.y, z: value?.z }) } }) }`).join("\n")}`;
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
