import { useEffect, useState } from "react";
import {
  listCodexTimeline,
  saveCodexTimelineEntry,
  type CodexTimelineEntry,
} from "./db";

export type CodexContext = {
  projectId: string;
  projectName: string;
  projectBrief: unknown;
  pageId: string;
  revision: number;
  viewport: "desktop" | "tablet" | "mobile";
  componentId: string;
  componentName: string;
  componentType: string;
  treePath: string[];
  bounds: { x: number; y: number; width: number; height: number };
  properties: Record<string, unknown>;
  styles: Record<string, unknown>;
  events: Record<string, string>;
  intent: Record<string, unknown>;
  binding?: Record<string, unknown>;
  dataSources: unknown[];
  flows: unknown[];
  nearbyComponents: { id: string; name: string; type: string }[];
  pageComponents: { id: string; name: string; type: string; parentId?: string; events: string[]; bound: boolean }[];
  pages: { id: string; name: string; path: string }[];
  flowIndex: { id: string; name: string; nodeCount: number }[];
  appConfig: unknown;
  exportTarget: string;
  themeTokens: Record<string, string>;
  generatedFiles: string[];
  errors: string[];
  capabilities: unknown[];
  availableActions: string[];
  installedSkills: string[];
};

type Trace = {
  commands: { command: string; output: string; exitCode: number | null }[];
  files: string[];
  diff: string;
  tests: { command: string; passed: boolean; output: string }[];
};
type CodexJob = {
  id: string;
  status: "running" | "completed" | "error" | "cancelled" | "restored";
  output: string;
  errors: string;
  changedFiles: string[];
  git?: { status?: string; diff?: string };
};

function readOutput(raw: string, git?: { status?: string; diff?: string }) {
  const events = raw.split("\n").flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const messages = events
    .filter((event) => event.item?.type === "agent_message" && event.item.text)
    .map((event) => event.item.text as string);
  const commands = events
    .filter(
      (event) =>
        event.item?.type === "command_execution" &&
        event.item.status === "completed",
    )
    .map((event) => ({
      command: String(event.item.command ?? ""),
      output: String(event.item.aggregated_output ?? ""),
      exitCode:
        typeof event.item.exit_code === "number" ? event.item.exit_code : null,
    }));
  const tests = commands
    .filter((item) =>
      /(?:npm|pnpm|yarn|npx)\s+(?:run\s+)?(?:test|check|lint|typecheck|build)|pytest|vitest|playwright/i.test(
        item.command,
      ),
    )
    .map((item) => ({
      command: item.command,
      passed: item.exitCode === 0,
      output: item.output,
    }));
  return {
    text: messages.join("\n\n") || raw || "Codex non ha restituito testo.",
    trace: {
      commands,
      tests,
      files: String(git?.status ?? "")
        .split("\n")
        .filter(Boolean),
      diff: String(git?.diff ?? ""),
    } as Trace,
  };
}

