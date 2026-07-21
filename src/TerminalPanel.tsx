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
  const [submitting, setSubmitting] = useState(false);
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
          throw new Error(value.error || "Terminal is unavailable");
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
              throw new Error(update.error || "Session interrupted");
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
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/terminal/sessions/${session.sessionId}/input`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ projectId, command }),
        },
      );
      const value = await response.json();
      if (!response.ok) return setError(value.error || "Command was not accepted");
      setCommand("");
    } finally {
      setSubmitting(false);
    }
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
          <p>ADVANCED TOOL</p>
          <h1>Project tasks</h1>
          <span>
            Run allow-listed development tasks inside this project. Kyro does
            not open a system shell, inherit secrets, or accept shell operators.
          </span>
        </div>
        <div className={`terminal-status ${session?.status ?? "loading"}`}>
          <i /> {session?.status ?? "starting"}
        </div>
      </header>
      <div className="terminal-path">
        <strong>Folder</strong>
        <code>{session?.workspace ?? "Connecting to the local bridge…"}</code>
      </div>
      <pre ref={screen} aria-label="Terminal output" aria-live="polite">
        {output || "Starting the local session…"}
      </pre>
      {error && (
        <div className="terminal-error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={(event) => void submit(event)}>
        <label>
          Command
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="Example: npm run check"
            autoComplete="off"
            disabled={session?.status !== "running" || submitting}
          />
        </label>
        <button
          type="submit"
          disabled={session?.status !== "running" || submitting || !command.trim()}
        >
          Run
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() => void close()}
          disabled={session?.status !== "running"}
        >
          End session
        </button>
      </form>
      <p className="terminal-note">
        Allowed: project Node scripts, npm/pnpm run, TypeScript, Vitest,
        Playwright, git status and git diff. Dependencies and network tools need
        a separate reviewed approval.
      </p>
    </main>
  );
}
