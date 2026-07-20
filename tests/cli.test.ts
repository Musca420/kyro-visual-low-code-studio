import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const repo = resolve(import.meta.dirname, "..");
const packageVersion = JSON.parse(readFileSync(resolve(repo, "package.json"), "utf8")).version as string;
const empty = mkdtempSync(resolve(tmpdir(), "kyro-home-"));
afterAll(() => rmSync(empty, { recursive: true, force: true }));

const check = (cwd: string, ...args: string[]) => execFileSync(
  process.execPath,
  [resolve(repo, "bin/frontend-editor.mjs"), "--check", ...args],
  { cwd, encoding: "utf8" },
).trim();

const run = (...args: string[]) => execFileSync(
  process.execPath,
  [resolve(repo, "bin/frontend-editor.mjs"), ...args],
  { cwd: repo, encoding: "utf8" },
).trim();

describe("Kyro CLI", () => {
  it("opens Home from an ordinary folder and a project from its folder", () => {
    expect(check(empty)).toBe("Kyro will open Home");
    expect(check(repo)).toBe(`Kyro will open project: ${repo}`);
    expect(check(repo, "--home")).toBe("Kyro will open Home");
  });

  it("documents the repository-first command and reports its version", () => {
    expect(run("--help")).toContain("Usage: kyro [folder] [options]");
    expect(run("--help")).toContain("kyro --check");
    expect(run("--version")).toBe(packageVersion);
  });
});
