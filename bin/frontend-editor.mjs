#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import packageJson from "../package.json" with { type: "json" };

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Kyro — Visual Low-Code Studio

Usage: kyro [folder] [options]

  kyro                 Open the current project, or Home from an ordinary folder
  kyro path/to/project Open or import an explicit project folder
  kyro --home          Always open Home
  kyro --check         Show what Kyro would open without starting it
  kyro --version       Show the installed version`);
  process.exit(0);
}
if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(packageJson.version);
  process.exit(0);
}
const folderArgument = process.argv.slice(2).find((value) => !value.startsWith("--"));
const candidate = resolve(folderArgument ?? process.cwd());
const info = await stat(candidate).catch(() => undefined);
if (!info?.isDirectory()) {
  console.error(`Kyro: the folder does not exist: ${candidate}`);
  process.exit(2);
}
const markers = ["project.kyro.json", "project.frontend-editor.json", "package.json", "index.html"];
const isProject = !process.argv.includes("--home") && (Boolean(folderArgument) || (await Promise.all(markers.map((name) => access(resolve(candidate, name)).then(() => true).catch(() => false)))).some(Boolean));
if (process.argv.includes("--check")) {
  console.log(isProject ? `Kyro will open project: ${candidate}` : "Kyro will open Home");
  process.exit(0);
}
const child = spawn(process.execPath, [
  resolve(packageRoot, "scripts", "kyro-start.mjs"),
  ...(isProject ? ["--project", candidate] : []),
  ...(process.argv.includes("--no-open") ? ["--no-open"] : []),
], {
  cwd: packageRoot,
  stdio: "inherit",
});
child.on("exit", (code) => { process.exitCode = code ?? 0; });