export function CodexPanel({
  open,
  context,
  suggestedPrompt,
  captureEvidence,
  onClose,
}: {
  open: boolean;
  context?: CodexContext;
  suggestedPrompt: string;
  captureEvidence?: () => Promise<{ dataUrl: string }>;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState(suggestedPrompt);
  const [status, setStatus] = useState("Controllo accesso…");
  const [workspace, setWorkspace] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loginSession, setLoginSession] = useState<string>();
  const [authBusy, setAuthBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState("");
  const [history, setHistory] = useState<
    { role: "user" | "codex" | "system"; text: string }[]
  >([]);
  const [view, setView] = useState<"chat" | "timeline" | "operations" | "files" | "tests">(
    "chat",
  );
  const [trace, setTrace] = useState<Trace>({
    commands: [],
    files: [],
    diff: "",
    tests: [],
  });
  const [job, setJob] = useState<CodexJob>();
  const [liveText, setLiveText] = useState("");
  const [timeline, setTimeline] = useState<CodexTimelineEntry[]>([]);
  const contextProjectId = context?.projectId;
  useEffect(() => {
    setPrompt(suggestedPrompt);
  }, [suggestedPrompt]);
  useEffect(() => {
    if (!contextProjectId) return;
    try {
      setHistory(
        JSON.parse(
          localStorage.getItem(
            `frontend-editor-codex-history:${contextProjectId}`,
          ) || "[]",
        ),
      );
    } catch {
      setHistory([]);
    }
  }, [contextProjectId]);
  useEffect(() => {
    if (!contextProjectId) return;
    void listCodexTimeline(contextProjectId).then(setTimeline).catch(() => setTimeline([]));
  }, [contextProjectId]);
  useEffect(() => {
    if (contextProjectId)
      localStorage.setItem(
        `frontend-editor-codex-history:${contextProjectId}`,
        JSON.stringify(history.slice(-80)),
      );
  }, [history, contextProjectId]);
  useEffect(() => {
    if (!open) return;
    fetch("/api/codex/status")
      .then((response) => response.json())
      .then((value) => {
        setAuthenticated(Boolean(value.authenticated));
        setStatus(
          value.authenticated
            ? value.message || "Accesso attivo"
            : value.message || "Connect your ChatGPT account here; no terminal is required.",
        );
        setWorkspace(value.workspace || "");
      })
      .catch(() => setStatus("Bridge locale non raggiungibile"));
  }, [open]);
  const refreshAuth = async () => {
    const value = await fetch("/api/codex/status").then((response) => response.json());
    setAuthenticated(Boolean(value.authenticated));
    setStatus(value.authenticated ? value.message || "Accesso attivo" : "Accesso richiesto");
  };
  const login = async (deviceAuth = false) => {
    setAuthBusy(true);
    setStatus(deviceAuth ? "Codice dispositivo in preparazione…" : "Apertura accesso ChatGPT…");
    try {
      const response = await fetch("/api/codex/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceAuth }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Accesso non avviato");
      setLoginSession(value.sessionId);
      let session;
      do {
        await new Promise((resolve) => setTimeout(resolve, 500));
        session = await fetch(`/api/codex/login/${value.sessionId}`).then((result) => result.json());
        setStatus(session.output || session.errors || "Completa l’accesso nel browser…");
      } while (session.status === "running");
      if (session.status !== "completed") throw new Error(session.errors || `Accesso ${session.status}`);
      await refreshAuth();
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
    finally { setAuthBusy(false); setLoginSession(undefined); }
  };
  const logout = async () => {
    const response = await fetch("/api/codex/logout", { method: "POST" }), value = await response.json();
    if (!response.ok) return setStatus(value.error || "Logout non riuscito");
    await refreshAuth();
  };
  const execute = async (mode: "plan" | "apply") => {
    if (!context || !prompt.trim()) return;
    if (mode === "apply") setPlan("");
    setBusy(true);
    const startedAt = new Date().toISOString();
    const beforeScreenshot = mode === "apply"
      ? await captureEvidence?.().then((value) => value.dataUrl).catch(() => undefined)
      : undefined;
    let timelineId: string = crypto.randomUUID();
    setLiveText(mode === "plan" ? "Analysis in corso…" : "Applicazione in corso…");
    if (mode === "plan")
      setHistory((items) => [
        ...items,
        { role: "user", text: prompt },
        { role: "system", text: "Analysis in sola lettura avviata…" },
      ]);
    try {
      const response = await fetch("/api/codex/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt,
          context,
          approvedPlan: mode === "apply" ? plan : undefined,
          projectId: context.projectId,
          revision: context.revision,
        }),
      });
      let value = await response.json();
      if (!response.ok)
        throw new Error(
          value.error || value.errors || "Operation failed",
        );
      timelineId = String(value.jobId ?? timelineId);
      const runningEntry: CodexTimelineEntry = {
        id: timelineId,
        projectId: context.projectId,
        componentId: context.componentId,
        componentName: context.componentName,
        prompt,
        revision: context.revision,
        mode,
        status: "running",
        startedAt,
        output: "",
        errors: "",
        changedFiles: [],
        tests: [],
        ...(beforeScreenshot ? { beforeScreenshot } : {}),
      };
      await saveCodexTimelineEntry(runningEntry);
      setTimeline((items) => [runningEntry, ...items.filter((item) => item.id !== timelineId)]);
      let current: CodexJob;
      do {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const update = await fetch(`/api/codex/jobs/${value.jobId}`);
        current = await update.json();
        if (!update.ok) throw new Error(current.errors || "Stato operazione non disponibile");
        setJob(current);
        const progress = readOutput(current.output, current.git);
        setLiveText(progress.text);
        setTrace(progress.trace);
      } while (current.status === "running");
      if (current.status !== "completed") throw new Error(current.errors || `Operazione ${current.status}`);
      value = current;
      const parsed = readOutput(value.output, value.git);
      const text = parsed.text;
      const afterScreenshot = mode === "apply"
        ? await captureEvidence?.().then((result) => result.dataUrl).catch(() => undefined)
        : undefined;
      const completedEntry: CodexTimelineEntry = {
        ...runningEntry,
        status: "completed",
        finishedAt: new Date().toISOString(),
        output: text,
        errors: value.errors ?? "",
        changedFiles: value.changedFiles ?? [],
        tests: parsed.trace.tests,
        ...(afterScreenshot ? { afterScreenshot } : {}),
      };
      await saveCodexTimelineEntry(completedEntry);
      setTimeline((items) => [completedEntry, ...items.filter((item) => item.id !== timelineId)]);
      setTrace(parsed.trace);
      if (mode === "plan") setPlan(text);
      setHistory((items) => [
        ...items.filter((item) => !item.text.endsWith("avviata…")),
        { role: "codex", text },
      ]);
    } catch (error) {
      if (context) {
        const failedEntry: CodexTimelineEntry = {
          id: timelineId,
          projectId: context.projectId,
          componentId: context.componentId,
          componentName: context.componentName,
          prompt,
          revision: context.revision,
          mode,
          status: "error",
          startedAt,
          finishedAt: new Date().toISOString(),
          output: "",
          errors: error instanceof Error ? error.message : String(error),
          changedFiles: [],
          tests: [],
          ...(beforeScreenshot ? { beforeScreenshot } : {}),
        };
        await saveCodexTimelineEntry(failedEntry).catch(() => undefined);
        setTimeline((items) => [failedEntry, ...items.filter((item) => item.id !== timelineId)]);
      }
      setHistory((items) => [
        ...items.filter((item) => !item.text.endsWith("avviata…")),
        {
          role: "system",
          text: error instanceof Error ? error.message : String(error),
        },
      ]);
    } finally {
      setBusy(false);
      setLiveText("");
    }
  };
  const restore = async () => {
    if (!job) return;
    const response = await fetch(`/api/codex/jobs/${job.id}/restore`, { method: "POST" });
    const value = await response.json();
    if (!response.ok) return setHistory((items) => [...items, { role: "system", text: value.error || "Ripristino non riuscito" }]);
    setJob({ ...job, status: "restored" });
    const entry = timeline.find((item) => item.id === job.id);
    if (entry) {
      const restoredEntry = { ...entry, status: "restored" as const, finishedAt: new Date().toISOString() };
      await saveCodexTimelineEntry(restoredEntry);
      setTimeline((items) => items.map((item) => item.id === job.id ? restoredEntry : item));
    }
    setHistory((items) => [...items, { role: "system", text: `Operation restored: ${value.restored.length} file riportati allo stato precedente.` }]);
  };
  if (!open) return null;
  return (
    <section className="codex-panel" aria-label="Codex assistant">
      <header>
        <div>
          <span className="codex-mark">⌘</span>
          <strong>Codex</strong>
          <small
            className={
              status.includes("attivo") || status.includes("Logged")
                ? "online"
                : ""
            }
          >
            {busy ? "Working…" : status}
          </small>
        </div>
        <div>
          {job?.status === "completed" && job.changedFiles.length > 0 && (
            <button className="secondary" data-help="Ripristina tutti e soli i file modificati da questa operazione. Si ferma se rileva modifiche successive." onClick={() => void restore()}>
              Restore
            </button>
          )}
          <button
            data-help="Interrompe l’operazione Codex attualmente in esecuzione."
            className="secondary"
            disabled={!busy || !job}
            onClick={() =>
              job && void fetch(`/api/codex/jobs/${job.id}/cancel`, { method: "POST" })
            }
          >
            Cancel
          </button>
          <button
            data-help="Chiude il pannello. La cronologia resta disponibile finché il progetto è aperto."
            className="icon-button"
            aria-label="Close Codex panel"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </header>
      <nav className="codex-tabs" aria-label="Codex operation details">
        {(
          [
            [
              "chat",
              "Conversation",
              "Read the request, response, and plan in plain language.",
            ],
            [
              "timeline",
              "Timeline",
              "Review requests, revisions, screenshots, files, and tests after restarting.",
            ],
            [
              "operations",
              "Operations",
              "Show commands run by the controlled local process.",
            ],
            [
              "files",
              "Files and diff",
              "Show changed files and differences from Git.",
            ],
            [
              "tests",
              "Tests",
              "Show automatic checks and their results.",
            ],
          ] as const
        ).map(([id, label, help]) => (
          <button
            data-help={help}
            className={view === id ? "active" : ""}
            key={id}
            onClick={() => setView(id)}
          >
            {label}
            {id === "operations" && trace.commands.length > 0 && (
              <span>{trace.commands.length}</span>
            )}
            {id === "timeline" && timeline.length > 0 && <span>{timeline.length}</span>}
            {id === "files" && trace.files.length > 0 && (
              <span>{trace.files.length}</span>
            )}
            {id === "tests" && trace.tests.length > 0 && (
              <span>{trace.tests.length}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="codex-body">
        <aside>
          <p className="eyebrow">Stable context</p>
          {context ? (
            <>
              <strong>{context.componentName}</strong>
              <span>
                {context.componentType} · rev. {context.revision}
              </span>
              <code>{context.componentId}</code>
              <dl>
                <div>
                  <dt>Page</dt>
                  <dd>{context.treePath[0]}</dd>
                </div>
                <div>
                  <dt>Flow</dt>
                  <dd>{context.flows.length}</dd>
                </div>
                <div>
                  <dt>Data</dt>
                  <dd>{context.dataSources.length}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p>Select an element and right-click it.</p>
          )}
          <small>Local workspace</small>
          <code>{workspace || "unavailable"}</code>
          <div className="codex-auth" aria-label="Codex access">
            <small>
              {authenticated
                ? "Your account is connected and reused on future launches through the official Codex sign-in."
                : "Local actions remain available. Connect ChatGPT here for new and complex requests; no terminal is needed."}
            </small>
            {authenticated ? (
              <button className="secondary" data-help="Signs out through the official codex logout command. Kyro never reads your credentials." onClick={() => void logout()}>Sign out of Codex</button>
            ) : (
              <>
                <button disabled={authBusy} data-help="Avvia il login ufficiale Codex e apre la pagina Sign in with ChatGPT nel browser." onClick={() => void login(false)}>{authBusy ? "Accesso in corso…" : "Accedi con ChatGPT"}</button>
                <button className="secondary" disabled={authBusy} data-help="Mostra il flusso con codice dispositivo quando il browser non può tornare automaticamente all'app." onClick={() => void login(true)}>Use device code</button>
              </>
            )}
            {authBusy && loginSession && <button className="danger" onClick={() => void fetch(`/api/codex/login/${loginSession}/cancel`, { method: "POST" })}>Cancel sign-in</button>}
          </div>
        </aside>
        <main>
          <div className="codex-history" aria-live="polite">
            {view === "chat" &&
              (history.length === 0 ? (
                <div className="codex-welcome">
                  <strong>Tell me what this element should do.</strong>
                  <p>
                    I will first analyze the project in read-only mode. You can
                    approve or reject the plan before anything changes.
                  </p>
                </div>
              ) : (
                history.map((message, index) => (
                  <article className={message.role} key={index}>
                    <strong>
                      {message.role === "user"
                        ? "You"
                        : message.role === "codex"
                          ? "Codex"
                          : "Status"}
                    </strong>
                    <pre>{message.text}</pre>
                  </article>
                ))
              ))}
            {view === "chat" && busy && (
              <article className="system">
                <strong>Live</strong>
                <pre>{liveText}</pre>
              </article>
            )}
            {view === "operations" && (
              <TraceList
                empty="No commands executed."
                items={trace.commands.map((item) => ({
                  title: item.exitCode === 0 ? "Completed" : "Error",
                  body: `${item.command}\n${item.output}`,
                }))}
              />
            )}
            {view === "timeline" && (
              timeline.length ? (
                <div className="codex-timeline">
                  {timeline.map((entry) => (
                    <article key={entry.id}>
                      <header>
                        <strong>{entry.mode === "apply" ? "Change" : "Analysis"} · {entry.componentName}</strong>
                        <span className={`timeline-status ${entry.status}`}>{entry.status}</span>
                      </header>
                      <p>{entry.prompt}</p>
                      <small>Revisione {entry.revision} · {new Date(entry.startedAt).toLocaleString()}</small>
                      {(entry.beforeScreenshot || entry.afterScreenshot) && (
                        <div className="timeline-images">
                          {entry.beforeScreenshot && <figure><img src={entry.beforeScreenshot} alt="Prima della richiesta Codex" /><figcaption>Prima</figcaption></figure>}
                          {entry.afterScreenshot && <figure><img src={entry.afterScreenshot} alt="Dopo la richiesta Codex" /><figcaption>Dopo</figcaption></figure>}
                        </div>
                      )}
                      <span>{entry.changedFiles.length} file · {entry.tests.filter((item) => item.passed).length}/{entry.tests.length} test superati</span>
                    </article>
                  ))}
                </div>
              ) : <div className="codex-welcome"><strong>No operations recorded.</strong><p>Every request is saved here with evidence and revision.</p></div>
            )}
            {view === "files" && (
              <>
                <TraceList
                  empty="No files changed."
                  items={trace.files.map((item) => ({
                    title: item.slice(0, 2).trim() || "File",
                    body: item.slice(3),
                  }))}
                />
                {trace.diff && <pre className="code-diff">{trace.diff}</pre>}
              </>
            )}
            {view === "tests" && (
              <TraceList
                empty="Codex non ha ancora eseguito test."
                items={trace.tests.map((item) => ({
                  title: item.passed ? "✓ Test superato" : "✕ Test fallito",
                  body: `${item.command}\n${item.output}`,
                }))}
              />
            )}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setView("chat");
              void execute("plan");
            }}
          >
            <label htmlFor="codex-request">
              Request in plain language
            </label>
            <textarea
              autoFocus
              id="codex-request"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Example: when I click, save the input value and refresh the list."
              rows={3}
              maxLength={8000}
            />
            <div>
              <span>{prompt.length}/8000</span>
              <button disabled={busy || !context || !prompt.trim()}>
                {busy ? "Codex is analyzing…" : "Analyze request"}
              </button>
            </div>
          </form>
          {plan && (
            <section className="approval-card">
              <p className="eyebrow">Plan to approve</p>
              <p>
                Codex worked in read-only mode. Approve only when the plan
                matches what you want.
              </p>
              <div>
                <button
                  className="secondary"
                  onClick={() => {
                    setPlan("");
                    setHistory((items) => [
                      ...items,
                      {
                        role: "system",
                        text: "Plan rejected. No changes were applied.",
                      },
                    ]);
                  }}
                >
                  Reject
                </button>
                <button disabled={busy} onClick={() => void execute("apply")}>
                  Approve and apply
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </section>
  );
}

function TraceList({
  items,
  empty,
}: {
  items: { title: string; body: string }[];
  empty: string;
}) {
  return items.length ? (
    <div className="trace-list">
      {items.map((item, index) => (
        <article key={index}>
          <strong>{item.title}</strong>
          <pre>{item.body}</pre>
        </article>
      ))}
    </div>
  ) : (
    <div className="codex-welcome">
      <strong>{empty}</strong>
      <p>
        Questa sezione si aggiorna automaticamente dopo l’analisi o
        l’applicazione.
      </p>
    </div>
  );
}
