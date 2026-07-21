import type { FlowLog } from "../../flow";
import type { Project } from "../../model";

export function FlowRunHistory({ runs, flows, onOpen }: { runs: Project["flowRuns"]; flows: Project["flows"]; onOpen: (logs: FlowLog[]) => void }) {
  return (
    <details className="flow-run-history">
      <summary>Run history <span>{runs.length}</span></summary>
      <div>
        {runs.length === 0 ? <p>No runs recorded.</p> : [...runs].reverse().map((run) => (
          <button key={run.id} type="button" className="secondary" onClick={() => onOpen(run.logs)}>
            <strong>{flows.find((flow) => flow.id === run.flowId)?.name ?? "Removed flow"}</strong>
            <span>{run.logs.length} steps · {run.durationMs.toFixed(1)} ms</span>
            <time>{new Date(run.startedAt).toLocaleString("en")}</time>
          </button>
        ))}
      </div>
    </details>
  );
}
