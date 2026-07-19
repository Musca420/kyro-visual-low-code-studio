import { useMemo, useState } from "react";
import { eventsForComponent, type ActionEventDefinition } from "./actionCatalog";
import type { EditorComponent, Flow } from "./model";

export function ComponentActions({ component, flows, onCreate, onLink, onOpen, onRemove, onAskCodex }: {
  component: EditorComponent;
  flows: Flow[];
  onCreate: (event: ActionEventDefinition) => void;
  onLink: (event: ActionEventDefinition, flowId: string) => void;
  onOpen: (flowId: string) => void;
  onRemove: (eventId: string) => void;
  onAskCodex: (event?: ActionEventDefinition) => void;
}) {
  const events = useMemo(() => eventsForComponent(component.type), [component.type]);
  const [reuse, setReuse] = useState<Record<string, string>>({});
  const categories = [...new Set(events.map((event) => event.category))];
  return <section className="component-actions" aria-label={`Actions for ${component.name}`}>
    <header>
      <div><strong>Actions</strong><small>Choose what starts a flow for this element.</small></div>
      <button type="button" onClick={() => onAskCodex()}>Ask Codex</button>
    </header>
    {Object.entries(component.events).length > 0 && <div className="linked-actions">
      <h3>Connected</h3>
      {Object.entries(component.events).map(([eventId, flowId]) => {
        const definition = events.find((event) => event.id === eventId);
        const flow = flows.find((item) => item.id === flowId);
        return <article key={eventId}>
          <div><strong>{definition?.label ?? eventId}</strong><small>{flow?.name ?? "Missing flow"}</small></div>
          <button type="button" className="secondary" onClick={() => onOpen(flowId)}>Open flow</button>
          <button type="button" className="icon-button" aria-label={`Disconnect ${definition?.label ?? eventId}`} onClick={() => onRemove(eventId)}>×</button>
        </article>;
      })}
    </div>}
    {categories.map((category) => <details key={category} open={category === "Pointer" || category === "Form & input"}>
      <summary>{category}</summary>
      {events.filter((event) => event.category === category).map((event) => {
        const linked = component.events[event.id];
        if (linked) return null;
        return <article key={event.id}>
          <div><strong>{event.label}</strong><small>{event.description}</small></div>
          <button type="button" onClick={() => onCreate(event)}>New flow</button>
          {flows.length > 0 && <div className="reuse-flow">
            <select aria-label={`Reusable flow for ${event.label}`} value={reuse[event.id] ?? ""} onChange={(input) => setReuse((value) => ({ ...value, [event.id]: input.target.value }))}>
              <option value="">Reuse a flow…</option>
              {flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
            </select>
            <button type="button" className="secondary" disabled={!reuse[event.id]} onClick={() => onLink(event, reuse[event.id])}>Connect</button>
          </div>}
          <button type="button" className="text-button" onClick={() => onAskCodex(event)}>Ask Codex for this action</button>
        </article>;
      })}
    </details>)}
    {!events.length && <p>This element has no direct interaction events. Bind its data or select its containing element.</p>}
  </section>;
}
