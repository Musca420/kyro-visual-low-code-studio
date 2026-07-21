import { mkdtemp, mkdir, readFile, symlink } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertLocalRequest,
  authorizeTask,
  defaultSecurityBudget,
  redactSecrets,
  SecurityPolicy,
} from "../server/security";

describe("Kyro Security Policy", () => {
  it("allows only local origins and allow-listed tasks without shell syntax", () => {
    expect(() => assertLocalRequest({ headers: { host: "127.0.0.1:5173", origin: "http://127.0.0.1:5173" } } as IncomingMessage, true)).not.toThrow();
    expect(() => assertLocalRequest({ headers: { host: "attacker.test", origin: "https://attacker.test" } } as IncomingMessage)).toThrow(/loopback/);
    expect(authorizeTask("git status --short")).toEqual({ executable: "git", args: ["status", "--short"] });
    expect(authorizeTask("npm run check")).toEqual({ executable: "npm", args: ["run", "check"] });
    expect(() => authorizeTask("npm install danger")).toThrow(/not allowed/);
    expect(() => authorizeTask("git status; powershell whoami")).toThrow(/shell operators/);
    expect(() => authorizeTask("node -e \"process.exit()\"")).toThrow(/not allowed/);
  });

  it("rejects traversal and symlink escape while accepting project paths", async () => {
    const base = await mkdtemp(join(tmpdir(), "kyro-security-"));
    const root = join(base, "workspace"), outside = join(base, "outside");
    await Promise.all([mkdir(root), mkdir(outside)]);
    await symlink(outside, join(root, "escape"), "junction");
    const policy = new SecurityPolicy(root);
    await expect(policy.workspacePath("src/new.ts")).resolves.toBe(join(root, "src/new.ts"));
    await expect(policy.workspacePath("../outside/secret.txt")).rejects.toThrow(/traversal/);
    await expect(policy.workspacePath("escape/secret.txt")).rejects.toThrow(/Symlink escape/);
    await expect(policy.workspacePath(outside)).rejects.toThrow(/absolute path/);
  });

  it("redacts secrets, enforces budgets, and appends immutable audit evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "kyro-audit-"));
    const policy = new SecurityPolicy(root);
    expect(redactSecrets({ apiKey: "secret-value", note: "Bearer abcdefghijklmnop" })).toEqual({ apiKey: "[REDACTED]", note: "[REDACTED]" });
    const budget = defaultSecurityBudget();
    budget.dependencies = 0;
    expect(() => policy.consume(budget, "dependencies")).toThrow(/security review required/);
    policy.consume(budget, "shellCommands");
    expect(budget.shellCommands).toBe(19);
    await policy.audit({ projectId: "project", effect: "shell", action: "git status", result: "allowed", detail: "token=ghp_abcdefghijklmnop" });
    const audit = await readFile(join(root, ".kyro", "security-audit.jsonl"), "utf8");
    expect(audit.trim().split("\n")).toHaveLength(1);
    expect(audit).not.toContain("ghp_abcdefghijklmnop");
  });
});
