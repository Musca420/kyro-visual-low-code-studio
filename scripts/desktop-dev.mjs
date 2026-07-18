import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const projectFlag = process.argv.indexOf("--project");
const workspace = resolve(projectFlag >= 0 ? process.argv[projectFlag + 1] : process.cwd());
await access(workspace).catch(() => {
  throw new Error(`Cartella non accessibile: ${workspace}`);
});
const environment = { ...process.env, FRONTEND_EDITOR_WORKSPACE: workspace };
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const electron = resolve("node_modules", ".bin", process.platform === "win32" ? "electron.cmd" : "electron");
const vite = spawn(npm, ["run", "dev"], { env: environment, stdio: "inherit" });

async function waitForEditor() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:5173");
      if (response.ok) return;
    } catch { /* il server sta partendo */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Frontend Editor non ha risposto entro 20 secondi.");
}

try {
  await waitForEditor();
  const desktop = spawn(electron, ["electron/main.cjs", "--project", workspace], {
    env: { ...environment, FRONTEND_EDITOR_DEV_URL: "http://127.0.0.1:5173" },
    stdio: "inherit",
  });
  desktop.on("exit", (code) => {
    vite.kill();
    process.exitCode = code ?? 0;
  });
} catch (error) {
  vite.kill();
  throw error;
}

