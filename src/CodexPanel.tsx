import { useEffect, useState } from "react";

export type CodexContext = {
  projectId: string;
  pageId: string;
  revision: number;
  componentId: string;
  componentName: string;
  componentType: string;
  treePath: string[];
  bounds: { x: number; y: number; width: number; height: number };
  properties: Record<string, unknown>;
  styles: Record<string, unknown>;
  events: Record<string, string>;
  binding?: Record<string, unknown>;
  dataSources: unknown[];
  flows: unknown[];
  nearbyComponents: { id: string; name: string; type: string }[];
  generatedFiles: string[];
  errors: string[];
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
  onClose,
}: {
  open: boolean;
  context?: CodexContext;
  suggestedPrompt: string;
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
  const [view, setView] = useState<"chat" | "operations" | "files" | "tests">(
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
            : "Accesso richiesto: usa “codex login” nel terminale locale",
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
    setBusy(true);
    setLiveText(mode === "plan" ? "Analisi in corso…" : "Applicazione in corso…");
    if (mode === "plan")
      setHistory((items) => [
        ...items,
        { role: "user", text: prompt },
        { role: "system", text: "Analisi in sola lettura avviata…" },
      ]);
    try {
      const response = await fetch("/api/codex/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt,
          context,
          projectId: context.projectId,
          revision: context.revision,
        }),
      });
      let value = await response.json();
      if (!response.ok)
        throw new Error(
          value.error || value.errors || "Operazione non riuscita",
        );
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
      setTrace(parsed.trace);
      if (mode === "plan") setPlan(text);
      setHistory((items) => [
        ...items.filter((item) => !item.text.endsWith("avviata…")),
        { role: "codex", text },
      ]);
    } catch (error) {
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
    setHistory((items) => [...items, { role: "system", text: `Operazione ripristinata: ${value.restored.length} file riportati allo stato precedente.` }]);
  };
  if (!open) return null;
  return (
    <section className="codex-panel" aria-label="Assistente Codex">
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
            {busy ? "Operazione in corso…" : status}
          </small>
        </div>
        <div>
          {job?.status === "completed" && job.changedFiles.length > 0 && (
            <button className="secondary" data-help="Ripristina tutti e soli i file modificati da questa operazione. Si ferma se rileva modifiche successive." onClick={() => void restore()}>
              Ripristina
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
            Annulla
          </button>
          <button
            data-help="Chiude il pannello. La cronologia resta disponibile finché il progetto è aperto."
            className="icon-button"
            aria-label="Chiudi pannello Codex"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </header>
      <nav className="codex-tabs" aria-label="Dettagli operazione Codex">
        {(
          [
            [
              "chat",
              "Conversazione",
              "Leggi richiesta, risposta e piano in parole semplici.",
            ],
            [
              "operations",
              "Operazioni",
              "Mostra i comandi eseguiti nel processo locale controllato.",
            ],
            [
              "files",
              "File e diff",
              "Mostra file modificati e differenze rispetto a Git.",
            ],
            [
              "tests",
              "Test",
              "Mostra i controlli automatici eseguiti e il loro risultato.",
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
          <p className="eyebrow">Contesto certo</p>
          {context ? (
            <>
              <strong>{context.componentName}</strong>
              <span>
                {context.componentType} · rev. {context.revision}
              </span>
              <code>{context.componentId}</code>
              <dl>
                <div>
                  <dt>Pagina</dt>
                  <dd>{context.treePath[0]}</dd>
                </div>
                <div>
                  <dt>Flow</dt>
                  <dd>{context.flows.length}</dd>
                </div>
                <div>
                  <dt>Dati</dt>
                  <dd>{context.dataSources.length}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p>Seleziona un elemento e usa il clic destro.</p>
          )}
          <small>Workspace locale</small>
          <code>{workspace || "non disponibile"}</code>
          <div className="codex-auth" aria-label="Accesso Codex">
            {authenticated ? (
              <button className="secondary" data-help="Disconnette l'account tramite il comando ufficiale codex logout. Frontend Editor non legge le credenziali." onClick={() => void logout()}>Esci da Codex</button>
            ) : (
              <>
                <button disabled={authBusy} data-help="Avvia il login ufficiale Codex e apre la pagina Sign in with ChatGPT nel browser." onClick={() => void login(false)}>{authBusy ? "Accesso in corso…" : "Accedi con ChatGPT"}</button>
                <button className="secondary" disabled={authBusy} data-help="Mostra il flusso con codice dispositivo quando il browser non può tornare automaticamente all'app." onClick={() => void login(true)}>Usa codice dispositivo</button>
              </>
            )}
            {authBusy && loginSession && <button className="danger" onClick={() => void fetch(`/api/codex/login/${loginSession}/cancel`, { method: "POST" })}>Annulla accesso</button>}
          </div>
        </aside>
        <main>
          <div className="codex-history" aria-live="polite">
            {view === "chat" &&
              (history.length === 0 ? (
                <div className="codex-welcome">
                  <strong>Dimmi cosa deve fare questo elemento.</strong>
                  <p>
                    Prima analizzerò il progetto in sola lettura. Potrai
                    approvare o rifiutare il piano prima di qualsiasi modifica.
                  </p>
                </div>
              ) : (
                history.map((message, index) => (
                  <article className={message.role} key={index}>
                    <strong>
                      {message.role === "user"
                        ? "Tu"
                        : message.role === "codex"
                          ? "Codex"
                          : "Stato"}
                    </strong>
                    <pre>{message.text}</pre>
                  </article>
                ))
              ))}
            {view === "chat" && busy && (
              <article className="system">
                <strong>In tempo reale</strong>
                <pre>{liveText}</pre>
              </article>
            )}
            {view === "operations" && (
              <TraceList
                empty="Nessun comando eseguito."
                items={trace.commands.map((item) => ({
                  title: item.exitCode === 0 ? "Completato" : "Errore",
                  body: `${item.command}\n${item.output}`,
                }))}
              />
            )}
            {view === "files" && (
              <>
                <TraceList
                  empty="Nessun file modificato."
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
              Richiesta in linguaggio naturale
            </label>
            <textarea
              autoFocus
              id="codex-request"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Esempio: quando clicco, salva il valore dell’input e aggiorna la lista."
              rows={3}
              maxLength={8000}
            />
            <div>
              <span>{prompt.length}/8000</span>
              <button disabled={busy || !context || !prompt.trim()}>
                {busy ? "Codex sta analizzando…" : "Analizza richiesta"}
              </button>
            </div>
          </form>
          {plan && (
            <section className="approval-card">
              <p className="eyebrow">Piano da approvare</p>
              <p>
                Codex ha lavorato in sola lettura. Approva solo se il piano
                corrisponde a ciò che vuoi.
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
                        text: "Piano rifiutato. Nessuna modifica applicata.",
                      },
                    ]);
                  }}
                >
                  Rifiuta
                </button>
                <button disabled={busy} onClick={() => void execute("apply")}>
                  Approva e applica
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
