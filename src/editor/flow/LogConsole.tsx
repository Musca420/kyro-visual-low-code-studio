import { useCallback, useEffect, useState } from "react";
import type { FlowLog } from "../../flow";

export function LogConsole({ logs, paused, onResume, onSelect }: { logs: FlowLog[]; paused?: { nodeId: string; value: unknown }; onResume?: () => void; onSelect?: (nodeId: string) => void }) {
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const showStep = useCallback((index: number) => {
    const next = Math.max(0, Math.min(logs.length - 1, index));
    setCursor(next);
    if (logs[next]) onSelect?.(logs[next].nodeId);
  }, [logs, onSelect]);
  useEffect(() => {
    if (!playing || !logs.length) return;
    const timer = setInterval(() => setCursor((current) => {
      const next = current < 0 ? 0 : current + 1;
      if (next >= logs.length) { setPlaying(false); return logs.length - 1; }
      onSelect?.(logs[next].nodeId);
      return next;
    }), 650);
    return () => clearInterval(timer);
  }, [playing, logs, onSelect]);
  return (
    <section className="log-console" aria-labelledby="log-title">
      <div>
        <h2 id="log-title">Flow console</h2>
        <span>{logs.length ? `${logs.length} operations` : "Waiting"}</span>
      </div>
      {paused && <div className="flow-paused" role="status"><strong>Paused at node</strong><pre>{JSON.stringify(paused.value, null, 2)}</pre><button type="button" onClick={onResume}>Continue execution</button></div>}
      {logs.length > 0 && <div className="log-replay" role="group" aria-label="Flow replay"><button type="button" className="secondary" onClick={() => showStep(0)}>From start</button><button type="button" className="secondary" aria-label="Previous step" disabled={cursor <= 0} onClick={() => showStep(cursor - 1)}>←</button><output>{cursor < 0 ? `— / ${logs.length}` : `${cursor + 1} / ${logs.length}`}</output><button type="button" className="secondary" aria-label="Next step" disabled={cursor >= logs.length - 1} onClick={() => showStep(cursor + 1)}>→</button><button type="button" className="secondary" aria-pressed={playing} onClick={() => { setCursor(-1); setPlaying((value) => !value); }}>{playing ? "Stop replay" : "Replay"}</button></div>}
      {logs.length === 0 ? (
        <p>
          Run the flow from Preview to inspect input, output, and errors.
        </p>
      ) : (
        <ol>
          {logs.map((log, index) => (
            <li key={`${log.nodeId}-${index}`} className={`${log.level}${cursor === index ? " current" : ""}`}>
              <code>{log.level}</code>
              <button type="button" className="log-step" onClick={() => showStep(index)}><span>{log.message}</span>{log.durationMs !== undefined && <time>{log.durationMs.toFixed(1)} ms</time>}{log.value !== undefined && <pre>{JSON.stringify(log.value, null, 2)}</pre>}</button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
