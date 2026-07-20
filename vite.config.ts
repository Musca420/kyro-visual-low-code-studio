import react from "@vitejs/plugin-react";
import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { readJsonBody } from "./server/httpBody";
import { codexExecArguments, codexFailure, codexFinalMessage, codexThreadId, codexUsage, codexUsedDisallowedShell } from "./server/codexInvocation";
import { buildAgentContext } from "./server/agentContext";
import { operationNameSet, operationPrompt } from "./src/agentRegistry";
import { parseAgentPlan } from "./src/agentPlan";
import { parseAgentApply } from "./src/agentApply";
import { resolveCapability } from "./src/capabilityResolver";

const workspaceRoot = resolve(process.env.KYRO_WORKSPACE ?? process.env.FRONTEND_EDITOR_WORKSPACE ?? process.cwd());
const bundledSkillsRoot = fileURLToPath(new URL("./.agents/skills", import.meta.url));
const kyroRoot = resolve(bundledSkillsRoot, "../..");
const kyroMcpPath = fileURLToPath(new URL("./server/kyroMcp.mjs", import.meta.url));
const agentPlanSchemaPath = fileURLToPath(new URL("./server/agent-plan.schema.json", import.meta.url));
const agentApplySchemaPath = fileURLToPath(new URL("./server/agent-apply.schema.json", import.meta.url));

const sourceExtensions = new Set([".css", ".html", ".htm", ".js", ".json", ".jsx", ".md", ".mjs", ".svelte", ".ts", ".tsx", ".txt", ".vue", ".yaml", ".yml"]);
const ignoredSourceDirectories = new Set([".agents", ".git", ".next", ".output", ".turbo", "android", "build", "coverage", "dist", "ios", "node_modules", "out", "target"]);
async function readWorkspace() {
  if (process.env.KYRO_PROJECT_MODE !== "project") return null;
  if (!(await stat(workspaceRoot).catch(() => undefined))?.isDirectory()) throw new Error("The project folder is not accessible.");
  const files: { path: string; content: string }[] = [];
  let bytes = 0;
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (files.length >= 500) throw new Error("The project exceeds the 500 source file safety limit.");
      if (entry.isSymbolicLink() || ignoredSourceDirectories.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) { await visit(absolute); continue; }
      if (!entry.isFile() || !sourceExtensions.has(extname(entry.name).toLowerCase())) continue;
      const content = await readFile(absolute, "utf8");
      bytes += Buffer.byteLength(content);
      if (bytes > 4_000_000) throw new Error("The project exceeds the 4 MB source text safety limit.");
      files.push({ path: relative(workspaceRoot, absolute).replaceAll("\\", "/"), content });
    }
  }
  await visit(workspaceRoot);
  return { root: workspaceRoot, name: basename(workspaceRoot), files };
}

const run = promisify(execFile);
const nodeCommand =
  process.platform === "win32" && process.versions.electron
    ? resolve(process.env.ProgramFiles ?? "C:/Program Files", "nodejs/node.exe")
    : process.execPath;
const codexCommand = process.platform === "win32" ? nodeCommand : "codex";
const codexPrefix =
  process.platform === "win32"
    ? [
        resolve(
          process.env.APPDATA ?? "",
          "npm/node_modules/@openai/codex/bin/codex.js",
        ),
      ]
    : [];
const npmCommand = process.platform === "win32" ? nodeCommand : "npm";
const npmPrefix =
  process.platform === "win32"
    ? [resolve(nodeCommand, "../node_modules/npm/bin/npm-cli.js")]
    : [];
const npxCommand = process.platform === "win32" ? nodeCommand : "npx";
const npxPrefix =
  process.platform === "win32"
    ? [resolve(nodeCommand, "../node_modules/npm/bin/npx-cli.js")]
    : [];
const exists = (path: string) =>
  access(path)
    .then(() => true)
    .catch(() => false);
const sdkCandidates = () =>
  [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    resolve(process.env.LOCALAPPDATA ?? "", "Android/Sdk"),
  ].filter(Boolean) as string[];
const javaCandidates = () => [
  "java",
  resolve(
    process.env.ProgramFiles ?? "C:/Program Files",
    "Android/Android Studio/jbr/bin/java.exe",
  ),
  resolve(
    process.env.LOCALAPPDATA ?? "",
    "Programs/Android Studio/jbr/bin/java.exe",
  ),
];

const body = readJsonBody;

