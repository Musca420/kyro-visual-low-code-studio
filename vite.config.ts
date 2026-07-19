import react from "@vitejs/plugin-react";
import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { access, cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  changedPaths,
  restoreWorkspace,
  snapshotWorkspace,
  type WorkspaceSnapshot,
} from "./server/workspaceTransactions";
import { approvedOperations, quickCrudFlowsPlan, quickCrudSurfacePlan, quickDailyFlowScreenPlan, quickDashboardPlan, quickDataViewsPlan, quickHabitsPlan, quickLocalNotificationPlan, quickNavigationFlowPlan, quickStructurePlan, quickVisualPlan } from "./server/codexPlan";

const workspaceRoot = resolve(process.env.KYRO_WORKSPACE ?? process.env.FRONTEND_EDITOR_WORKSPACE ?? process.cwd());
const bundledSkillsRoot = fileURLToPath(new URL("./.agents/skills", import.meta.url));
const workspaceSkillsRoot = resolve(workspaceRoot, ".agents/skills");
const skillsReady = bundledSkillsRoot === workspaceSkillsRoot
  ? Promise.resolve()
  : mkdir(workspaceSkillsRoot, { recursive: true }).then(() =>
      cp(bundledSkillsRoot, workspaceSkillsRoot, { recursive: true, force: true }),
    );

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

async function body(request: IncomingMessage) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 4_000_000) throw new Error("Richiesta troppo grande");
  }
  return JSON.parse(raw || "{}") as Record<string, unknown>;
}

