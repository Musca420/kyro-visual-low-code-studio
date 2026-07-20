import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const projectFlag = process.argv.indexOf("--project");
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = projectFlag >= 0 ? resolve(process.argv[projectFlag + 1]) : undefined;
const workspace = project ?? resolve(homedir(), ".kyro", "workspace");
await mkdir(workspace, { recursive: true });
process.env.KYRO_WORKSPACE = workspace;
process.env.KYRO_PROJECT_MODE = project ? "project" : "home";

const { createServer } = await import("vite");
const server = await createServer({
  root: packageRoot,
  configFile: resolve(packageRoot, "vite.config.ts"),
  server: { host: "127.0.0.1", port: 43127, strictPort: false },
});
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://127.0.0.1:43127/";
console.log(`Kyro is ready at ${url}${project ? `\nProject: ${project}` : "\nHome: choose or import a project"}`);

if (!process.argv.includes("--no-open")) {
  const [command, args] = process.platform === "win32"
    ? ["cmd.exe", ["/d", "/s", "/c", "start", "", url]]
    : process.platform === "darwin"
      ? ["open", [url]]
      : ["xdg-open", [url]];
  spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

const close = async () => {
  await server.close();
  process.exit(0);
};
process.once("SIGINT", close);
process.once("SIGTERM", close);
