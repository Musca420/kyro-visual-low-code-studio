import { FormEvent, useEffect, useRef, useState } from "react";

type SessionState = {
  sessionId: string;
  status: "running" | "closed" | "error";
  workspace: string;
};

export function TerminalPanel({ projectId }: { projectId: string }) {
  const [session, setSession] = useState<SessionState>();
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const cursor = useRef(0);
  const screen = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    const open = async () => {
      try {
        const response = await fetch("/api/terminal/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        const value = await response.json();
        if (!response.ok)
          throw new Error(value.error || "Terminale non disponibile");
        if (disposed) return;
        const next = value as SessionState;
        setSession(next);
        const poll = async () => {
          if (disposed) return;
          try {
            const result = await fetch(
              `/api/terminal/sessions/${next.sessionId}?projectId=${encodeURIComponent(projectId)}&cursor=${cursor.current}`,
            );
            const update = await result.json();
            if (!result.ok)
              throw new Error(update.error || "Sessione interrotta");
            cursor.current = Number(update.cursor);
            setOutput((current) =>
              update.reset
                ? String(update.output)
                : current + String(update.output),
            );
            setSession((current) =>
              current ? { ...current, status: update.status } : current,
            );
          } catch (problem) {
            setError(
              problem instanceof Error ? problem.message : String(problem),
            );
          }
          timer = window.setTimeout(poll, 350);
        };
        void poll();
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : String(problem));
      }
    };
    void open();
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [projectId]);

  useEffect(() => {
    screen.current?.scrollTo({ top: screen.current.scrollHeight });
  }, [output]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || !command.trim()) return;
    setError("");
    const response = await fetch(
      `/api/terminal/sessions/${session.sessionId}/input`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, command }),
      },
    );
    const value = await response.json();
    if (!response.ok) return setError(value.error || "Comando non accettato");
    setCommand("");
  };

  const close = async () => {
    if (!session) return;
    await fetch(`/api/terminal/sessions/${session.sessionId}/close`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
  };

  return (
    <main className="terminal-workspace">
      <header>
        <div>
          <p>STRUMENTO AVANZATO</p>
          <h1>Terminale del progetto</h1>
          <span>
            I comandi partono solo quando premi Esegui. La sessione resta nella
            cartella del workspace e le variabili che sembrano segreti non
            vengono ereditate.
          </span>
        </div>
        <div className={`terminal-status ${session?.status ?? "loading"}`}>
          <i /> {session?.status ?? "avvio"}
        </div>
      </header>
      <div className="terminal-path">
        <strong>Cartella</strong>
        <code>{session?.workspace ?? "Connessione al bridge locale…"}</code>
      </div>
      <pre ref={screen} aria-label="Output terminale" aria-live="polite">
        {output || "Avvio della sessione locale…"}
      </pre>
      {error && (
        <div className="terminal-error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={(event) => void submit(event)}>
        <label>
          Comando
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="Esempio: git status --short"
            autoComplete="off"
            disabled={session?.status !== "running"}
          />
        </label>
        <button
          type="submit"
          disabled={session?.status !== "running" || !command.trim()}
        >
          Esegui
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() => void close()}
          disabled={session?.status !== "running"}
        >
          Termina sessione
        </button>
      </form>
      <p className="terminal-note">
        La shell è locale e non viene esposta nell’export. Comandi di rete,
        privilegi o scritture esterne al workspace richiedono la stessa cautela
        di un terminale desktop.
      </p>
    </main>
  );
}
