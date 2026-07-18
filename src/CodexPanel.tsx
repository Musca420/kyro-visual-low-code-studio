import { useEffect, useState } from 'react'

export type CodexContext = {
  projectId: string
  pageId: string
  revision: number
  componentId: string
  componentName: string
  componentType: string
  treePath: string[]
  bounds: { x: number; y: number; width: number; height: number }
  properties: Record<string, unknown>
  styles: Record<string, unknown>
  events: Record<string, string>
  binding?: Record<string, unknown>
  dataSources: unknown[]
  flows: unknown[]
  nearbyComponents: { id: string; name: string; type: string }[]
  generatedFiles: string[]
  errors: string[]
}

function readableOutput(raw: string) {
  const messages = raw.split('\n').flatMap((line) => {
    try {
      const event = JSON.parse(line)
      return event.item?.type === 'agent_message' && event.item.text ? [event.item.text as string] : []
    } catch { return [] }
  })
  return messages.join('\n\n') || raw || 'Codex non ha restituito testo.'
}

export function CodexPanel({ open, context, suggestedPrompt, onClose }: { open: boolean; context?: CodexContext; suggestedPrompt: string; onClose: () => void }) {
  const [prompt, setPrompt] = useState(suggestedPrompt)
  const [status, setStatus] = useState('Controllo accesso…')
  const [workspace, setWorkspace] = useState('')
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState('')
  const [history, setHistory] = useState<{ role: 'user' | 'codex' | 'system'; text: string }[]>([])
  useEffect(() => { setPrompt(suggestedPrompt) }, [suggestedPrompt])
  useEffect(() => {
    if (!open) return
    fetch('/api/codex/status').then((response) => response.json()).then((value) => { setStatus(value.authenticated ? value.message || 'Accesso attivo' : 'Accesso richiesto: usa “codex login” nel terminale locale'); setWorkspace(value.workspace || '') }).catch(() => setStatus('Bridge locale non raggiungibile'))
  }, [open])
  const execute = async (mode: 'plan' | 'apply') => {
    if (!context || !prompt.trim()) return
    setBusy(true)
    if (mode === 'plan') setHistory((items) => [...items, { role: 'user', text: prompt }, { role: 'system', text: 'Analisi in sola lettura avviata…' }])
    try {
      const response = await fetch('/api/codex/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode, prompt, context, projectId: context.projectId, revision: context.revision }) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || value.errors || 'Operazione non riuscita')
      const text = readableOutput(value.output)
      if (mode === 'plan') setPlan(text)
      setHistory((items) => [...items.filter((item) => !item.text.endsWith('avviata…')), { role: 'codex', text }])
    } catch (error) { setHistory((items) => [...items.filter((item) => !item.text.endsWith('avviata…')), { role: 'system', text: error instanceof Error ? error.message : String(error) }]) }
    finally { setBusy(false) }
  }
  if (!open) return null
  return <section className="codex-panel" aria-label="Assistente Codex">
    <header><div><span className="codex-mark">⌘</span><strong>Codex</strong><small className={status.includes('attivo') || status.includes('Logged') ? 'online' : ''}>{status}</small></div><div><button data-help="Interrompe l’operazione Codex attualmente in esecuzione." className="secondary" disabled={!busy} onClick={() => void fetch('/api/codex/cancel', { method: 'POST' }).then(() => setBusy(false))}>Annulla</button><button data-help="Chiude il pannello. La cronologia resta disponibile finché il progetto è aperto." className="icon-button" aria-label="Chiudi pannello Codex" onClick={onClose}>×</button></div></header>
    <div className="codex-body">
      <aside><p className="eyebrow">Contesto certo</p>{context ? <><strong>{context.componentName}</strong><span>{context.componentType} · rev. {context.revision}</span><code>{context.componentId}</code><dl><div><dt>Pagina</dt><dd>{context.treePath[0]}</dd></div><div><dt>Flow</dt><dd>{context.flows.length}</dd></div><div><dt>Dati</dt><dd>{context.dataSources.length}</dd></div></dl></> : <p>Seleziona un elemento e usa il clic destro.</p>}<small>Workspace locale</small><code>{workspace || 'non disponibile'}</code></aside>
      <main><div className="codex-history" aria-live="polite">{history.length === 0 ? <div className="codex-welcome"><strong>Dimmi cosa deve fare questo elemento.</strong><p>Prima analizzerò il progetto in sola lettura. Potrai approvare o rifiutare il piano prima di qualsiasi modifica.</p></div> : history.map((message, index) => <article className={message.role} key={index}><strong>{message.role === 'user' ? 'Tu' : message.role === 'codex' ? 'Codex' : 'Stato'}</strong><pre>{message.text}</pre></article>)}</div><form onSubmit={(event) => { event.preventDefault(); void execute('plan') }}><label htmlFor="codex-request">Richiesta in linguaggio naturale</label><textarea autoFocus id="codex-request" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Esempio: quando clicco, salva il valore dell’input e aggiorna la lista." rows={3} maxLength={8000} /><div><span>{prompt.length}/8000</span><button disabled={busy || !context || !prompt.trim()}>{busy ? 'Codex sta analizzando…' : 'Analizza richiesta'}</button></div></form>{plan && <section className="approval-card"><p className="eyebrow">Piano da approvare</p><p>Codex ha lavorato in sola lettura. Approva solo se il piano corrisponde a ciò che vuoi.</p><div><button className="secondary" onClick={() => { setPlan(''); setHistory((items) => [...items, { role: 'system', text: 'Piano rifiutato. Nessuna modifica applicata.' }]) }}>Rifiuta</button><button disabled={busy} onClick={() => void execute('apply')}>Approva e applica</button></div></section>}</main>
    </div>
  </section>
}
