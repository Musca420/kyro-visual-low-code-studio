const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { mkdir, readdir, readFile, stat } = require("node:fs/promises");
const { basename, extname, join, relative, resolve } = require("node:path");
const { verifyUpdateManifest } = require("./updatePolicy.cjs");

if (require("electron-squirrel-startup")) app.quit();

if (/^\d{2,5}$/.test(process.env.KYRO_DEBUG_PORT || "")) {
  app.commandLine.appendSwitch("remote-debugging-port", process.env.KYRO_DEBUG_PORT);
}

const allowedExtensions = new Set([
  ".css", ".html", ".htm", ".js", ".json", ".jsx", ".md", ".mjs",
  ".svelte", ".ts", ".tsx", ".txt", ".vue", ".yaml", ".yml",
]);
const ignoredDirectories = new Set([
  ".agents", ".git", ".next", ".output", ".turbo", "android", "build", "coverage",
  "dist", "ios", "node_modules", "out", "target",
]);
const maxFiles = 500;
const maxBytes = 4_000_000;

function projectArgument() {
  const flag = process.argv.indexOf("--project");
  const candidate = flag >= 0 ? process.argv[flag + 1] : process.env.KYRO_WORKSPACE || process.env.FRONTEND_EDITOR_WORKSPACE;
  return candidate ? resolve(candidate) : undefined;
}

async function readWorkspace(root) {
  if (!root || !(await stat(root).catch(() => undefined))?.isDirectory()) {
    throw new Error("The requested folder does not exist or is not accessible.");
  }
  const files = [];
  let bytes = 0;
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (files.length >= maxFiles) throw new Error(`The folder exceeds the ${maxFiles} source-file limit.`);
      if (entry.isSymbolicLink() || ignoredDirectories.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if (!entry.isFile() || !allowedExtensions.has(extname(entry.name).toLowerCase())) continue;
      const content = await readFile(absolute, "utf8");
      bytes += Buffer.byteLength(content);
      if (bytes > maxBytes) throw new Error("The folder exceeds the safe 4 MB source-text limit.");
      files.push({ path: relative(root, absolute).replaceAll("\\", "/"), content });
    }
  }
  await visit(root);
  return { root, name: basename(root), files };
}

let mainWindow;
let currentProject = projectArgument();
let agentWorkspace;
let localServer;
let updateStatus = { state: "disabled", message: "Update channel is not configured" };

async function checkSecureUpdate() {
  const manifestUrl = process.env.FRONTEND_EDITOR_UPDATE_MANIFEST_URL;
  const publicKey = process.env.FRONTEND_EDITOR_UPDATE_PUBLIC_KEY?.replaceAll("\\n", "\n");
  const channel = process.env.FRONTEND_EDITOR_UPDATE_CHANNEL || "stable";
  if (!manifestUrl || !publicKey) return updateStatus;
  try {
    const url = new URL(manifestUrl);
    if (url.protocol !== "https:") throw new Error("The update manifest requires HTTPS");
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Update manifest is unavailable (${response.status})`);
    const text = await response.text();
    if (Buffer.byteLength(text) > 64_000) throw new Error("Update manifest is too large");
    const manifest = verifyUpdateManifest(JSON.parse(text), {
      currentVersion: app.getVersion(), channel, platform: process.platform,
      arch: process.arch, publicKey,
    });
    updateStatus = {
      state: "available",
      message: `Update ${manifest.version} verified for the ${channel} channel`,
      version: manifest.version,
      channel,
    };
  } catch (error) {
    updateStatus = {
      state: "rejected",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  mainWindow?.webContents.send("desktop:update-status", updateStatus);
  return updateStatus;
}
const gotLock = app.requestSingleInstanceLock({ project: currentProject });
if (!gotLock) app.quit();

app.on("second-instance", (_event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  const flag = argv.indexOf("--project");
  if (flag >= 0 && argv[flag + 1]) {
    currentProject = resolve(argv[flag + 1]);
    mainWindow?.webContents.send("desktop:open-project", currentProject);
  }
});

app.whenReady().then(async () => {
  agentWorkspace = currentProject || join(app.getPath("userData"), "workspace");
  await mkdir(agentWorkspace, { recursive: true });
  ipcMain.handle("desktop:workspace", () => currentProject ? readWorkspace(currentProject) : null);
  ipcMain.handle("desktop:update-status", () => updateStatus);
  ipcMain.handle("desktop:capture-region", async (_event, value) => {
    if (!mainWindow || mainWindow.isDestroyed()) throw new Error("Window is unavailable");
    const bounds = mainWindow.getContentBounds();
    const x = Math.max(0, Math.floor(Number(value?.x) || 0));
    const y = Math.max(0, Math.floor(Number(value?.y) || 0));
    const width = Math.min(bounds.width - x, Math.max(1, Math.ceil(Number(value?.width) || 1)));
    const height = Math.min(bounds.height - y, Math.max(1, Math.ceil(Number(value?.height) || 1)));
    if (width <= 0 || height <= 0) throw new Error("Invalid capture area");
    const image = await mainWindow.webContents.capturePage({ x, y, width, height });
    return { dataUrl: image.toDataURL(), width, height };
  });
  ipcMain.handle("desktop:reveal", async (_event, path) => {
    if (!agentWorkspace || typeof path !== "string") return false;
    const target = resolve(path);
    if (target !== agentWorkspace && !target.startsWith(`${agentWorkspace}\\`) && !target.startsWith(`${agentWorkspace}/`)) return false;
    shell.showItemInFolder(target);
    return true;
  });

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 760,
    minHeight: 640,
    backgroundColor: "#0b1114",
    show: false,
    title: "Kyro — Visual Low-Code Studio",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  const editorUrl = process.env.KYRO_DEV_URL || process.env.FRONTEND_EDITOR_DEV_URL || await startLocalServer(agentWorkspace);
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = url.startsWith(editorUrl);
    if (!allowed) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.once("did-finish-load", () => void checkSecureUpdate());
  await mainWindow.loadURL(editorUrl);
});

async function startLocalServer(workspace) {
  process.env.KYRO_WORKSPACE = workspace;
  process.env.FRONTEND_EDITOR_WORKSPACE = workspace;
  const configuredPort = Number(process.env.KYRO_PORT || process.env.FRONTEND_EDITOR_PORT);
  const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 0;
  const { createServer } = await import("vite");
  localServer = await createServer({
    configFile: join(__dirname, "..", "vite.config.ts"),
    root: join(__dirname, ".."),
    cacheDir: join(app.getPath("temp"), `kyro-vite-${app.getVersion()}`),
    optimizeDeps: { force: true },
    server: { host: "127.0.0.1", port, strictPort: port > 0 },
  });
  await localServer.listen();
  const address = localServer.httpServer?.address();
  const activePort = typeof address === "object" && address ? address.port : port;
  return `http://127.0.0.1:${activePort}`;
}

app.on("window-all-closed", () => {
  void localServer?.close();
  if (process.platform !== "darwin") app.quit();
});
