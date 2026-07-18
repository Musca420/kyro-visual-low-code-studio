#!/usr/bin/env node
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const folderArgument = process.argv.slice(2).find((value) => !value.startsWith("--"));
const candidate = resolve(folderArgument ?? process.cwd());
const info = await stat(candidate).catch(() => undefined);
if (!info?.isDirectory()) {
  console.error(`Frontend Editor: la cartella non esiste: ${candidate}`);
  process.exit(2);
}
if (process.argv.includes("--check")) {
  console.log(`Frontend Editor aprirà: ${candidate}`);
  process.exit(0);
}
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npm, ["run", "desktop:dev", "--", "--project", candidate], {
  cwd: packageRoot,
  stdio: "inherit",
});
child.on("exit", (code) => { process.exitCode = code ?? 0; });
