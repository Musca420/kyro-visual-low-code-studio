import { useEffect, useMemo, useRef, useState } from "react";
import {
  listCodexTimeline,
  listArtifacts,
  saveArtifact,
  saveCodexTimelineEntry,
  type CodexTimelineEntry,
} from "./db";
import { parseAgentPlan } from "./agentPlan";
import { parseAgentApply } from "./agentApply";
import { summarizeAgentPlan } from "./changeSummary";
import type { CapabilityProposal } from "./globalCapability";
import type { GlobalCapability } from "./globalCapability";
import type { VerificationReport } from "./verification";
import { createArtifact, createScreenshotArtifact, verifyArtifact, type ArtifactRecord } from "./artifactRegistry";
import { readOutput, type Trace } from "./codex/readOutput";
import { TraceList } from "./codex/TraceList";

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
  globalCapabilities: GlobalCapability[];
};
type CodexJob = {
  id: string;
  projectId?: string;
  mode?: "plan" | "apply";
  status: "running" | "completed" | "error" | "cancelled" | "restored";
  output: string;
  errors: string;
  warnings?: string;
  changedFiles: string[];
  threadId?: string;
  transactionId?: string;
  contextHash?: string;
  contextBytes?: number;
  usage?: { inputTokens: number; cachedInputTokens: number; outputTokens: number; reasoningOutputTokens: number; totalTokens: number };
  learningCandidate?: { kind: "reusable_flow" | "typed_module" | "plugin"; name: string; generalizedIntent: string; inputs: string[]; outputs: string[]; activation: "passing_tests" | "explicit_review" } | null;
  capabilityProposal?: CapabilityProposal | null;
  attempts?: number;
  parentJobId?: string;
  stopReason?: "cancelled" | "timeout" | "interrupted";
  git?: { status?: string; diff?: string };
};