function reply(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

async function gitSnapshot() {
  try {
    const [status, diff] = await Promise.all([
      run("git", ["status", "--short"], {
        cwd: workspaceRoot,
        timeout: 10_000,
      }),
      run("git", ["diff", "--no-ext-diff", "--no-color", "HEAD"], {
        cwd: workspaceRoot,
        timeout: 10_000,
        maxBuffer: 1_000_000,
      }),
    ]);
    return { status: status.stdout, diff: diff.stdout };
  } catch {
    return { status: "", diff: "" };
  }
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
    revision: number;
    mode: "plan" | "apply";
    status: "running" | "completed" | "error" | "cancelled" | "restored";
    output: string;
    errors: string;
    code?: number | null;
    startedAt: string;
    finishedAt?: string;
    git?: Awaited<ReturnType<typeof gitSnapshot>>;
    changedFiles: string[];
    before?: WorkspaceSnapshot;
    after?: WorkspaceSnapshot;
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
            return reply(response, 200, { ok: true });
          }
          if (
            url.pathname.startsWith("/api/live/tools/") &&
            request.method === "POST"
          ) {
            const tool = url.pathname.split("/").at(-1)!,
              input = await body(request),
              projectId = String(input.projectId ?? ""),
              state = projects.get(projectId);
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
            const mutations = new Set([
              "move_component",
              "resize_component",
              "set_component_property",
              "set_component_style",
              "set_responsive_style",
              "set_component_state_style",
              "set_component_accessibility",
              "set_component_intent",
              "set_component_event",
              "remove_component_event",
              "set_theme_token",
              "add_component",
              "remove_component",
              "reorder_component",
              "wrap_component",
              "create_flow",
              "add_flow",
              "update_flow",
              "remove_flow",
              "add_flow_node",
              "update_flow_node",
              "remove_flow_node",
              "connect_nodes",
              "remove_flow_edge",
              "bind_component_data",
              "create_data_source",
              "update_data_source",
              "remove_data_source",
              "add_page",
              "update_page",
              "remove_page",
              "set_project_property",
              "set_app_config",
              "set_export_config",
              "apply_editor_transaction",
              "undo_last_transaction",
              "open_preview",
              "capture_canvas",
              "capture_preview",
            ]);
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
                error: "Una transazione è già in attesa",
              });
            const command = {
              id: crypto.randomUUID(),
              projectId,
              pageId: String(input.pageId ?? state.pageId),
              revision: Number(input.revision),
              tool,
              args: (input.args ?? {}) as Record<string, unknown>,
              status: "pending" as const,
            };
            commands.push(command);
            return reply(response, 202, {
              transactionId: command.id,
              status: command.status,
            });
          }
          if (url.pathname === "/api/live/commands" && request.method === "GET")
            return reply(
              response,
              200,
              commands.filter(
                (item) =>
                  item.projectId === url.searchParams.get("projectId") &&
                  item.status === "pending",
              ),
            );
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
                error: "Apri il progetto prima di avviare il terminale",
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
                  error: "La sessione non è attiva",
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
                  "Applico identità, permessi e comportamento nativo…",
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
          if (url.pathname === "/api/codex/jobs" && request.method === "POST") {
            if (agent || agentJobId)
              return reply(response, 409, { error: "Codex sta già lavorando" });
            const input = await body(request),
              prompt = String(input.prompt ?? ""),
              mode = input.mode === "apply" ? "apply" : "plan",
              projectId = String(input.projectId ?? "");
            if (!prompt.trim() || prompt.length > 8_000)
              return reply(response, 400, {
                error: "La richiesta deve contenere da 1 a 8000 caratteri",
              });
            const current = projects.get(projectId);
            if (!current || input.revision !== current.revision)
              return reply(response, 409, {
                error:
                  "Il progetto è cambiato: aggiorna il contesto prima di continuare",
              });
            const id = crypto.randomUUID(),
              job: CodexJob = {
                id,
                projectId,
                revision: Number(input.revision),
                mode,
                status: "running",
                output: "",
                errors: "",
                startedAt: new Date().toISOString(),
                changedFiles: [],
                before:
                  mode === "apply"
                    ? await snapshotWorkspace(workspaceRoot)
                    : undefined,
              };
            jobs.set(id, job);
            agentJobId = id;
            const quickPlan = mode === "plan"
              ? quickVisualPlan(prompt, (input.context ?? {}) as Record<string, unknown>)
                ?? quickLocalNotificationPlan(prompt, (input.context ?? {}) as Record<string, unknown>)
                ?? quickDataViewsPlan(prompt, (input.context ?? {}) as Record<string, unknown>)
                ?? quickNavigationFlowPlan(prompt, (input.context ?? {}) as Record<string, unknown>)
                ?? quickStructurePlan(prompt, (input.context ?? {}) as Record<string, unknown>)
                ?? quickDashboardPlan(prompt, (input.context ?? {}) as Record<string, unknown>)
                ?? quickDailyFlowScreenPlan(prompt, (input.context ?? {}) as Record<string, unknown>)
                ?? quickHabitsPlan(prompt, (input.context ?? {}) as Record<string, unknown>)
                ?? quickCrudSurfacePlan(prompt, (input.context ?? {}) as Record<string, unknown>)
                ?? quickCrudFlowsPlan(prompt, (input.context ?? {}) as Record<string, unknown>)
              : undefined;
            if (quickPlan) {
              job.status = "completed";
              job.finishedAt = new Date().toISOString();
              job.output = JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: quickPlan } }) + "\n";
              agentJobId = undefined;
              return reply(response, 202, { jobId: id, status: job.status });
            }
            const auth = await codexAuthStatus();
            if (!auth.authenticated && (mode === "plan" || !approvedOperations(input.approvedPlan))) {
              job.status = "error";
              job.finishedAt = new Date().toISOString();
              job.errors = auth.message;
              job.output = JSON.stringify({ type: "item.completed", item: { type: "error", message: auth.message } }) + "\n";
              agentJobId = undefined;
              return reply(response, 202, { jobId: id, status: job.status });
            }
            await skillsReady;
            const bridgeBase = `${url.protocol}//${request.headers.host ?? "127.0.0.1:4173"}`;
            const approvedPlan = String(input.approvedPlan ?? "").trim();
            const liveBridgeContract = mode === "plan" ? `
Usa soltanto il context pack Frontend Editor fornito qui sotto. Non eseguire comandi, non leggere file, non interrogare il bridge e non acquisire screenshot.
Produci un piano breve basato su ID stabili, operazioni tipizzate e criteri osservabili. Il progetto visuale e il suo grafo sono la source of truth.
Operazioni disponibili: add_page, update_page, remove_page, add_component, move_component, resize_component, reorder_component, wrap_component, remove_component, set_component_property, set_responsive_style, set_component_state_style, set_component_accessibility, set_component_intent, set_component_event, remove_component_event, set_theme_token, add_flow, update_flow, remove_flow, add_flow_node, update_flow_node, remove_flow_node, connect_nodes, remove_flow_edge, create_data_source, update_data_source, remove_data_source, bind_component_data, set_project_property, set_app_config, set_export_config. Ogni operazione usa {"type":"...","pageId":"... opzionale","args":{...}}.
Firme essenziali: add_page args={name,path,pageId?}; update_page args={name?,path?}; add_component args={componentId?,componentType,name?,props?,styles?:{desktop?,tablet?,mobile?},accessibility?,intent?,parentId?}; set_component_property args={componentId,property,value}, dove property="name" rinomina il livello; set_responsive_style args={componentId,breakpoint,property,value}; set_component_state_style args={componentId,state,property,value}; set_component_accessibility args={componentId,label,role?}; set_component_intent args={componentId,intent}; set_component_event args={componentId,event,flowId}; remove_component_event args={componentId,event}; remove_component args={componentId,confirmed:true}; add_flow args={flowId?,name}; add_flow_node args={flowId,node:{id,type,label,position:{x,y},config:{string:string}}}; connect_nodes args={flowId,source,target,path?}; create_data_source args={sourceId?,name,provider,collection,schema}; bind_component_data args={componentId,sourceId,state?:"data"|"loading"|"empty"|"error"}; set_app_config e set_export_config args={patch:{...}}. Usa componentType tra quelli gia presenti nel context o: section,row,grid,spacer,text,title,link,image,icon,button,input,textarea,select,checkbox,radio,form,card,list,table,navbar,tabs,modal,loader,empty,alert,toast,header,sidebar,hero,footer,carousel,gallery,menu,breadcrumb,accordion,drawer,tooltip,pagination,upload,avatar,badge,progress,skeleton,chart,calendar,map,audio,video.
Termina sempre con una sola riga FRONTEND_EDITOR_OPERATIONS=<json> contenente da 1 a 50 operazioni valide. Usa pageId al livello dell'operazione quando il target non e la pagina attiva. Per stili multipli o breakpoint crea piu operazioni set_responsive_style.
` : `
Il progetto visuale aperto e il suo grafo sono la source of truth. Non modificare codice generato per una modifica rappresentabile nell'editor.
Usa $frontend-editor-live e la skill di dominio pertinente installata in .agents/skills. Non usare la skill Browser per modificare Frontend Editor.
Il Live Bridge e disponibile nella variabile FRONTEND_EDITOR_LIVE_URL. Invoca gli strumenti tramite node .agents/skills/frontend-editor-live/scripts/invoke_live_tool.mjs; non stampare il payload completo di /api/live/status.
Il piano e gia stato approvato: eseguilo direttamente, senza ripetere l'analisi e senza acquisire screenshot tramite il bridge. Per modifiche correlate usa una sola apply_editor_transaction. Lo script attende il transactionId. Non chiamare /api/live/state.
`;
            const instruction = `${
              mode === "plan"
                ? "Proponi il piano minimo. Non modificare file o progetto."
                : "Applica subito il piano approvato al grafo visuale tramite Live Bridge."
            }\n${liveBridgeContract}${approvedPlan ? `\nPiano approvato:\n${approvedPlan}\n` : ""}\nRichiesta originale:\n${prompt}\n\nContext pack indicizzato:\n${JSON.stringify(input.context)}`;
            const operations = mode === "apply" ? approvedOperations(input.approvedPlan) : undefined;
            if (operations) {
              const context = (input.context ?? {}) as Record<string, unknown>;
              const command = {
                id: crypto.randomUUID(),
                projectId,
                pageId: String(context.pageId ?? current.pageId),
                revision: Number(input.revision),
                tool: "apply_editor_transaction",
                args: { operations },
                status: "pending" as "pending" | "applied" | "error",
                error: undefined as string | undefined,
                result: undefined as unknown,
              };
              commands.push(command);
              void (async () => {
                for (let attempt = 0; attempt < 300 && command.status === "pending" && job.status === "running"; attempt += 1)
                  await new Promise((done) => setTimeout(done, 100));
                if (job.status === "cancelled") return;
                job.finishedAt = new Date().toISOString();
                job.status = command.status === "applied" ? "completed" : "error";
                job.errors = command.error ?? (command.status === "pending" ? "La transazione visuale non ha risposto" : "");
                job.output = JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: command.status === "applied" ? `Modifica applicata al grafo. Transazione ${command.id}.` : job.errors } }) + "\n";
                agentJobId = undefined;
              })();
              return reply(response, 202, { jobId: id, status: job.status });
            }
            const spawnedAgent = spawn(
              codexCommand,
              [
                ...codexPrefix,
                "-a",
                "never",
                "exec",
                "--json",
                "--ephemeral",
                "--skip-git-repo-check",
                "-C",
                workspaceRoot,
                "-s",
                mode === "plan" ? "read-only" : "workspace-write",
                "-",
              ],
              {
                cwd: workspaceRoot,
                stdio: "pipe",
                env: { ...process.env, FRONTEND_EDITOR_LIVE_URL: bridgeBase },
              },
            );
            agent = spawnedAgent;
            spawnedAgent.stdout.on("data", (chunk) => {
              job.output += chunk;
              if (job.output.length > 250_000) spawnedAgent.kill();
            });
            spawnedAgent.stderr.on("data", (chunk) => {
              job.errors += chunk;
            });
            spawnedAgent.stdin.end(instruction);
            spawnedAgent.on("close", async (code) => {
              if (agent === spawnedAgent) agent = undefined;
              if (agentJobId === id) agentJobId = undefined;
              job.code = code;
              job.finishedAt = new Date().toISOString();
              job.status =
                job.status === "cancelled"
                  ? "cancelled"
                  : code === 0
                    ? "completed"
                    : "error";
              job.git = await gitSnapshot();
              if (job.before) {
                job.after = await snapshotWorkspace(workspaceRoot);
                job.changedFiles = changedPaths(job.before, job.after);
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
              before: undefined,
              after: undefined,
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
            if (!job?.before || !job.after || job.status !== "completed")
              return reply(response, 409, {
                error: "Operazione non ripristinabile",
              });
            const restored = await restoreWorkspace(
              workspaceRoot,
              job.before,
              job.after,
            );
            job.status = "restored";
            return reply(response, 200, { restored, jobId: id });
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
                error: "Accesso Codex già in corso",
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
          if (request.url === "/api/codex/run" && request.method === "POST") {
            if (agent)
              return reply(response, 409, { error: "Codex sta già lavorando" });
            const input = await body(request),
              prompt = String(input.prompt ?? ""),
              mode = input.mode === "apply" ? "apply" : "plan";
            if (!prompt.trim() || prompt.length > 8_000)
              return reply(response, 400, {
                error: "La richiesta deve contenere da 1 a 8000 caratteri",
              });
            const current = projects.get(String(input.projectId));
            if (!current || input.revision !== current.revision)
              return reply(response, 409, {
                error:
                  "Il progetto è cambiato: aggiorna il contesto prima di continuare",
              });
            const instruction = `${mode === "plan" ? "Analizza e proponi un piano. Non modificare file." : "Applica la modifica richiesta e verifica il risultato."}\n\n${prompt}\n\nContesto Frontend Editor:\n${JSON.stringify(input.context)}`;
            agent = spawn(
              codexCommand,
              [
                ...codexPrefix,
                "-a",
                "never",
                "exec",
                "--json",
                "--ephemeral",
                "--skip-git-repo-check",
                "-C",
                workspaceRoot,
                "-s",
                mode === "plan" ? "read-only" : "workspace-write",
                "-",
              ],
              { cwd: workspaceRoot, stdio: "pipe" },
            );
            let output = "",
              errors = "";
            agent.stdout.on("data", (chunk) => {
              output += chunk;
              if (output.length > 250_000) agent?.kill();
            });
            agent.stderr.on("data", (chunk) => {
              errors += chunk;
            });
            agent.stdin.end(instruction);
            agent.on("close", async (code) => {
              agent = undefined;
              reply(response, code === 0 ? 200 : 500, {
                code,
                output,
                errors,
                git: await gitSnapshot(),
              });
            });
            return;
          }
          if (
            request.url === "/api/codex/cancel" &&
            request.method === "POST"
          ) {
            const cancelled = Boolean(agent);
            agent?.kill();
            agent = undefined;
            return reply(response, 200, { cancelled });
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