function reply(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function flattenComponentTree(
  tree: Record<string, unknown>[],
): Record<string, unknown>[] {
  return tree.flatMap((item) => [
    item,
    ...flattenComponentTree(
      Array.isArray(item.children)
        ? (item.children as Record<string, unknown>[])
        : [],
    ),
  ]);
}

function liveBridge() {
  const agentBridgeToken = crypto.randomUUID();
  let latest: Record<string, unknown> | undefined;
  const projects = new Map<string, Record<string, unknown>>();
  const commands: {
    id: string;
    projectId: string;
    pageId: string;
    revision: number;
    tool: string;
    args: Record<string, unknown>;
    status: "pending" | "applied" | "error";
    claimedBy?: string;
    claimedAt?: number;
    error?: string;
    result?: unknown;
  }[] = [];
  let agent: ChildProcessWithoutNullStreams | undefined;
  let agentJobId: string | undefined;
  let loginProcess: ChildProcessWithoutNullStreams | undefined;
  const loginSessions = new Map<
    string,
    {
      id: string;
      status: "running" | "completed" | "error" | "cancelled";
      output: string;
      errors: string;
      code?: number | null;
    }
  >();
  const codexAuthStatus = async () => {
    try {
      const result = await run(codexCommand, [...codexPrefix, "login", "status"], {
        cwd: workspaceRoot,
        timeout: 10_000,
      });
      return { authenticated: true, message: result.stdout.trim() || result.stderr.trim() || "Account ChatGPT collegato" };
    } catch {
      return { authenticated: false, message: "Collega il tuo account ChatGPT qui per usare Codex oltre alle azioni locali." };
    }
  };
  const androidJobs = new Map<
    string,
    {
      id: string;
      status: "running" | "completed" | "error";
      directory: string;
      message: string;
      output: string;
      error?: string;
      apk?: string;
      build: "pending" | "passed" | "skipped" | "failed";
    }
  >();
  type TerminalSession = {
    id: string;
    projectId: string;
    status: "running" | "closed" | "error";
    output: string;
    process: ChildProcessWithoutNullStreams;
    code?: number | null;
  };
  const terminalSessions = new Map<string, TerminalSession>();
  type CodexJob = {
    id: string;
    projectId: string;
    clientId?: string;
    revision: number;
    mode: "plan" | "apply";
    status: "running" | "completed" | "error" | "cancelled" | "restored";
    output: string;
    errors: string;
    warnings: string;
    code?: number | null;
    startedAt: string;
    finishedAt?: string;
    changedFiles: string[];
    threadId?: string;
    transactionId?: string;
    contextHash?: string;
    contextBytes?: number;
    usage?: ReturnType<typeof codexUsage>;
    approvedOperations?: NonNullable<ReturnType<typeof parseAgentPlan>>["operations"];
    approvedCapabilityProposal?: NonNullable<ReturnType<typeof parseAgentPlan>>["capabilityProposal"];
    learningCandidate?: NonNullable<ReturnType<typeof parseAgentApply>>["learningCandidate"];
  };
  const jobs = new Map<string, CodexJob>();
  return {
    name: "frontend-editor-live-bridge",
    configureServer(server: {
      middlewares: {
        use: (
          handler: (
            request: IncomingMessage,
            response: ServerResponse,
            next: () => void,
          ) => void,
        ) => void;
      };
    }) {
      server.middlewares.use(async (request, response, next) => {
        try {
          const url = new URL(request.url ?? "/", "http://127.0.0.1");
          if (url.pathname === "/api/workspace" && request.method === "GET")
            return reply(response, 200, await readWorkspace());
          if (url.pathname === "/api/live/status" && request.method === "GET") {
            const state = url.searchParams.get("projectId")
              ? projects.get(url.searchParams.get("projectId")!)
              : latest;
            return reply(
              response,
              state ? 200 : 503,
              state ?? { error: "Editor non ancora collegato" },
            );
          }
          if (url.pathname === "/api/agent/context" && request.method === "GET") {
            if (!latest) return reply(response, 404, { error: "No Kyro project is open" });
            return reply(response, 200, buildAgentContext(latest, { kind: (latest.selectedComponentIds as unknown[])?.length ? "component" : "page" }));
          }
          if (url.pathname === "/api/agent/authorization" && request.method === "GET") {
            if (request.headers.authorization !== `Bearer ${agentBridgeToken}`)
              return reply(response, 401, { error: "Invalid Kyro agent token" });
            const activeJob = agentJobId ? jobs.get(agentJobId) : undefined;
            if (!activeJob || activeJob.status !== "running")
              return reply(response, 409, { error: "No active Kyro agent job" });
            return reply(response, 200, {
              mode: activeJob.mode,
              approvedOperations: activeJob.mode === "apply" ? activeJob.approvedOperations : undefined,
              approvedCapabilityProposal: activeJob.mode === "apply" ? activeJob.approvedCapabilityProposal : undefined,
            });
          }
          if (url.pathname === "/api/agent/capability" && request.method === "POST") {
            if (request.headers.authorization !== `Bearer ${agentBridgeToken}`)
              return reply(response, 401, { error: "Invalid Kyro agent token" });
            const input = await body(request);
            return reply(response, 200, resolveCapability(input.request, latest));
          }
          if (url.pathname === "/api/live/state" && request.method === "POST") {
            const state = await body(request);
            if (
              !state.projectId ||
              !state.pageId ||
              !Number.isInteger(state.revision)
            )
              return reply(response, 400, { error: "Stato live non valido" });
            latest = {
              ...state,
              timestamp: new Date().toISOString(),
              workspace: workspaceRoot,
            };
            projects.set(String(state.projectId), latest);
            if (state.clientId) projects.set(`${String(state.projectId)}:${String(state.clientId)}`, latest);
            return reply(response, 200, { ok: true });
          }
          if (
            url.pathname.startsWith("/api/live/tools/") &&
            request.method === "POST"
          ) {
            const tool = url.pathname.split("/").at(-1)!,
              input = await body(request),
              projectId = String(input.projectId ?? ""),
              activeClientId = agentJobId ? jobs.get(agentJobId)?.clientId : undefined,
              state = (activeClientId ? projects.get(`${projectId}:${activeClientId}`) : undefined) ?? projects.get(projectId);
            if (!state)
              return reply(response, 404, {
                error: "Progetto live non trovato",
              });
            const tree = Array.isArray(state.componentTree)
                ? (state.componentTree as Record<string, unknown>[])
                : [],
              toolArgs = (input.args ?? {}) as Record<string, unknown>,
              flatTree = flattenComponentTree(tree),
              flows = Array.isArray(state.flows)
                ? (state.flows as Record<string, unknown>[])
                : [];
            const reads: Record<string, () => unknown> = {
              get_editor_status: () => ({
                projectId: state.projectId,
                pageId: state.pageId,
                revision: state.revision,
                selectedComponentIds: state.selectedComponentIds,
                timestamp: state.timestamp,
                previewState: state.previewState,
                viewport: state.viewport,
              }),
              get_active_project: () => state,
              get_active_page: () => ({ id: state.pageId, components: tree }),
              get_current_selection: () =>
                flatTree.filter((item) =>
                  (state.selectedComponentIds as unknown[]).includes(item.id),
                ),
              get_component: () =>
                flatTree.find((item) => item.id === toolArgs.componentId),
              get_component_tree: () => tree,
              get_component_layout: () =>
                (state.layouts as Record<string, unknown> | undefined)?.[
                  String(toolArgs.componentId)
                ],
              get_computed_styles: () =>
                flatTree.find((item) => item.id === toolArgs.componentId)?.styles,
              get_page_flows: () => flows,
              get_component_flows: () =>
                flows.filter(
                  (flow) =>
                    Array.isArray(flow.nodes) &&
                    (flow.nodes as Record<string, unknown>[]).some(
                      (node) =>
                        (node.config as Record<string, unknown> | undefined)
                          ?.componentId === toolArgs.componentId,
                    ),
                ),
              get_data_sources: () => state.dataSources,
              get_runtime_state: () => ({
                previewState: state.previewState,
                viewport: state.viewport,
              }),
              get_validation_errors: () => state.validationErrors,
              get_console_errors: () => state.consoleErrors,
              validate_project: () => ({
                valid: !(state.validationErrors as unknown[])?.length,
                errors: state.validationErrors,
              }),
            };
            if (reads[tool]) return reply(response, 200, reads[tool]());
            const mutations = new Set([...operationNameSet, "apply_editor_transaction", "register_global_capability", "undo_last_transaction", "open_preview", "capture_canvas", "capture_preview"]);
            if (!mutations.has(tool))
              return reply(response, 404, {
                error: `Tool non disponibile: ${tool}`,
              });
            if (input.revision !== state.revision)
              return reply(response, 409, { error: "Revisione obsoleta" });
            if (
              commands.some(
                (item) =>
                  item.projectId === projectId && item.status === "pending",
              )
            )
              return reply(response, 409, {
                error: "A transaction is already pending",
              });
            const command: (typeof commands)[number] = {
              id: crypto.randomUUID(),
              projectId,
              pageId: String(input.pageId ?? state.pageId),
              revision: Number(input.revision),
              tool,
              args: (input.args ?? {}) as Record<string, unknown>,
              status: "pending" as const,
            };
            commands.push(command);
            for (let attempt = 0; attempt < 240 && command.status === "pending"; attempt += 1)
              await new Promise((resolveWait) => setTimeout(resolveWait, 250));
            if (command.status === "error")
              return reply(response, 409, { error: command.error || "Kyro command failed", transactionId: command.id });
            if (command.status === "pending")
              return reply(response, 504, { error: "Kyro command timed out", transactionId: command.id });
            return reply(response, 202, { ...command, transactionId: command.id });
          }
          if (url.pathname === "/api/live/commands" && request.method === "GET") {
            const clientId = url.searchParams.get("clientId") ?? "";
            if (!clientId) return reply(response, 400, { error: "A live editor client ID is required" });
            const now = Date.now();
            const available = commands.filter((item) =>
              item.projectId === url.searchParams.get("projectId") &&
              item.status === "pending" &&
              (!item.claimedBy || item.claimedBy === clientId || now - (item.claimedAt ?? 0) > 60_000),
            );
            available.forEach((item) => { item.claimedBy = clientId; item.claimedAt = now; });
            return reply(response, 200, available);
          }
          if (
            url.pathname.startsWith("/api/live/commands/") &&
            request.method === "POST"
          ) {
            const command = commands.find(
                (item) => item.id === url.pathname.split("/").at(-1),
              ),
              result = await body(request);
            if (!command)
              return reply(response, 404, { error: "Transazione non trovata" });
            if (command.claimedBy && command.claimedBy !== url.searchParams.get("clientId"))
              return reply(response, 409, { error: "This transaction is leased to another editor client" });
            command.status = result.ok === true ? "applied" : "error";
            command.error = result.error ? String(result.error) : undefined;
            command.result = result.result;
            return reply(response, 200, command);
          }
          if (
            url.pathname.startsWith("/api/live/transactions/") &&
            request.method === "GET"
          ) {
            const command = commands.find(
              (item) => item.id === url.pathname.split("/").at(-1),
            );
            return reply(
              response,
              command ? 200 : 404,
              command ?? { error: "Transazione non trovata" },
            );
          }
          if (
            url.pathname === "/api/terminal/sessions" &&
            request.method === "POST"
          ) {
            const input = await body(request),
              projectId = String(input.projectId ?? "");
            if (!projects.has(projectId))
              return reply(response, 403, {
                error: "Open the project before starting the terminal",
              });
            const existing = [...terminalSessions.values()].find(
              (session) =>
                session.projectId === projectId && session.status === "running",
            );
            if (existing)
              return reply(response, 200, {
                sessionId: existing.id,
                status: existing.status,
                workspace: workspaceRoot,
              });
            const terminalCommand =
              process.platform === "win32"
                ? "powershell.exe"
                : process.env.SHELL || "/bin/sh";
            const terminalArgs =
              process.platform === "win32"
                ? ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "-"]
                : [];
            const safeEnvironment = Object.fromEntries(
              Object.entries(process.env).filter(
                ([name, value]) =>
                  value !== undefined &&
                  !/(token|secret|password|api[_-]?key|credential)/i.test(name),
              ),
            ) as NodeJS.ProcessEnv;
            const child = spawn(terminalCommand, terminalArgs, {
              cwd: workspaceRoot,
              env: safeEnvironment,
              stdio: "pipe",
              windowsHide: true,
            });
            const session: TerminalSession = {
              id: crypto.randomUUID(),
              projectId,
              status: "running",
              output: `Frontend Editor terminale locale\nWorkspace: ${workspaceRoot}\n`,
              process: child,
            };
            terminalSessions.set(session.id, session);
            const append = (chunk: unknown) => {
              session.output = (session.output + String(chunk)).slice(-200_000);
            };
            child.stdout.on("data", append);
            child.stderr.on("data", append);
            child.on("error", (error) => {
              append(`\n${error.message}\n`);
              session.status = "error";
            });
            child.on("close", (code) => {
              session.code = code;
              session.status = session.status === "error" ? "error" : "closed";
              append(`\nSessione terminata (${code ?? "nessun codice"}).\n`);
            });
            return reply(response, 201, {
              sessionId: session.id,
              status: session.status,
              workspace: workspaceRoot,
            });
          }
          if (url.pathname.startsWith("/api/terminal/sessions/")) {
            const parts = url.pathname.split("/"),
              id = parts[4],
              action = parts[5],
              session = terminalSessions.get(id);
            if (!session)
              return reply(response, 404, {
                error: "Sessione terminale non trovata",
              });
            if (request.method === "GET" && !action) {
              if (url.searchParams.get("projectId") !== session.projectId)
                return reply(response, 403, {
                  error: "Output non autorizzato per questo progetto",
                });
              const cursor = Math.max(
                  0,
                  Number(url.searchParams.get("cursor") ?? 0),
                ),
                reset = cursor > session.output.length;
              return reply(response, 200, {
                status: session.status,
                output: session.output.slice(reset ? 0 : cursor),
                cursor: session.output.length,
                code: session.code,
                reset,
              });
            }
            const input = await body(request);
            if (String(input.projectId ?? "") !== session.projectId)
              return reply(response, 403, {
                error: "Sessione non autorizzata per questo progetto",
              });
            if (request.method === "POST" && action === "input") {
              const command = String(input.command ?? "");
              if (session.status !== "running")
                return reply(response, 409, {
                  error: "The session is not active",
                });
              if (
                !command.trim() ||
                command.length > 4_000 ||
                command.includes("\0") ||
                command.includes("\r") ||
                command.includes("\n")
              )
                return reply(response, 400, {
                  error: "Inserisci un singolo comando fino a 4000 caratteri",
                });
              session.output = (session.output + `\n> ${command}\n`).slice(
                -200_000,
              );
              session.process.stdin.write(`${command}\n`);
              return reply(response, 202, { accepted: true });
            }
            if (request.method === "POST" && action === "close") {
              if (session.status === "running") {
                session.process.stdin.end();
                setTimeout(
                  () => session.status === "running" && session.process.kill(),
                  1500,
                );
              }
              return reply(response, 200, { closing: true });
            }
          }
          if (
            url.pathname === "/api/android/status" &&
            request.method === "GET"
          ) {
            const sdkPath =
              (
                await Promise.all(
                  sdkCandidates().map(async (path) =>
                    (await exists(path)) ? path : "",
                  ),
                )
              ).find(Boolean) ?? "";
            const studioPaths = [
              resolve(
                process.env.ProgramFiles ?? "C:/Program Files",
                "Android/Android Studio/bin/studio64.exe",
              ),
              resolve(
                process.env.LOCALAPPDATA ?? "",
                "Programs/Android Studio/bin/studio64.exe",
              ),
            ];
            const inspect = async (command: string, args: string[]) => {
              try {
                const value = await run(command, args, {
                  cwd: workspaceRoot,
                  timeout: 8_000,
                });
                return {
                  available: true,
                  version: `${value.stdout}\n${value.stderr}`
                    .trim()
                    .split("\n")[0],
                };
              } catch {
                return { available: false, version: "" };
              }
            };
            const adbPath = sdkPath
              ? resolve(
                  sdkPath,
                  "platform-tools",
                  process.platform === "win32" ? "adb.exe" : "adb",
                )
              : "adb";
            const java = (
              await Promise.all(
                javaCandidates().map((path) => inspect(path, ["-version"])),
              )
            ).find((item) => item.available) ?? {
              available: false,
              version: "",
            };
            return reply(response, 200, {
              java,
              adb: await inspect(adbPath, ["version"]),
              sdk: { available: Boolean(sdkPath), path: sdkPath },
              androidStudio: (await Promise.all(studioPaths.map(exists))).some(
                Boolean,
              ),
            });
          }
          if (
            url.pathname === "/api/android/prepare" &&
            request.method === "POST"
          ) {
            const input = await body(request),
              projectId = String(input.projectId ?? ""),
              files = input.files;
            if (!projects.has(projectId))
              return reply(response, 403, {
                error: "Progetto non autorizzato o non aperto",
              });
            if (
              !files ||
              typeof files !== "object" ||
              Array.isArray(files) ||
              Object.keys(files).length > 250
            )
              return reply(response, 400, { error: "File Android non validi" });
            const base = resolve(workspaceRoot, "android-builds"),
              directory = resolve(base, `${projectId}-${Date.now()}`);
            if (
              !directory.startsWith(
                `${base}${process.platform === "win32" ? "\\" : "/"}`,
              )
            )
              return reply(response, 400, {
                error: "Percorso Android non sicuro",
              });
            await mkdir(directory, { recursive: true });
            for (const [name, content] of Object.entries(files)) {
              const target = resolve(directory, name);
              if (
                !target.startsWith(
                  `${directory}${process.platform === "win32" ? "\\" : "/"}`,
                ) ||
                typeof content !== "string"
              )
                return reply(response, 400, {
                  error: `File non sicuro: ${name}`,
                });
              await mkdir(resolve(target, ".."), { recursive: true });
              await writeFile(target, content, "utf8");
            }
            const id = crypto.randomUUID(),
              job = {
                id,
                status: "running" as const,
                directory,
                message: "File creati. Installo le dipendenze Capacitor 8…",
                output: "",
                build: "pending" as const,
              } as {
                id: string;
                status: "running" | "completed" | "error";
                directory: string;
                message: string;
                output: string;
                error?: string;
                apk?: string;
                build: "pending" | "passed" | "skipped" | "failed";
              };
            androidJobs.set(id, job);
            void (async () => {
              const step = async (
                command: string,
                args: string[],
                message: string,
                timeout: number,
                environment?: NodeJS.ProcessEnv,
              ) => {
                job.message = message;
                const value = await run(command, args, {
                  cwd: directory,
                  timeout,
                  maxBuffer: 4_000_000,
                  env: environment,
                });
                job.output += `\n$ ${command} ${args.join(" ")}\n${value.stdout}\n${value.stderr}`;
              };
              const quietStep = async (
                command: string,
                args: string[],
                message: string,
                timeout: number,
                environment: NodeJS.ProcessEnv,
              ) => {
                job.message = message;
                job.output += `\n$ ${command} ${args.join(" ")}\n`;
                await new Promise<void>((resolveStep, rejectStep) => {
                  const child = spawn(command, args, {
                    cwd: directory,
                    env: environment,
                    stdio: "ignore",
                    windowsHide: true,
                  });
                  const timer = setTimeout(() => {
                    child.kill();
                    rejectStep(new Error(`${message} oltre il tempo massimo`));
                  }, timeout);
                  child.once("error", (error) => {
                    clearTimeout(timer);
                    rejectStep(error);
                  });
                  child.once("exit", (code) => {
                    clearTimeout(timer);
                    if (code === 0) resolveStep();
                    else
                      rejectStep(
                        new Error(
                          `${message} non riuscita (codice ${code ?? "sconosciuto"})`,
                        ),
                      );
                  });
                });
              };
              try {
                await step(
                  npmCommand,
                  [...npmPrefix, "install", "--no-audit", "--no-fund"],
                  "Scarico le dipendenze dichiarate…",
                  300_000,
                );
                await step(
                  npmCommand,
                  [...npmPrefix, "run", "build"],
                  "Compilo la web app…",
                  180_000,
                );
                await step(
                  npxCommand,
                  [...npxPrefix, "cap", "add", "android"],
                  "Creo la cartella Android nativa…",
                  180_000,
                );
                await step(
                  npmCommand,
                  [...npmPrefix, "run", "android:configure"],
                  "Applying identity, permissions, and native behavior…",
                  60_000,
                );
                await step(
                  npxCommand,
                  [...npxPrefix, "cap", "sync", "android"],
                  "Sincronizzo interfaccia e configurazione…",
                  180_000,
                );
                const sdkPath = (
                    await Promise.all(
                      sdkCandidates().map(async (path) =>
                        (await exists(path)) ? path : "",
                      ),
                    )
                  ).find(Boolean),
                  javaPath = (
                    await Promise.all(
                      javaCandidates()
                        .slice(1)
                        .map(async (path) =>
                          (await exists(path)) ? path : "",
                        ),
                    )
                  ).find(Boolean),
                  gradle = resolve(
                    directory,
                    "android",
                    process.platform === "win32" ? "gradlew.bat" : "gradlew",
                  ),
                  gradleJar = resolve(
                    directory,
                    "android/gradle/wrapper/gradle-wrapper.jar",
                  );
                if (
                  sdkPath &&
                  (await exists(sdkPath)) &&
                  (await exists(gradle)) &&
                  (process.platform !== "win32" ||
                    Boolean(javaPath && (await exists(gradleJar))))
                ) {
                  const gradleCommand =
                    process.platform === "win32" ? javaPath! : gradle;
                  const gradleArgs =
                    process.platform === "win32"
                      ? [
                          "-classpath",
                          gradleJar,
                          "org.gradle.wrapper.GradleWrapperMain",
                          "--no-daemon",
                          "--console=plain",
                          "-p",
                          "android",
                          "assembleDebug",
                        ]
                      : [
                          "--no-daemon",
                          "--console=plain",
                          "-p",
                          "android",
                          "assembleDebug",
                        ];
                  try {
                    await quietStep(
                      gradleCommand,
                      gradleArgs,
                      "Compilo l'APK di sviluppo…",
                      600_000,
                      {
                        ...process.env,
                        ANDROID_HOME: sdkPath,
                        ANDROID_SDK_ROOT: sdkPath,
                        ...(javaPath
                          ? { JAVA_HOME: resolve(javaPath, "../..") }
                          : {}),
                      },
                    );
                    job.build = "passed";
                    const apk = resolve(
                      directory,
                      "android/app/build/outputs/apk/debug/app-debug.apk",
                    );
                    if (await exists(apk)) job.apk = apk;
                  } catch (error) {
                    job.build = "failed";
                    throw error;
                  }
                } else {
                  job.build = "skipped";
                  job.output +=
                    "\nBuild APK non eseguita: Android SDK o Gradle wrapper non disponibile.";
                }
                job.status = "completed";
                job.message =
                  job.build === "passed"
                    ? "Progetto e APK Android verificati."
                    : "Progetto Android generato; build APK non disponibile in questo ambiente.";
              } catch (error) {
                job.status = "error";
                job.error =
                  error instanceof Error ? error.message : String(error);
                job.message = "Preparazione Android interrotta.";
              }
            })();
            return reply(response, 202, { jobId: id, directory });
          }
          if (url.pathname === "/api/android/jobs" && request.method === "GET")
            return reply(response, 200, [...androidJobs.values()]);
          if (
            url.pathname.startsWith("/api/android/jobs/") &&
            request.method === "GET"
          ) {
            const job = androidJobs.get(url.pathname.split("/")[4]);
            return reply(
              response,
              job ? 200 : 404,
              job ?? { error: "Build Android non trovata" },
            );
          }
          if (url.pathname === "/api/codex/jobs" && request.method === "GET")
            return reply(response, 200, [...jobs.values()].slice(-20).reverse().map((job) => ({ ...job })));
          if (url.pathname === "/api/codex/jobs" && request.method === "POST") {
            if (agent || agentJobId)
              return reply(response, 409, { error: "Codex is already working" });
            const input = await body(request),
              prompt = String(input.prompt ?? ""),
              mode = input.mode === "apply" ? "apply" : "plan",
              projectId = String(input.projectId ?? ""),
              clientId = String(input.clientId ?? "").trim();
            if (!prompt.trim() || prompt.length > 8_000)
              return reply(response, 400, {
                error: "La richiesta deve contenere da 1 a 8000 caratteri",
              });
            const current = (clientId ? projects.get(`${projectId}:${clientId}`) : undefined) ?? projects.get(projectId);
            if (!current || input.revision !== current.revision)
              return reply(response, 409, {
                error:
                  "The project changed: refresh the context before continuing",
              });
            const id = crypto.randomUUID(),
              job: CodexJob = {
                id,
                projectId,
                ...(clientId ? { clientId } : {}),
                revision: Number(input.revision),
                mode,
                status: "running",
                output: "",
                errors: "",
                warnings: "",
                startedAt: new Date().toISOString(),
                changedFiles: [],
            };
            jobs.set(id, job);
            agentJobId = id;
            const bridgeBase = `${url.protocol}//${request.headers.host ?? "127.0.0.1:4173"}`;
            const approvedPlan = String(input.approvedPlan ?? "").trim();
            const parsedApprovedPlan = mode === "apply" ? parseAgentPlan(approvedPlan) : undefined;
            if (mode === "apply" && !parsedApprovedPlan) {
              job.status = "error";
              job.finishedAt = new Date().toISOString();
              job.errors = "The approved Codex plan is invalid or uses unsupported Kyro operations.";
              agentJobId = undefined;
              return reply(response, 202, { jobId: id, status: job.status });
            }
            if (parsedApprovedPlan) {
              job.approvedOperations = parsedApprovedPlan.operations;
              job.approvedCapabilityProposal = parsedApprovedPlan.capabilityProposal;
            }
            if (mode === "apply" && parsedApprovedPlan) {
              const indexedContext = buildAgentContext(current, input.focus ?? input.context);
              job.contextHash = indexedContext.contextHash;
              job.contextBytes = indexedContext.contextBytes;
              const isVisualTransaction = parsedApprovedPlan.operations.length > 0;
              const command: (typeof commands)[number] = {
                id: crypto.randomUUID(),
                projectId,
                pageId: String((input.focus as Record<string, unknown> | undefined)?.pageId ?? current.pageId),
                revision: Number(current.revision),
                tool: isVisualTransaction ? "apply_editor_transaction" : "register_global_capability",
                args: isVisualTransaction
                  ? { operations: parsedApprovedPlan.operations }
                  : parsedApprovedPlan.capabilityProposal as Record<string, unknown>,
                status: "pending",
                ...(clientId ? { claimedBy: clientId, claimedAt: Date.now() } : {}),
              };
              commands.push(command);
              for (let attempt = 0; attempt < 240 && command.status === "pending"; attempt += 1)
                await new Promise((resolveWait) => setTimeout(resolveWait, 250));
              job.finishedAt = new Date().toISOString();
              job.code = command.status === "applied" ? 0 : 1;
              if (command.status !== "applied") {
                job.status = "error";
                job.errors = command.error || (command.status === "pending" ? "Kyro transaction timed out" : "Kyro transaction failed");
              } else {
                job.status = "completed";
                job.transactionId = command.id;
                job.learningCandidate = null;
                job.usage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0, totalTokens: 0 };
                const result = {
                  status: "completed",
                  summary: `Applied approved Codex plan: ${parsedApprovedPlan.summary}`,
                  transactionId: command.id,
                  validation: parsedApprovedPlan.checks,
                  visualResult: "The approved typed operations were applied to the live graph and persisted by Kyro.",
                  learningCandidate: null,
                };
                job.output = JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(result) } }) + "\n";
              }
              agentJobId = undefined;
              return reply(response, 202, { jobId: id, status: job.status });
            }
            const auth = await codexAuthStatus();
            if (!auth.authenticated) {
              job.status = "error";
              job.finishedAt = new Date().toISOString();
              job.errors = auth.message;
              job.output = JSON.stringify({ type: "item.completed", item: { type: "error", message: auth.message } }) + "\n";
              agentJobId = undefined;
              return reply(response, 202, { jobId: id, status: job.status });
            }
            const liveBridgeContract = mode === "plan" ? `
Use the Kyro context pack provided below. Do not run commands or read project files. Use kyro_get_context or kyro_resolve_capability only when the supplied indexed slice is insufficient.
Produce a short plan based on stable IDs, typed operations, and observable criteria. The visual project and its graph are the source of truth.
Available operations: ${operationPrompt}. In the plan output every operation uses {"type":"...","pageId":"page ID or null","argsJson":"{...}"}. argsJson must be valid JSON encoding the operation argument object.
Essential signatures: add_page args={name,path,pageId?}; update_page args={name?,path?}; add_component args={componentId?,componentType,name?,props?,styles?:{desktop?,tablet?,mobile?},accessibility?,intent?,parentId?}; compose_screen args={name,layout,expectedResult?,replaceExisting?,confirmed?,theme?:{primary?,accent?,background?,surface?,text?},sections:[{type?,name,label,description?,role?,expectedResult?,items?:[{type?,name,label,description?,path?,role?,expectedResult?}]}],navigation?:[{label,path}],states?:boolean}. Prefer one compose_screen for a whole screen or large redesign so Kyro expands professional responsive defaults into native editable components; use atomic operations only for precise changes. set_component_property args={componentId,property,value}, where property="name" renames the layer; set_responsive_style args={componentId,breakpoint,property,value}; set_component_state_style args={componentId,state,property,value}; set_component_accessibility args={componentId,label,role?}; set_component_intent args={componentId,intent}; set_component_event args={componentId,event,flowId}; remove_component_event args={componentId,event}; remove_component args={componentId,confirmed:true}; compose_record_action args={componentId,sourceId?,entity,action:"update"|"delete"}. Prefer compose_record_action for a bound list/table update or confirmed delete with refresh, success/error feedback and generated undo support. compose_native_action args={componentId,event?,capability,action,permission?,resultComponentId?,rationale?,successMessage?,errorMessage?}. Prefer it for one registered device action. Registered capability/action pairs: camera/takePhoto|pickImage; barcode/scanQr|scanBarcode; location/getCurrentPosition|openMap; bluetooth/requestDevice|scan|connect|disconnect|read|write; device/getInfo|getBattery; network/getStatus; haptics/impact|vibrate; share/share; clipboard/write|read; files/writeFile|readFile|deleteFile; motion/getOrientation; push/register. External packages remain inactive until the separate visual approval step. add_flow args={flowId?,name}; add_flow_node args={flowId,node:{id,type,label,position:{x,y},config:{string:string}}}; connect_nodes args={flowId,source,target,path?:"success"|"error"}; create_data_source args={sourceId?,name,provider,collection,schema}; bind_component_data args={componentId,sourceId,state?:"data"|"loading"|"empty"|"error"}; set_app_config args={patch:{safeArea?,offline?,themeMode?,supportedThemes?,mobileBottomNavigation?:{enabled,items:[{label,path}]},authentication?,realtime?}} with no navigation wrapper; set_export_config args={patch:{...}}. Native flow node types are event, readInput, validate, condition, switch, loop, getState, setState, resetState, delay, debounce, format, map, http, file, requireRole, signOut, insert, query, update, delete, filter, sort, kpi, refresh, navigate, openModal, updateUI, notify, localNotification, requestPermission, nativeAction, platformCondition, runFlow, module, log. A manual nativeAction config must contain a registered capability and action. Use insert instead of data-create, refresh instead of data-refresh, notify instead of toast or alert, and success/error for validation and failure branches. Use a componentType already present in context or: section,row,grid,spacer,text,title,link,image,icon,button,input,textarea,select,checkbox,radio,form,card,list,table,navbar,tabs,modal,loader,empty,alert,toast,header,sidebar,hero,footer,carousel,gallery,menu,breadcrumb,accordion,drawer,tooltip,pagination,upload,avatar,badge,progress,skeleton,chart,calendar,map,audio,video.
If the request is not directly covered, call kyro_resolve_capability. Prefer a reusable visual flow. A tested built-in advanced function can use create_code_module args={module:{id,name,description,inputType,outputType,operation,config,tests}} where operation is trim, uppercase, lowercase, template, pick, or count; connect it with a module flow node. External code or packages require an explicit confirmation and a separate reviewed extension plan: never invent or install them silently.
Every plan must return alreadySatisfied and capabilityProposal. Set alreadySatisfied=true only when the indexed graph proves the requested outcome already exists; then return operations=[] and capabilityProposal=null. Otherwise set it to false. When registered graph operations fully express a required change, use capabilityProposal=null. When they cannot, do not add a fake intent operation: return operations=[] and a scope="global" proposal generalized for all future Kyro projects, with typed inputs/outputs, permissions, dependencies, validation tests and its activation gate.
Return the structured JSON plan required by the output schema. Put pageId at operation level when the target is not the active page. Use multiple set_responsive_style operations for multiple styles or breakpoints.
` : `
The approved plan and persistent thread already contain the selected Kyro skill guidance and indexed graph context. Do not reread skills, inspect files, use Browser, or run shell commands during apply.
The plan is already approved. With visual operations, call kyro_apply_verified_transaction once with exactly its operations. With only a global capability proposal, call kyro_register_global_capability once with exactly that proposal; it records an inactive versioned draft and never installs dependencies. Report its transaction and result. Do not call other tools or change the approved scope.
After successful verification, return learningCandidate only when the pattern is meaningfully reusable; otherwise return null. A candidate must generalize intent and types, contain no project names, record values or stable IDs, and remain inactive pending passing tests or explicit review.
`;
            const indexedContext = buildAgentContext(current, input.focus ?? input.context);
            job.contextHash = indexedContext.contextHash;
            job.contextBytes = indexedContext.contextBytes;
            const canonicalApprovedPlan = parsedApprovedPlan ? JSON.stringify(parsedApprovedPlan) : "";
            const instruction = `${
              mode === "plan"
                ? "Propose the minimum plan. Do not modify files or the project."
                : "Apply the approved plan to the visual graph through Live Bridge now."
            }\n${liveBridgeContract}${canonicalApprovedPlan ? `\nApproved plan:\n${canonicalApprovedPlan}\n` : ""}\nOriginal request:\n${prompt}\n\nIndexed context pack:\n${JSON.stringify(indexedContext)}`;
            const threadId = String(input.threadId ?? "").trim();
            if (mode === "apply" && !threadId) {
              job.status = "error";
              job.finishedAt = new Date().toISOString();
              job.usage = codexUsage(job.output);
              job.errors = "The approved plan has no Codex thread to resume.";
              agentJobId = undefined;
              return reply(response, 202, { jobId: id, status: job.status });
            }
            const execArgs = codexExecArguments(mode, threadId, mode === "plan" ? agentPlanSchemaPath : agentApplySchemaPath);
            const enabledKyroTools = mode === "plan"
              ? ["kyro_get_context", "kyro_resolve_capability"]
              : parsedApprovedPlan?.operations.length
                ? ["kyro_apply_verified_transaction"]
                : ["kyro_register_global_capability"];
            const spawnedAgent = spawn(
              codexCommand,
              [
                ...codexPrefix,
                "-a",
                "never",
                "-C",
                kyroRoot,
                "-s",
                "read-only",
                ...(mode === "plan" ? ["-c", 'model_reasoning_effort="low"'] : []),
                "-c",
                `mcp_servers.kyro.command=${JSON.stringify(nodeCommand)}`,
                "-c",
                `mcp_servers.kyro.args=${JSON.stringify([kyroMcpPath])}`,
                "-c",
                `mcp_servers.kyro.env.KYRO_LIVE_URL=${JSON.stringify(bridgeBase)}`,
                "-c",
                `mcp_servers.kyro.env.KYRO_AGENT_TOKEN=${JSON.stringify(agentBridgeToken)}`,
                "-c",
                "mcp_servers.kyro.required=true",
                "-c",
                `mcp_servers.kyro.enabled_tools=${JSON.stringify(enabledKyroTools)}`,
                "-c",
                'mcp_servers.kyro.default_tools_approval_mode="approve"',
                "-c",
                "mcp_servers.kyro.tool_timeout_sec=60",
                ...execArgs,
              ],
              {
                cwd: kyroRoot,
                stdio: "pipe",
                env: {
                  ...process.env,
                  FRONTEND_EDITOR_LIVE_URL: bridgeBase,
                },
              },
            );
            agent = spawnedAgent;
            spawnedAgent.stdout.on("data", (chunk) => {
              job.output += chunk;
              if (job.output.length > 250_000) spawnedAgent.kill();
            });
            spawnedAgent.stderr.on("data", (chunk) => {
              job.warnings += chunk;
            });
            spawnedAgent.stdin.end(instruction);
            spawnedAgent.on("close", async (code) => {
              if (agent === spawnedAgent) agent = undefined;
              if (agentJobId === id) agentJobId = undefined;
              job.code = code;
              job.threadId = codexThreadId(job.output, threadId);
              job.finishedAt = new Date().toISOString();
              job.usage = codexUsage(job.output);
              job.status =
                job.status === "cancelled"
                  ? "cancelled"
                  : code === 0
                    ? "completed"
                    : "error";
              if (job.status === "error" && !job.errors.trim()) job.errors = codexFailure(job.output) || "Codex stopped before returning a result.";
              const finalMessage = codexFinalMessage(job.output);
              if (job.status === "completed" && codexUsedDisallowedShell(job.output)) {
                job.status = "error";
                job.errors += "\nKyro rejected this run because Codex used shell access outside the selected Kyro skill files.";
              }
              if (job.status === "completed" && mode === "plan" && !parseAgentPlan(finalMessage)) {
                job.status = "error";
                job.errors += "\nCodex did not return a valid typed Kyro plan.";
              }
              if (job.status === "completed" && mode === "apply") {
                const applied = parseAgentApply(finalMessage);
                const transaction = applied?.transactionId
                  ? commands.find((command) => command.id === applied.transactionId && command.projectId === projectId)
                  : undefined;
                const expectedTool = parsedApprovedPlan?.operations.length ? "apply_editor_transaction" : "register_global_capability";
                if (!applied || applied.status !== "completed" || !transaction || transaction.tool !== expectedTool || transaction.status !== "applied") {
                  job.status = "error";
                  job.errors += "\nCodex did not provide a verified applied Kyro transaction.";
                } else {
                  job.transactionId = transaction.id;
                  job.learningCandidate = applied.learningCandidate;
                }
              }
            });
            spawnedAgent.on("error", (error) => {
              job.errors += error.message;
              job.status = "error";
              job.finishedAt = new Date().toISOString();
              if (agent === spawnedAgent) agent = undefined;
              if (agentJobId === id) agentJobId = undefined;
            });
            return reply(response, 202, { jobId: id, status: job.status });
          }
          if (
            url.pathname.startsWith("/api/codex/jobs/") &&
            request.method === "GET"
          ) {
            const job = jobs.get(url.pathname.split("/")[4]);
            if (!job)
              return reply(response, 404, {
                error: "Operazione Codex non trovata",
              });
            return reply(response, 200, {
              ...job,
            });
          }
          if (
            url.pathname.endsWith("/cancel") &&
            url.pathname.startsWith("/api/codex/jobs/") &&
            request.method === "POST"
          ) {
            const id = url.pathname.split("/")[4],
              job = jobs.get(id);
            if (!job || job.status !== "running" || agentJobId !== id)
              return reply(response, 409, {
                error: "Operazione non annullabile",
              });
            job.status = "cancelled";
            const cancelledAgent = agent;
            agent = undefined;
            agentJobId = undefined;
            cancelledAgent?.kill();
            return reply(response, 200, { cancelled: true });
          }
          if (
            url.pathname.endsWith("/restore") &&
            url.pathname.startsWith("/api/codex/jobs/") &&
            request.method === "POST"
          ) {
            const id = url.pathname.split("/")[4],
              job = jobs.get(id);
            if (!job?.transactionId || job.status !== "completed")
              return reply(response, 409, {
                error: "Operazione non ripristinabile",
              });
            const state = projects.get(job.projectId);
            if (!state || state.revision !== job.revision + 1)
              return reply(response, 409, {
                error: "The project changed after this operation; undo it from the editor history instead.",
              });
            const command: (typeof commands)[number] = {
              id: crypto.randomUUID(), projectId: job.projectId,
              pageId: String(state.pageId), revision: Number(state.revision),
              tool: "undo_last_transaction", args: {}, status: "pending",
            };
            commands.push(command);
            for (let attempt = 0; attempt < 40 && command.status === "pending"; attempt += 1)
              await new Promise((resolveWait) => setTimeout(resolveWait, 250));
            if (command.status !== "applied")
              return reply(response, 409, { error: command.error || "The visual rollback did not complete." });
            job.status = "restored";
            return reply(response, 200, { restored: [job.transactionId], transactionId: command.id, jobId: id });
          }
          if (request.url === "/api/codex/status" && request.method === "GET") {
            return reply(response, 200, { ...(await codexAuthStatus()), workspace: workspaceRoot });
          }
          if (
            url.pathname === "/api/codex/login" &&
            request.method === "POST"
          ) {
            if (loginProcess)
              return reply(response, 409, {
                error: "Codex sign-in is already in progress",
              });
            const input = await body(request),
              id = crypto.randomUUID(),
              session = {
                id,
                status: "running" as const,
                output: "",
                errors: "",
              } as {
                id: string;
                status: "running" | "completed" | "error" | "cancelled";
                output: string;
                errors: string;
                code?: number | null;
              };
            loginSessions.set(id, session);
            loginProcess = spawn(
              codexCommand,
              [
                ...codexPrefix,
                "login",
                ...(input.deviceAuth === true ? ["--device-auth"] : []),
              ],
              { cwd: workspaceRoot, stdio: "pipe" },
            );
            loginProcess.stdout.on("data", (chunk) => {
              session.output += chunk;
            });
            loginProcess.stderr.on("data", (chunk) => {
              session.errors += chunk;
            });
            loginProcess.on("close", (code) => {
              session.code = code;
              session.status =
                session.status === "cancelled"
                  ? "cancelled"
                  : code === 0
                    ? "completed"
                    : "error";
              loginProcess = undefined;
            });
            loginProcess.on("error", (error) => {
              session.errors += error.message;
              session.status = "error";
              loginProcess = undefined;
            });
            return reply(response, 202, {
              sessionId: id,
              status: session.status,
            });
          }
          if (
            url.pathname.startsWith("/api/codex/login/") &&
            request.method === "GET"
          ) {
            const session = loginSessions.get(url.pathname.split("/")[4]);
            return reply(
              response,
              session ? 200 : 404,
              session ?? { error: "Sessione di accesso non trovata" },
            );
          }
          if (
            url.pathname.endsWith("/cancel") &&
            url.pathname.startsWith("/api/codex/login/") &&
            request.method === "POST"
          ) {
            const session = loginSessions.get(url.pathname.split("/")[4]);
            if (!session || session.status !== "running")
              return reply(response, 409, { error: "Accesso non annullabile" });
            session.status = "cancelled";
            loginProcess?.kill();
            return reply(response, 200, { cancelled: true });
          }
          if (
            url.pathname === "/api/codex/logout" &&
            request.method === "POST"
          ) {
            if (agent || loginProcess)
              return reply(response, 409, {
                error: "Attendi la fine dell’operazione in corso",
              });
            try {
              const result = await run(
                codexCommand,
                [...codexPrefix, "logout"],
                { cwd: workspaceRoot, timeout: 10_000 },
              );
              return reply(response, 200, {
                loggedOut: true,
                message: result.stdout.trim() || result.stderr.trim(),
              });
            } catch (error) {
              return reply(response, 500, {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
          next();
        } catch (error) {
          reply(response, 500, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
  };
}

export default {
  base: "./",
  plugins: [react(), liveBridge()],
  server: { watch: { ignored: ["**/android-builds/**"] } },
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
};