export function CodexPanel({
  open,
  context,
  suggestedPrompt,
  clientId,
  captureEvidence,
  onClose,
}: {
  open: boolean;
  context?: CodexContext;
  suggestedPrompt: string;
  clientId: string;
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
  const [planThreadId, setPlanThreadId] = useState("");
  const parsedPlan = useMemo(() => parseAgentPlan(plan), [plan]);
  const planSummary = parsedPlan ? summarizeAgentPlan(parsedPlan) : undefined;
  const approvalHeading = useRef<HTMLHeadingElement>(null);
  const [verification, setVerification] = useState<VerificationReport>();
  const [history, setHistory] = useState<
    { role: "user" | "codex" | "system"; text: string }[]
  >([]);
  const [view, setView] = useState<"chat" | "timeline" | "evidence" | "operations" | "files" | "tests">(
    "chat",
  );
  const [trace, setTrace] = useState<Trace>({
    commands: [],
    files: [],
    diff: "",
    tests: [],
  });
  const [job, setJob] = useState<CodexJob>();
  const activeJobId = job?.id;
  const activeJobStatus = job?.status;
  const [liveText, setLiveText] = useState("");
  const [timeline, setTimeline] = useState<CodexTimelineEntry[]>([]);
  const [artifacts, setArtifacts] = useState<(ArtifactRecord & { integrity: boolean })[]>([]);
  const contextProjectId = context?.projectId;
  useEffect(() => {
    if (!plan || !parsedPlan) return;
    window.requestAnimationFrame(() => approvalHeading.current?.focus());
  }, [plan, parsedPlan]);
  useEffect(() => {
    if (!job?.transactionId || job.status !== "completed") {
      setVerification(undefined);
      return;
    }
    void fetch(`/api/live/transactions/${job.transactionId}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Verification unavailable")))
      .then((value) => setVerification(value.result?.verification ?? value.verification))
      .catch(() => setVerification(undefined));
  }, [job?.status, job?.transactionId]);
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
    void listArtifacts(contextProjectId).then(async (items) => setArtifacts(await Promise.all(items.map(async (item) => ({ ...item, integrity: (await verifyArtifact(item)).passed }))))).catch(() => setArtifacts([]));
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
            ? value.message || "Signed in"
            : value.message || "Connect your ChatGPT account here; no terminal is required.",
        );
        setWorkspace(value.workspace || "");
      })
      .catch(() => setStatus("Local bridge unavailable"));
  }, [open]);
  useEffect(() => {
    if (!open || !contextProjectId) return;
    void fetch("/api/codex/jobs").then((response) => response.json()).then((items: CodexJob[]) => {
      const latest = items.find((item) => item.projectId === contextProjectId);
      if (latest) setJob(latest);
    }).catch(() => undefined);
  }, [open, contextProjectId]);
  useEffect(() => {
    if (!open || !activeJobId || activeJobStatus !== "running") return;
    setBusy(true);
    const timer = window.setInterval(() => {
      void fetch(`/api/codex/jobs/${activeJobId}`).then((response) => response.json()).then((value: CodexJob) => {
        setJob(value);
        const progress = readOutput(value.output, value.git);
        if (progress.text) setLiveText(progress.text);
        setTrace(progress.trace);
        if (value.status !== "running") {
          setBusy(false);
          setLiveText("");
          if (value.status === "completed" && value.mode === "plan") {
            const text = readOutput(value.output, value.git).text;
            if (text) {
              setPlan(text);
              setPlanThreadId(value.threadId ?? "");
            }
          }
        }
      }).catch(() => undefined);
    }, 500);
    return () => window.clearInterval(timer);
  }, [open, activeJobId, activeJobStatus]);
  const refreshAuth = async () => {
    const value = await fetch("/api/codex/status").then((response) => response.json());
    setAuthenticated(Boolean(value.authenticated));
    setStatus(value.authenticated ? value.message || "Signed in" : "Sign-in required");
  };
  const login = async (deviceAuth = false) => {
    setAuthBusy(true);
    setStatus(deviceAuth ? "Codice dispositivo in preparazione…" : "Apertura accesso ChatGPT…");
    try {
      const response = await fetch("/api/codex/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceAuth }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Sign-in did not start");
      setLoginSession(value.sessionId);
      let session;
      do {
        await new Promise((resolve) => setTimeout(resolve, 500));
        session = await fetch(`/api/codex/login/${value.sessionId}`).then((result) => result.json());
        setStatus(session.output || session.errors || "Complete sign-in in the browser…");
      } while (session.status === "running");
      if (session.status !== "completed") throw new Error(session.errors || `Sign-in ${session.status}`);
      await refreshAuth();
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
    finally { setAuthBusy(false); setLoginSession(undefined); }
  };
  const logout = async () => {
    const response = await fetch("/api/codex/logout", { method: "POST" }), value = await response.json();
    if (!response.ok) return setStatus(value.error || "Sign-out failed");
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
    setLiveText(mode === "plan" ? "Analysis in progress…" : "Applying changes…");
    if (mode === "plan")
      setHistory((items) => [
        ...items,
        { role: "user", text: prompt },
      ]);
    try {
      const response = await fetch("/api/codex/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt,
          context,
          focus: { kind: "component", pageId: context.pageId, componentId: context.componentId },
          approvedPlan: mode === "apply" ? plan : undefined,
          threadId: mode === "apply" ? planThreadId : undefined,
          projectId: context.projectId,
          revision: context.revision,
          clientId,
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
        if (!update.ok) throw new Error(current.errors || "Operation status unavailable");
        setJob(current);
        const progress = readOutput(current.output, current.git);
        if (progress.text) setLiveText(progress.text);
        setTrace(progress.trace);
      } while (current.status === "running");
      if (current.status !== "completed") throw new Error(current.errors || `Operazione ${current.status}`);
      value = current;
      const parsed = readOutput(value.output, value.git);
      const text = parsed.text;
      if (!text.trim()) throw new Error("Codex completed without a response. Retry the request.");
      const completedPlan = mode === "plan" ? parseAgentPlan(text) : undefined;
      const capabilityProposal = completedPlan?.capabilityProposal ?? undefined;
      const afterScreenshot = mode === "apply"
        ? await captureEvidence?.().then((result) => result.dataUrl).catch(() => undefined)
        : undefined;
      const completedEntry: CodexTimelineEntry = {
        ...runningEntry,
        status: "completed",
        finishedAt: new Date().toISOString(),
        output: text,
        errors: value.errors ?? "",
        ...(value.warnings ? { warnings: value.warnings } : {}),
        changedFiles: value.changedFiles ?? [],
        tests: parsed.trace.tests,
        ...(value.transactionId ? { transactionId: value.transactionId } : {}),
        ...(value.contextHash ? { contextHash: value.contextHash, contextBytes: value.contextBytes } : {}),
        ...(value.usage ? { usage: value.usage } : {}),
        ...(value.learningCandidate ? { learningCandidate: value.learningCandidate } : {}),
        ...(capabilityProposal ? { capabilityProposal } : {}),
        ...(afterScreenshot ? { afterScreenshot } : {}),
      };
      await saveCodexTimelineEntry(completedEntry);
      let evidenceWarning = "";
      if (mode === "apply" && value.transactionId) {
        try {
          const provenance = { actor: "codex" as const, source: "codex" as const, revision: context.revision + 1, jobId: timelineId, transactionId: value.transactionId };
          const evidence = [
            ...(beforeScreenshot ? [await createScreenshotArtifact({ projectId: context.projectId, name: "Canvas before Codex change", dataUrl: beforeScreenshot, provenance: { ...provenance, phase: "before" }, createdAt: startedAt })] : []),
            ...(afterScreenshot ? [await createScreenshotArtifact({ projectId: context.projectId, name: "Canvas after Codex change", dataUrl: afterScreenshot, provenance: { ...provenance, phase: "after" } })] : []),
            await createArtifact({ projectId: context.projectId, kind: "trace", name: "Codex operation trace", mediaType: "application/json", payload: JSON.stringify(parsed.trace), provenance: { ...provenance, phase: "result" } }),
          ];
          await Promise.all(evidence.map(saveArtifact));
          const items = await listArtifacts(context.projectId);
          setArtifacts(await Promise.all(items.map(async (item) => ({ ...item, integrity: (await verifyArtifact(item)).passed }))));
        } catch (error) {
          evidenceWarning = `\nThe change succeeded, but its additional evidence could not be registered: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      setTimeline((items) => [completedEntry, ...items.filter((item) => item.id !== timelineId)]);
      setTrace(parsed.trace);
      if (mode === "plan") {
        setPlan(text);
        setPlanThreadId(String(value.threadId ?? ""));
      }
      const appliedResult = mode === "apply" ? parseAgentApply(text) : undefined;
      if (appliedResult) {
        setPlan("");
        setPlanThreadId("");
      }
      const plainResult = completedPlan
        ? `${completedPlan.summary}\nReview the proposed scope, checks, and authorization before applying anything.`
        : appliedResult
          ? `${appliedResult.summary}\n${appliedResult.visualResult}`
          : text;
      setHistory((items) => [
        ...items,
        { role: "codex", text: `${plainResult}${evidenceWarning}` },
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
        ...items,
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
    if (!response.ok) return setHistory((items) => [...items, { role: "system", text: value.error || "Restore failed" }]);
    setJob({ ...job, status: "restored" });
    setVerification(undefined);
    const entry = timeline.find((item) => item.id === job.id);
    if (entry) {
      const restoredEntry = { ...entry, status: "restored" as const, finishedAt: new Date().toISOString() };
      await saveCodexTimelineEntry(restoredEntry);
      setTimeline((items) => items.map((item) => item.id === job.id ? restoredEntry : item));
    }
    setHistory((items) => [...items, { role: "system", text: "The approved visual transaction was undone." }]);
  };
  const rejectPlan = () => {
    setPlan("");
    setHistory((items) => [...items, { role: "system", text: "Plan rejected. No changes were applied." }]);
  };
  const continueJob = async (action: "resume" | "retry" | "restart") => {
    if (!job) return;
    setBusy(true);
    const response = await fetch(`/api/codex/jobs/${job.id}/${action}`, { method: "POST" });
    const value = await response.json();
    if (!response.ok) {
      setBusy(false);
      return setHistory((items) => [...items, { role: "system", text: value.error || `${action} failed` }]);
    }
    const next = await fetch(`/api/codex/jobs/${value.jobId}`).then((result) => result.json());
    setJob(next);
    setHistory((items) => [...items, { role: "system", text: value.reused ? "The completed Job was reused safely." : `${action[0].toUpperCase()}${action.slice(1)} started as attempt ${next.attempts ?? 1}.` }]);
    if (next.status !== "running") setBusy(false);
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
              status.includes("Signed") || status.includes("Logged")
                ? "online"
                : ""
            }
          >
            {busy ? "Working…" : status}
          </small>
        </div>
        <div>
          {!busy && job?.status === "completed" && job.transactionId && (
            <button className="secondary" data-help="Undo this visual transaction. Kyro stops if later graph changes exist." onClick={() => void restore()}>
              Undo change
            </button>
          )}
          {(job?.status === "error" || job?.status === "cancelled") && (
            <>
              {job.threadId && <button className="secondary" onClick={() => void continueJob("resume")}>Resume</button>}
              <button className="secondary" onClick={() => void continueJob("retry")}>Retry</button>
              <button className="secondary" onClick={() => void continueJob("restart")}>Restart</button>
            </>
          )}
          <button
            data-help="Stop the Codex operation currently running."
            className="secondary"
            disabled={!busy || !job}
            onClick={() =>
              job && void fetch(`/api/codex/jobs/${job.id}/cancel`, { method: "POST" })
            }
          >
            Cancel
          </button>
          <button
            data-help="Closes the panel. History remains available while the project is open."
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
              "evidence",
              "Evidence",
              "Verify hashed reports, screenshots, traces, builds, and exports.",
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
            {id === "evidence" && artifacts.length > 0 && <span>{artifacts.length}</span>}
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
                <button disabled={authBusy} data-help="Start the official Codex sign-in and open Sign in with ChatGPT in the browser." onClick={() => void login(false)}>{authBusy ? "Signing in…" : "Sign in with ChatGPT"}</button>
                <button className="secondary" disabled={authBusy} data-help="Shows the device-code flow when the browser cannot return to the app automatically." onClick={() => void login(true)}>Use device code</button>
              </>
            )}
            {authBusy && loginSession && <button className="danger" onClick={() => void fetch(`/api/codex/login/${loginSession}/cancel`, { method: "POST" })}>Cancel sign-in</button>}
          </div>
        </aside>
        <main>
          <div className="codex-history" aria-live="polite">
            {view === "chat" && verification && (
              <section className="change-result" aria-label="Change verification result">
                <div><span aria-hidden="true">✓</span><div><strong>Change verified</strong><p>Kyro applied one authorized revision and checked the result before saving it.</p></div></div>
                <ul>
                  {verification.stages.filter((stage) => stage.required).map((stage) => (
                    <li key={stage.name}><span>{stage.name}</span><strong>{stage.status === "passed" ? "Passed" : "Failed"}</strong></li>
                  ))}
                </ul>
                <small>{verification.stages.flatMap((stage) => stage.evidence).filter((item) => item.hash).length} reproducible evidence hashes · revision {verification.finalRevision}</small>
                {job?.status === "completed" && job.transactionId && <button className="secondary" onClick={() => void restore()}>Undo this change</button>}
              </section>
            )}
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
                      <small>Revision {entry.revision} · {new Date(entry.startedAt).toLocaleString()}</small>
                      {(entry.beforeScreenshot || entry.afterScreenshot) && (
                        <div className="timeline-images">
                          {entry.beforeScreenshot && <figure><img src={entry.beforeScreenshot} alt="Before the Codex request" /><figcaption>Before</figcaption></figure>}
                          {entry.afterScreenshot && <figure><img src={entry.afterScreenshot} alt="After the Codex request" /><figcaption>After</figcaption></figure>}
                        </div>
                      )}
                      <span>{entry.transactionId ? `Transaction ${entry.transactionId.slice(0, 8)} · ` : ""}{entry.contextBytes ? `${entry.contextBytes} B context · ` : ""}{entry.usage ? `${entry.usage.totalTokens} tokens · ` : ""}{entry.tests.filter((item) => item.passed).length}/{entry.tests.length} checks passed</span>
                      {entry.learningCandidate && (
                        <details>
                          <summary>Reusable candidate: {entry.learningCandidate.name}</summary>
                          <p>{entry.learningCandidate.generalizedIntent}</p>
                          <small>{entry.learningCandidate.kind.replace("_", " ")} · inactive until {entry.learningCandidate.activation.replace("_", " ")}</small>
                        </details>
                      )}
                      {entry.capabilityProposal && (
                        <details>
                          <summary>Global capability draft: {entry.capabilityProposal.name}</summary>
                          <p>{entry.capabilityProposal.generalizedIntent}</p>
                          <small>{entry.capabilityProposal.kind.replace("_", " ")} · global scope · inactive pending {entry.capabilityProposal.activation.replace("_", " ")}</small>
                        </details>
                      )}
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
            {view === "evidence" && (
              artifacts.length ? <div className="artifact-list">
                {artifacts.map((artifact) => <article key={artifact.id}>
                  <header><strong>{artifact.name}</strong><span className={`timeline-status ${artifact.integrity ? "" : "error"}`}>{artifact.integrity ? "verified" : "corrupt"}</span></header>
                  <p>{artifact.kind} · revision {artifact.provenance.revision} · {(artifact.size / 1024).toFixed(1)} KB</p>
                  <code>SHA-256 {artifact.sha256}</code>
                  <small>{artifact.provenance.jobId ? `Job ${artifact.provenance.jobId.slice(0, 8)} · ` : ""}{artifact.provenance.transactionId ? `Transaction ${artifact.provenance.transactionId.slice(0, 8)} · ` : ""}{artifact.location}</small>
                </article>)}
              </div> : <div className="codex-welcome"><strong>No evidence registered yet.</strong><p>Apply a verified change or create an export.</p></div>
            )}
            {view === "tests" && (
              <TraceList
                empty="Codex has not run tests yet."
                items={trace.tests.map((item) => ({
                  title: item.passed ? "✓ Test passed" : "✕ Test failed",
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
            <section className="approval-card" role="dialog" aria-modal="false" aria-labelledby="approval-title" onKeyDown={(event) => { if (event.key === "Escape") rejectPlan(); }}>
              <p className="eyebrow">Plan to approve</p>
              {parsedPlan ? <>
                <h3 id="approval-title" tabIndex={-1} ref={approvalHeading}>{parsedPlan.summary}</h3>
                <p>{parsedPlan.alreadySatisfied ? "Kyro checked the current project and no change is needed." : `${parsedPlan.operations.length} visual ${parsedPlan.operations.length === 1 ? "change" : "changes"} proposed.`}</p>
                {!parsedPlan.alreadySatisfied && planSummary && <div className="change-impact">
                  <div><strong>What will change</strong><ul>{[...new Set(planSummary.changes)].map((change) => <li key={change}>{change}</li>)}</ul></div>
                  <div><strong>Impact</strong><p>{planSummary.areas.map((area) => `${area.count} ${area.name.toLowerCase()}`).join(" · ") || "Global capability draft"}</p></div>
                  <div><strong>Where</strong><p>{context ? `${context.componentName} on ${context.treePath[0]} · revision ${context.revision}` : "Current selection"}</p></div>
                  <div><strong>Your authorization</strong><p>Nothing has changed yet. Approval allows only this listed plan on this revision.</p></div>
                  <div><strong>Verification</strong><p>{planSummary.checkCount ? `${planSummary.checkCount} planned ${planSummary.checkCount === 1 ? "check" : "checks"}, plus Kyro runtime verification.` : "Kyro will verify the Graph and runtime before saving."}</p></div>
                </div>}
                {parsedPlan.capabilityProposal && <p role="status">Global capability proposal: <strong>{parsedPlan.capabilityProposal.name}</strong>. Approving saves an inactive, versioned draft for every Kyro project; activation still requires its tests and review.</p>}
                {parsedPlan.checks.length > 0 && <ul>{parsedPlan.checks.map((check) => <li key={check}>{check}</li>)}</ul>}
                {parsedPlan.confirmations.length > 0 && <p role="alert">Confirmation required: {parsedPlan.confirmations.join("; ")}</p>}
              </> : <p role="alert">Codex did not return a valid Kyro plan. Nothing can be applied.</p>}
              <div>
                <button
                  className="secondary"
                  onClick={rejectPlan}
                >
                  Reject
                </button>
                {parsedPlan?.alreadySatisfied ? (
                  <button onClick={() => setPlan("")}>Done</button>
                ) : (
                  <button disabled={busy || !parsedPlan || !planThreadId} onClick={() => void execute("apply")}>
                    {parsedPlan?.operations.length ? "Approve and apply" : "Approve global draft"}
                  </button>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </section>
  );
}
