/// <reference types="node" />
import { appendFile, lstat, mkdir, realpath } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export type SecurityBudget = {
  shellCommands: number;
  files: number;
  dependencies: number;
  processes: number;
  builds: number;
  runtimeAdapters: number;
  networkRequests: number;
};

export type SecurityAuditEvent = {
  id: string;
  timestamp: string;
  projectId: string;
  jobId?: string;
  effect: "shell" | "filesystem" | "network" | "dependency" | "process" | "mcp";
  action: string;
  result: "allowed" | "denied";
  detail: string;
};

export const defaultSecurityBudget = (): SecurityBudget => ({
  shellCommands: 20, files: 100, dependencies: 0, processes: 12,
  builds: 2, runtimeAdapters: 4, networkRequests: 4,
});

const inside = (root: string, candidate: string) => candidate === root || candidate.startsWith(`${root}${sep}`);
const secretName = /(^|[_-])(api[_-]?key|authorization|cookie|credential|password|secret|ssh|token)($|[_-])/i;
const secretValue = /\b(sk-[a-z0-9_-]{12,}|gh[opusr]_[a-z0-9]{12,}|bearer\s+[a-z0-9._~-]{12,}|(?:api[_-]?key|password|secret|token)\s*[=:]\s*[^\s,;]+)/gi;
const violation = (message: string) => Object.assign(new Error(message), { name: "SecurityViolation" });
const loopback = (value: string) => {
  try { return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(new URL(value).hostname); }
  catch { return false; }
};

export function redactSecrets<T>(value: T): T {
  if (typeof value === "string") return value.replace(secretValue, "[REDACTED]") as T;
  if (Array.isArray(value)) return value.map(redactSecrets) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secretName.test(key) ? "[REDACTED]" : redactSecrets(item)])) as T;
}

export function assertLocalRequest(request: IncomingMessage, requireBrowserOrigin = false) {
  const host = String(request.headers.host ?? "");
  if (!loopback(`http://${host}`)) throw violation("Kyro accepts bridge requests only on the loopback interface.");
  const origin = request.headers.origin;
  if (origin && !loopback(origin)) throw violation("The request origin is not trusted.");
  if (origin && new URL(origin).host !== host) throw violation("The request origin does not match the Kyro bridge.");
  if (requireBrowserOrigin && !origin) throw violation("This operation requires the local Kyro editor origin.");
}

function splitCommand(command: string) {
  if (!command.trim() || command.length > 1_000 || /[\0\r\n;&|><`]/.test(command) || /\$\(|\$\{|%[^%]+%/.test(command))
    throw new Error("Only one allow-listed task without shell operators is accepted.");
  const values: string[] = [];
  let current = "", quote = "";
  for (const character of command.trim()) {
    if (quote) { if (character === quote) quote = ""; else current += character; continue; }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (/\s/.test(character)) { if (current) { values.push(current); current = ""; } }
    else current += character;
  }
  if (quote) throw new Error("The command contains an unterminated quote.");
  if (current) values.push(current);
  return values;
}

export type AuthorizedTask = { executable: "node" | "npm" | "pnpm" | "git" | "tsc" | "vitest" | "playwright"; args: string[] };

export function authorizeTask(command: string): AuthorizedTask {
  const [executable, ...args] = splitCommand(command);
  if (args.some((argument) => isAbsolute(argument) || argument === ".." || argument.startsWith("../") || argument.includes("/../") || argument.includes("\\..\\")))
    throw new Error("Task arguments must remain inside the workspace.");
  if (executable === "git" && args[0] === "status" && args.slice(1).every((argument) => ["--short", "--branch", "--porcelain", "--untracked-files=no"].includes(argument))) return { executable, args };
  if (executable === "git" && args[0] === "diff" && !args.includes("--no-index")) return { executable, args };
  if ((executable === "npm" || executable === "pnpm") && args[0] === "run" && /^[a-z0-9:_-]+$/i.test(args[1] ?? "")) return { executable, args };
  if (["tsc", "vitest", "playwright"].includes(executable)) return { executable: executable as AuthorizedTask["executable"], args };
  if (executable === "node" && args.length && !args[0].startsWith("-") && /\.(c?js|mjs)$/i.test(args[0])) return { executable, args };
  throw new Error("Task not allowed. Use node <local-script>, npm/pnpm run, tsc, vitest, playwright, git status, or git diff.");
}

export class SecurityPolicy {
  readonly root: string;
  private auditQueue = Promise.resolve();

  constructor(workspaceRoot: string, private readonly auditPath = resolve(workspaceRoot, ".kyro", "security-audit.jsonl")) {
    this.root = resolve(workspaceRoot);
    if (!inside(this.root, resolve(auditPath))) throw new Error("Security audit must remain inside the workspace.");
  }

  async workspacePath(input: string) {
    if (!input || isAbsolute(input)) throw new Error("An absolute path is outside the project scope.");
    const candidate = resolve(this.root, input);
    if (!inside(this.root, candidate)) throw new Error("Path traversal outside the workspace was rejected.");
    let cursor = candidate;
    while (!(await lstat(cursor).catch(() => undefined))) {
      const parent = dirname(cursor);
      if (parent === cursor) throw new Error("No trusted workspace ancestor exists.");
      cursor = parent;
    }
    const trustedAncestor = await realpath(cursor);
    const canonicalRoot = await realpath(this.root);
    if (!inside(canonicalRoot, trustedAncestor)) throw new Error("Symlink escape outside the workspace was rejected.");
    return candidate;
  }

  consume(budget: SecurityBudget, effect: keyof SecurityBudget, amount = 1) {
    if (budget[effect] < amount) throw new Error(`Security budget exceeded for ${effect}; security review required.`);
    budget[effect] -= amount;
  }

  async audit(event: Omit<SecurityAuditEvent, "id" | "timestamp">) {
    const record: SecurityAuditEvent = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...redactSecrets(event) };
    this.auditQueue = this.auditQueue.then(async () => {
      await mkdir(dirname(this.auditPath), { recursive: true });
      await appendFile(this.auditPath, `${JSON.stringify(record)}\n`, "utf8");
    });
    await this.auditQueue;
    return record;
  }
}

export const safeEnvironment = (environment: NodeJS.ProcessEnv) => Object.fromEntries(
  Object.entries(environment).filter(([name, value]) => value !== undefined && !secretName.test(name)),
) as NodeJS.ProcessEnv;

export const workspaceRelative = (root: string, path: string) => relative(resolve(root), resolve(path)).replaceAll("\\", "/");
