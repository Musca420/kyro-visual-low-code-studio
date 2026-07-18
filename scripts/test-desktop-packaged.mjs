import { spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

const child = spawn(process.execPath, [
  resolve("node_modules/@playwright/test/cli.js"),
  "test",
  "e2e/desktop-packaged.spec.ts",
  "--workers=1",
], {
  env: { ...process.env, RUN_PACKAGED_DESKTOP: "1" },
  stdio: "inherit",
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });

