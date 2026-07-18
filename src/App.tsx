import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { deleteProject, deleteProjectRecord, getProject, insertProjectRecord, insertRecord, listProjects, queryRecords, saveProject, updateProjectRecord, type LocalRecord } from './db'
import { runFlow, type FlowLog } from './flow'
import { downloadGeneratedApp } from './generator'
import { BREAKPOINTS, componentTypes, createProject, makeComponent, parseProject, serializeProject, type Breakpoint, type EditorComponent, type Flow, type Project } from './model'
import { PluginManager } from './PluginManager'
import { PreviewFrame } from './PreviewFrame'
import { createDashboardProject, createLandingProject } from './templates'
import { CodexPanel, type CodexContext } from './CodexPanel'
import { applyEditorOperation } from './editorOperations'

type WorkspaceTab = 'design' | 'flow' | 'data' | 'preview' | 'plugins'
const FlowEditor = lazy(() => import('./FlowEditor'))

export function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [active, setActive] = useState<Project>()
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(() => listProjects().then(setProjects), [])
  useEffect(() => { refresh().finally(() => setLoading(false)) }, [refresh])
  return <HelpOverlay>{active
    ? <Editor initial={active} onClose={() => { setActive(undefined); void refresh() }} />
    : <Dashboard loading={loading} projects={projects} onOpen={async (id) => { const project = await getProject(id); if (project) setActive(project) }} onRefresh={refresh} />}
  </HelpOverlay>
}

function Dashboard({ loading, projects, onOpen, onRefresh }: { loading: boolean; projects: Project[]; onOpen: (id: string) => void; onRefresh: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const create = async (template: 'blank' | 'todo' | 'landing' | 'dashboard' = 'blank') => {
    if (!name.trim()) return setError('Inserisci un nome per il progetto')
    let project = template === 'landing' ? createLandingProject(name) : template === 'dashboard' ? createDashboardProject(name) : createProject(name)
    if (template === 'todo') project = addVerticalTemplate(project)
    await saveProject(project)
    setName('')
    setError('')
    await onRefresh()
    onOpen(project.id)
  }
  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const project = parseProject(JSON.parse(await file.text()))
      await saveProject(project)
      await onRefresh()
      setError('')
    } catch (problem) { setError(`Import non riuscito: ${problem instanceof Error ? problem.message : String(problem)}`) }
  }
  const duplicate = async (project: Project) => {
    const now = new Date().toISOString()
    await saveProject({ ...project, id: crypto.randomUUID(), name: `${project.name} copia`, createdAt: now, updatedAt: now })
    await onRefresh()
  }
  return <main className="dashboard">
    <header className="hero"><div className="brand-mark">FE</div><p className="eyebrow">Visual low-code studio</p><h1>Trasforma un’idea in un’app<br /><span>che funziona davvero.</span></h1><p>Crea interfaccia, dati e comportamento nello stesso spazio. Il progetto resta tuo, esportabile e leggibile.</p></header>
    <section className="create-card" aria-labelledby="create-title">
      <div><p className="eyebrow">Nuovo progetto</p><h2 id="create-title">Da dove vuoi iniziare?</h2></div>
      <label>Nome progetto<input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void create('blank') }} placeholder="La mia applicazione" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="template-grid"><button className="template" onClick={() => create('blank')}><span>＋</span><strong>Progetto vuoto</strong><small>Parti da una tela pulita</small></button><button className="template" onClick={() => create('todo')}><span>✓</span><strong>Lista attività</strong><small>Vertical slice già configurato</small></button><button className="template featured" onClick={() => create('landing')}><span>↗</span><strong>Landing page</strong><small>Hero, feature, CTA e footer</small></button><button className="template featured" onClick={() => create('dashboard')}><span>▦</span><strong>Project dashboard</strong><small>KPI, ricerca, filtri e CRUD</small></button></div>
      <input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
      <button className="text-button" onClick={() => importRef.current?.click()}>Importa un progetto JSON</button>
    </section>
    <section className="recent" aria-labelledby="recent-title"><div className="section-heading"><div><p className="eyebrow">Salvati su questo dispositivo</p><h2 id="recent-title">Progetti recenti</h2></div></div>
      {loading ? <p>Caricamento…</p> : projects.length === 0 ? <div className="empty-panel"><strong>Nessun progetto ancora</strong><span>Assegna un nome e scegli un punto di partenza.</span></div> : <div className="project-grid">{projects.map((project) => <article className="project-card" key={project.id}><button className="project-open" onClick={() => onOpen(project.id)}><span className="project-thumb">{project.pages[0]?.components.length ?? 0}<small>componenti</small></span><strong>{project.name}</strong><small>Formato v{project.formatVersion} · {project.pages.length} pagine</small></button><div className="project-actions"><button onClick={() => duplicate(project)}>Duplica</button><button className="danger" onClick={async () => { if (confirm(`Eliminare definitivamente “${project.name}”?`)) { await deleteProject(project.id); await onRefresh() } }}>Elimina</button></div></article>)}</div>}
    </section>
  </main>
}

function Editor({ initial, onClose }: { initial: Project; onClose: () => void }) {
  const [project, setProject] = useState(initial)
  const [pageId, setPageId] = useState(initial.pages[0]?.id ?? '')
  const [selected, setSelected] = useState<string[]>([])
  const [tab, setTab] = useState<WorkspaceTab>('design')
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop')
  const [interactive, setInteractive] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [history, setHistory] = useState<Project[]>([])
  const [future, setFuture] = useState<Project[]>([])
  const [saveState, setSaveState] = useState('Salvato')
  const [logs, setLogs] = useState<FlowLog[]>([])
  const [sourceName, setSourceName] = useState('Attività locali')
  const [collection, setCollection] = useState('items')
  const [feedback, setFeedback] = useState('')
  const [flowId, setFlowId] = useState(initial.flows[0]?.id ?? '')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; component: EditorComponent; bounds: CodexContext['bounds'] }>()
  const [codexRequest, setCodexRequest] = useState<{ context: CodexContext; prompt: string }>()
  const currentPage = project.pages.find((page) => page.id === pageId)
  const activeComponent = currentPage?.components.find((component) => component.id === selected[0])
  const flow = project.flows.find((item) => item.id === flowId) ?? project.flows[0]

  useEffect(() => {
    if (!currentPage) return
    const layouts = Object.fromEntries(currentPage.components.map((component) => { const element = document.querySelector<HTMLElement>(`[data-component-id="${component.id}"]`), box = element?.getBoundingClientRect(); return [component.id, box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null] }))
    const state = { projectId: project.id, pageId: currentPage.id, revision: project.revision, selectedComponentIds: selected, viewport: breakpoint, previewState: tab === 'preview' ? 'open' : 'closed', componentTree: currentPage.components, layouts, flows: project.flows, dataSources: project.dataSources, validationErrors: [], consoleErrors: [] }
    void fetch('/api/live/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state) }).catch(() => undefined)
  }, [project, currentPage, selected, breakpoint, tab])

  const askCodex = (action: string) => {
    if (!contextMenu || !currentPage) return
    const component = contextMenu.component
    const context: CodexContext = {
      projectId: project.id, pageId: currentPage.id, revision: project.revision, componentId: component.id, componentName: component.name, componentType: component.type,
      treePath: [currentPage.name, component.name], bounds: contextMenu.bounds, properties: component.props, styles: component.styles, events: component.events,
      binding: component.binding, dataSources: project.dataSources, flows: project.flows.filter((item) => Object.values(component.events).includes(item.id)),
      nearbyComponents: currentPage.components.filter((item) => item.id !== component.id).slice(0, 8).map(({ id, name, type }) => ({ id, name, type })),
      generatedFiles: ['src/main.ts', 'src/style.css', 'project.frontend-editor.json'], errors: [],
    }
    const prompts: Record<string, string> = {
      'Chiedi a Codex': '', 'Crea comportamento': `Crea un nuovo comportamento per “${component.name}”.`, 'Modifica comportamento': `Modifica il comportamento esistente di “${component.name}”.`,
      'Collega dati': `Collega “${component.name}” ai dati necessari. Se manca una sorgente, proponi opzioni semplici prima di crearla.`, 'Correggi problema': `Individua e correggi il problema di “${component.name}”.`,
      'Migliora componente': `Migliora usabilità, responsive design e accessibilità di “${component.name}”.`, 'Spiega elemento': `Spiega in parole semplici cos’è “${component.name}”, cosa fa e come posso modificarlo.`,
    }
    setCodexRequest({ context, prompt: prompts[action] }); setContextMenu(undefined)
  }

  const change = useCallback((next: Project | ((value: Project) => Project), track = true) => {
    setProject((previous) => {
      const candidate = typeof next === 'function' ? next(previous) : next
      const value = { ...candidate, revision: previous.revision + 1, updatedAt: new Date().toISOString() }
      if (track) { setHistory((items) => [...items.slice(-49), previous]); setFuture([]) }
      return value
    })
    setSaveState('Modifiche non salvate')
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => { void saveProject(project).then(() => setSaveState('Salvato automaticamente')).catch((error) => setSaveState(`Errore salvataggio: ${error instanceof Error ? error.message : String(error)}`)) }, 450)
    return () => clearTimeout(timer)
  }, [project])

  const undo = useCallback(() => {
    const previous = history.at(-1)
    if (!previous) return
    setFuture((items) => [project, ...items]); setHistory((items) => items.slice(0, -1)); setProject({ ...previous, revision: project.revision + 1, updatedAt: new Date().toISOString() }); setSaveState('Modifiche non salvate')
  }, [history, project])
  const redo = useCallback(() => {
    const next = future[0]
    if (!next) return
    setHistory((items) => [...items, project]); setFuture((items) => items.slice(1)); setProject({ ...next, revision: project.revision + 1, updatedAt: new Date().toISOString() }); setSaveState('Modifiche non salvate')
  }, [future, project])
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo() }
      if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo() }
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  })

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const commands = await fetch(`/api/live/commands?projectId=${project.id}`).then((response) => response.json()) as { id: string; tool: string; args: Record<string, unknown> }[]
        for (const command of commands) {
          try {
            if (command.tool === 'undo_last_transaction') undo()
            else if (command.tool === 'open_preview') setTab('preview')
            else change((value) => applyEditorOperation(value, pageId, { type: command.tool, args: command.args }))
            await fetch(`/api/live/commands/${command.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) })
            setFeedback(`Modifica Codex applicata · transazione ${command.id.slice(0, 8)}`)
          } catch (error) { await fetch(`/api/live/commands/${command.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }) }) }
        }
      } catch { /* Il bridge non esiste nella build statica. */ }
    }, 600)
    return () => clearInterval(timer)
  }, [project.id, pageId, change, undo])

  const patchPage = (update: (components: EditorComponent[]) => EditorComponent[]) => change((value) => ({ ...value, pages: value.pages.map((page) => page.id === pageId ? { ...page, components: update(page.components) } : page) }))
  const addComponent = (type: EditorComponent['type']) => {
    if (!currentPage) return setFeedback('Crea prima una pagina')
    const component = makeComponent(type)
    patchPage((components) => [...components, component])
    setSelected([component.id])
  }
  const updateComponent = (update: (component: EditorComponent) => EditorComponent) => patchPage((components) => components.map((component) => selected.includes(component.id) ? update(component) : component))
  const removeSelected = () => {
    change((value) => {
      const removedFlows = new Set(value.flows.filter((item) => item.nodes.some((node) => node.config.componentId && selected.includes(node.config.componentId))).map((item) => item.id))
      return {
        ...value,
        flows: value.flows.filter((item) => !removedFlows.has(item.id)),
        pages: value.pages.map((page) => ({ ...page, components: page.components.filter((component) => !selected.includes(component.id)).map((component) => ({ ...component, events: Object.fromEntries(Object.entries(component.events).filter(([, flowId]) => !removedFlows.has(flowId))) })) })),
      }
    })
    setSelected([])
  }
  const addPage = () => {
    const page = { id: crypto.randomUUID(), name: `Pagina ${project.pages.length + 1}`, path: project.pages.length ? `/pagina-${project.pages.length + 1}` : '/', components: [] }
    change({ ...project, pages: [...project.pages, page] }); setPageId(page.id); setSelected([])
  }
  const createSource = () => {
    if (!sourceName.trim() || !collection.trim()) return setFeedback('Nome e collezione sono obbligatori')
    if (project.dataSources.some((source) => source.collection === collection.trim())) return setFeedback('Esiste già una sorgente per questa collezione')
    const schema: Record<string, 'string' | 'datetime'> = project.state.experience === 'dashboard' ? { id: 'string', name: 'string', description: 'string', status: 'string', priority: 'string', dueDate: 'datetime', date: 'datetime' } : { id: 'string', text: 'string', date: 'datetime' }
    change({ ...project, dataSources: [...project.dataSources, { id: crypto.randomUUID(), name: sourceName.trim(), provider: 'indexeddb', collection: collection.trim(), schema, capabilities: ['get', 'query', 'insert', 'update', 'delete', 'subscribe'], secretStrategy: 'none' }] })
    setFeedback('Sorgente IndexedDB creata e schema validato')
  }
  const createFlow = () => {
    if (project.state.experience === 'landing') {
      const flows = landingFlows(project)
      change({ ...project, flows: flows.flows, pages: flows.pages })
      setFlowId(flows.flows[0].id)
      setFeedback('Due flow collegati: navigazione alle feature e notifica')
      return
    }
    if (project.state.experience === 'dashboard') {
      if (!project.dataSources[0]) return setFeedback('Crea prima la sorgente locale dei progetti')
      const flows = dashboardFlows(project)
      change({ ...project, flows: flows.flows, pages: flows.pages })
      setFlowId(flows.flows[0].id)
      setFeedback('Flow CRUD, caricamento, ricerca, filtro, ordinamento e KPI collegati')
      return
    }
    const input = currentPage?.components.find((component) => component.type === 'input')
    const button = currentPage?.components.find((component) => component.type === 'button')
    const list = currentPage?.components.find((component) => component.type === 'list')
    const source = project.dataSources[0]
    if (!input || !button || !list || !source) return setFeedback('Servono input, pulsante, lista e sorgente locale')
    const ids = Array.from({ length: 6 }, () => crypto.randomUUID())
    const newFlow: Flow = { id: crypto.randomUUID(), name: 'Aggiungi attività', nodes: [
      { id: ids[0], type: 'event', label: 'Click pulsante', position: { x: 0, y: 80 }, config: { componentId: button.id } },
      { id: ids[1], type: 'readInput', label: 'Leggi input', position: { x: 190, y: 80 }, config: { componentId: input.id } },
      { id: ids[2], type: 'validate', label: 'Non vuoto', position: { x: 380, y: 80 }, config: { message: 'Scrivi un’attività prima di aggiungerla' } },
      { id: ids[3], type: 'insert', label: 'Inserisci record', position: { x: 570, y: 40 }, config: { sourceId: source.id } },
      { id: ids[4], type: 'refresh', label: 'Aggiorna lista', position: { x: 760, y: 40 }, config: { componentId: list.id } },
      { id: ids[5], type: 'notify', label: 'Mostra errore', position: { x: 570, y: 180 }, config: { level: 'error' } },
    ], edges: [
      { id: crypto.randomUUID(), source: ids[0], target: ids[1], path: 'success' }, { id: crypto.randomUUID(), source: ids[1], target: ids[2], path: 'success' },
      { id: crypto.randomUUID(), source: ids[2], target: ids[3], path: 'success' }, { id: crypto.randomUUID(), source: ids[2], target: ids[5], path: 'error' },
      { id: crypto.randomUUID(), source: ids[3], target: ids[4], path: 'success' }, { id: crypto.randomUUID(), source: ids[3], target: ids[5], path: 'error' },
    ] }
    change({ ...project, flows: [newFlow], pages: project.pages.map((page) => page.id === pageId ? { ...page, components: page.components.map((component) => component.id === button.id ? { ...component, events: { ...component.events, click: newFlow.id } } : component.id === list.id ? { ...component, binding: { sourceId: source.id, state: 'data' } } : component) } : page) })
    setFlowId(newFlow.id)
    setFeedback('Flow collegato al click e lista collegata alla sorgente')
  }

  const refreshRecords = useCallback(async (): Promise<LocalRecord[]> => project.dataSources[0] ? queryRecords(project.dataSources[0].id) : [], [project.dataSources])
  const addRecord = useCallback(async (input: string) => {
    const activeFlow = project.flows[0]
    const source = project.dataSources[0]
    if (!activeFlow || !source) throw new Error('Configura prima sorgente e flow')
    const result = await runFlow(activeFlow, { input, insert: (text) => insertRecord(source.id, text), refresh: async () => { await queryRecords(source.id) } })
    setLogs(result)
    const error = result.find((entry) => entry.level === 'error')
    if (error) throw new Error(error.message)
  }, [project.flows, project.dataSources])

  const dashboardAction = useCallback(async (action: string, payload?: Record<string, string>) => {
    const source = project.dataSources[0]
    if (!source) throw new Error('Configura prima la sorgente locale')
    if (action === 'create') await insertProjectRecord(source.id, payload)
    if (action === 'update') await updateProjectRecord(source.id, String(payload?.id ?? ''), payload)
    if (action === 'delete') await deleteProjectRecord(source.id, String(payload?.id ?? ''))
    return queryRecords(source.id)
  }, [project.dataSources])

  const exportProject = () => {
    const blob = new Blob([serializeProject(project)], { type: 'application/json' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${project.name}.frontend-editor.json`; link.click(); URL.revokeObjectURL(link.href)
  }

  return <div className="app-shell" data-project-id={project.id}>
    <header className="topbar"><button className="brand-button" onClick={onClose} aria-label="Chiudi progetto e torna alla dashboard"><span>FE</span></button><div className="project-title"><input aria-label="Nome progetto" value={project.name} onChange={(event) => change({ ...project, name: event.target.value })} /><span>{saveState}</span></div><div className="top-actions"><button className="icon-button" onClick={undo} disabled={!history.length} aria-label="Annulla">↶</button><button className="icon-button" onClick={redo} disabled={!future.length} aria-label="Ripristina">↷</button><button className="secondary" onClick={exportProject}>Esporta JSON</button><button onClick={() => void downloadGeneratedApp(project).then(() => setFeedback('App TypeScript esportata come ZIP')).catch((error) => setFeedback(error instanceof Error ? error.message : String(error)))}>Esporta app</button></div></header>
    <nav className="workspace-tabs" aria-label="Aree di lavoro">{([['design', 'Design', 'Disegna pagine e componenti senza scrivere codice.'], ['flow', 'Flow', 'Definisci cosa accade quando l’utente interagisce.'], ['data', 'Dati', 'Crea e collega archivi locali per i contenuti.'], ['preview', 'Preview', 'Prova l’app esattamente come la userà una persona.'], ['plugins', 'Plugin', 'Aggiungi capacità controllate all’editor.']] as [WorkspaceTab, string, string][]).map(([value, label, help]) => <button key={value} data-help={help} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}{value === 'flow' && project.flows.length > 0 && <span className="badge">{project.flows.length}</span>}</button>)}</nav>
    <GuideBar project={project} tab={tab} onOpen={setTab} />
    {feedback && <div className="global-feedback" role="status">{feedback}<button aria-label="Chiudi messaggio" onClick={() => setFeedback('')}>×</button></div>}
    {tab === 'design' && <div className="editor-grid">
      <aside className="left-panel"><PanelTitle eyebrow="Struttura" title="Pagine" /><div className="page-list">{project.pages.map((page) => <button data-help={`Apri la pagina ${page.name} per modificarla.`} className={page.id === pageId ? 'active' : ''} key={page.id} onClick={() => { setPageId(page.id); setSelected([]) }}><span>▱</span>{page.name}<small>{page.path}</small></button>)}<button data-help="Crea una nuova schermata vuota nel progetto." className="dashed" onClick={addPage}>＋ Aggiungi pagina</button></div><PanelTitle eyebrow="Elementi" title="Palette" /><div className="palette">{componentTypes.map((type) => <button data-help={componentHelp[type]} key={type} draggable onDragStart={(event) => event.dataTransfer.setData('application/frontend-component', type)} onClick={() => addComponent(type)}><span>{icon(type)}</span>{type}</button>)}</div></aside>
      <section className="canvas-area"><div className="canvas-toolbar"><div className="segmented" aria-label="Breakpoint">{BREAKPOINTS.map((value) => <button key={value} className={breakpoint === value ? 'active' : ''} onClick={() => setBreakpoint(value)}>{value}</button>)}</div><div className="zoom"><button onClick={() => setZoom(Math.max(.5, zoom - .1))} aria-label="Riduci zoom">−</button><output>{Math.round(zoom * 100)}%</output><button onClick={() => setZoom(Math.min(1.5, zoom + .1))} aria-label="Aumenta zoom">＋</button></div></div><div className="canvas-scroll"><div className={`design-canvas canvas-${breakpoint}`} style={{ transform: `scale(${zoom})` }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const type = event.dataTransfer.getData('application/frontend-component') as EditorComponent['type']; if (componentTypes.includes(type)) addComponent(type) }}>
        {!currentPage ? <div className="canvas-empty"><strong>Crea la prima pagina</strong><button onClick={addPage}>Aggiungi pagina</button></div> : currentPage.components.length === 0 ? <div className="canvas-empty"><strong>Trascina qui un componente</strong><span>oppure fai clic su un elemento nella palette</span></div> : currentPage.components.map((component, index) => <DesignComponent key={component.id} component={component} breakpoint={breakpoint} selected={selected.includes(component.id)} onSelect={(multi) => setSelected((items) => multi ? items.includes(component.id) ? items.filter((id) => id !== component.id) : [...items, component.id] : [component.id])} onContextMenu={(bounds, point) => { setSelected([component.id]); setContextMenu({ component, bounds, ...point }) }} onMove={(direction) => patchPage((items) => { const next = [...items]; const destination = index + direction; if (destination < 0 || destination >= next.length) return items; [next[index], next[destination]] = [next[destination], next[index]]; return next })} />)}
      </div></div></section>
      <aside className="right-panel"><PanelTitle eyebrow="Ispezione" title={selected.length > 1 ? `${selected.length} elementi` : activeComponent?.name ?? 'Proprietà'} />{activeComponent ? <Properties component={activeComponent} breakpoint={breakpoint} onUpdate={updateComponent} onDuplicate={() => { const copies = selected.map((id) => currentPage!.components.find((item) => item.id === id)).filter(Boolean).map((item) => ({ ...item!, id: crypto.randomUUID(), name: `${item!.name} copia` })); patchPage((items) => [...items, ...copies]); setSelected(copies.map((item) => item.id)) }} onDelete={removeSelected} /> : <div className="empty-panel compact"><strong>Nessuna selezione</strong><span>Seleziona un elemento sul canvas per modificarlo.</span></div>}<PanelTitle eyebrow="Gerarchia" title="Livelli" /><ol className="layers">{currentPage?.components.map((component) => <li key={component.id}><button className={selected.includes(component.id) ? 'active' : ''} onClick={() => setSelected([component.id])}><span>{icon(component.type)}</span>{component.name}</button></li>)}</ol></aside>
    </div>}
    {tab === 'flow' && <main className="wide-workspace"><div className="section-heading"><div><p className="eyebrow">Comportamento</p><h1>Flow editor</h1><p>Collega eventi e operazioni. I percorsi success ed error sono distinti e validati.</p>{project.flows.length > 0 && <label>Flow attivo<select aria-label="Flow attivo" value={flow?.id} onChange={(event) => setFlowId(event.target.value)}>{project.flows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}</div><button onClick={createFlow}>{project.state.experience === 'landing' ? 'Crea interazioni landing' : project.state.experience === 'dashboard' ? 'Crea flow dashboard' : 'Crea flow dati'}</button></div><Suspense fallback={<div className="flow-canvas">Caricamento editor flow…</div>}><FlowEditor flow={flow} onChange={(updated) => change({ ...project, flows: project.flows.map((item) => item.id === updated.id ? updated : item) })} /></Suspense><LogConsole logs={logs} /></main>}
    {tab === 'data' && <main className="wide-workspace"><div className="section-heading"><div><p className="eyebrow">Provider locale reale</p><h1>Dati & integrazioni</h1><p>IndexedDB conserva i record sul dispositivo. Nessun segreto richiesto o salvato.</p></div></div><section className="data-layout"><form className="settings-card" onSubmit={(event) => { event.preventDefault(); createSource() }}><h2>Nuova sorgente</h2><label>Nome<input value={sourceName} onChange={(event) => setSourceName(event.target.value)} /></label><label>Collezione<input value={collection} onChange={(event) => setCollection(event.target.value)} /></label><fieldset><legend>Schema record</legend>{(project.state.experience === 'dashboard' ? [['id', 'string', 'chiave'], ['name', 'string', 'obbligatorio'], ['description', 'string', 'obbligatorio'], ['status', 'string', 'obbligatorio'], ['priority', 'string', 'obbligatorio'], ['dueDate', 'datetime', 'obbligatorio']] : [['id', 'string', 'chiave'], ['text', 'string', 'obbligatorio'], ['date', 'datetime', 'automatico']]).map(([field, kind, note]) => <div className="schema-row" key={field}><code>{field}</code><span>{kind}</span><strong>{note}</strong></div>)}</fieldset><button type="submit">Crea sorgente IndexedDB</button></form><section><h2>Sorgenti configurate</h2>{project.dataSources.length === 0 ? <div className="empty-panel"><strong>Nessuna sorgente</strong><span>Crea il database locale per collegare la lista.</span></div> : project.dataSources.map((source) => <article className="source-card" key={source.id}><span className="provider-icon">DB</span><div><strong>{source.name}</strong><span>{source.provider} / {source.collection}</span><small>{Object.entries(source.schema).map(([key, value]) => `${key}:${value}`).join(' · ')}</small></div><span className="valid-chip">Valida</span></article>)}</section></section></main>}
    {tab === 'preview' && <main className="preview-workspace"><div className="preview-toolbar"><div className="segmented">{BREAKPOINTS.map((value) => <button key={value} className={breakpoint === value ? 'active' : ''} onClick={() => setBreakpoint(value)}>{value}</button>)}</div><label className="switch"><input type="checkbox" checked={interactive} onChange={(event) => setInteractive(event.target.checked)} />Modalità interattiva</label></div>{currentPage ? <PreviewFrame project={project} pageId={currentPage.id} breakpoint={breakpoint} interactive={interactive} onAdd={addRecord} onRefresh={refreshRecords} onDashboardAction={dashboardAction} /> : <div className="empty-panel"><strong>Nessuna pagina</strong><span>Crea una pagina per aprire la preview.</span></div>}<LogConsole logs={logs} /></main>}
    {tab === 'plugins' && <main className="wide-workspace"><PluginManager project={project} onChange={change} /></main>}
    {contextMenu && <div className="component-menu" role="menu" aria-label={`Azioni per ${contextMenu.component.name}`} style={{ left: contextMenu.x, top: contextMenu.y }}>{['Chiedi a Codex', 'Crea comportamento', 'Modifica comportamento', 'Collega dati', 'Correggi problema', 'Migliora componente', 'Spiega elemento'].map((action) => <button role="menuitem" key={action} onClick={() => askCodex(action)}>{action === 'Chiedi a Codex' ? '⌘' : '›'}<span>{action}</span></button>)}<button role="menuitem" className="menu-cancel" onClick={() => setContextMenu(undefined)}>Chiudi menu</button></div>}
    <CodexPanel open={Boolean(codexRequest)} context={codexRequest?.context} suggestedPrompt={codexRequest?.prompt ?? ''} onClose={() => setCodexRequest(undefined)} />
  </div>
}

function PanelTitle({ eyebrow, title }: { eyebrow: string; title: string }) { return <div className="panel-title"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div> }

const componentHelp = Object.fromEntries(componentTypes.map((type) => [type, `Aggiungi ${type} alla pagina. Puoi trascinarlo sul canvas oppure fare clic.`])) as Record<EditorComponent['type'], string>

function GuideBar({ project, tab, onOpen }: { project: Project; tab: WorkspaceTab; onOpen: (tab: WorkspaceTab) => void }) {
  const components = project.pages.reduce((count, page) => count + page.components.length, 0)
  const steps: { done: boolean; tab: WorkspaceTab; label: string; help: string }[] = [
    { done: project.pages.length > 0, tab: 'design', label: 'Crea una pagina', help: 'Una pagina è una schermata della tua applicazione.' },
    { done: components > 0, tab: 'design', label: 'Aggiungi elementi', help: 'Usa la palette per costruire visivamente la schermata.' },
    { done: project.dataSources.length > 0 || project.state.experience === 'landing', tab: 'data', label: 'Collega i dati', help: 'Serve solo se la pagina deve salvare o mostrare contenuti dinamici.' },
    { done: project.flows.length > 0, tab: 'flow', label: 'Crea comportamenti', help: 'Un flow collega un gesto, come un clic, al risultato desiderato.' },
    { done: false, tab: 'preview', label: 'Prova il risultato', help: 'Apri la preview e usa la pagina come farebbe un visitatore.' },
  ]
  const next = steps.find((step) => !step.done) ?? steps.at(-1)!
  return <aside className="guide-strip" aria-label="Percorso guidato"><span className="guide-kicker">Prossimo passo</span><strong>{next.label}</strong><span>{next.help}</span><button data-help={`Vai in ${next.tab} per: ${next.label}.`} onClick={() => onOpen(next.tab)}>{tab === next.tab ? 'Sei qui' : 'Portami lì'} <span aria-hidden="true">→</span></button><details><summary data-help="Mostra tutti i passi e quelli già completati.">Percorso</summary><ol>{steps.map((step) => <li className={step.done ? 'done' : step === next ? 'current' : ''} key={step.label}><button onClick={() => onOpen(step.tab)}>{step.done ? '✓' : '○'} {step.label}</button></li>)}</ol></details></aside>
}

function HelpOverlay({ children }: { children: React.ReactNode }) {
  const [help, setHelp] = useState<{ text: string; x: number; y: number }>()
  const show = (target: EventTarget | null, x?: number, y?: number) => {
    const element = target instanceof Element ? target.closest<HTMLElement>('[data-help],button,input,select,textarea,label,summary') : null
    if (!element) return setHelp(undefined)
    const text = element.dataset.help || element.getAttribute('aria-label') || (element instanceof HTMLInputElement ? element.placeholder : '') || element.textContent?.trim()
    if (text) setHelp({ text: element.dataset.help || `${text}: passa qui per usare questo controllo.`, x: x ?? element.getBoundingClientRect().left, y: y ?? element.getBoundingClientRect().bottom })
  }
  return <div className="help-surface" onPointerOver={(event) => show(event.target, event.clientX, event.clientY)} onPointerMove={(event) => show(event.target, event.clientX, event.clientY)} onPointerLeave={() => setHelp(undefined)} onFocusCapture={(event) => show(event.target)} onBlurCapture={() => setHelp(undefined)}>{children}{help && <div className="help-tooltip" role="tooltip" style={{ left: help.x, top: help.y }}>{help.text}</div>}</div>
}

function DesignComponent({ component, breakpoint, selected, onSelect, onMove, onContextMenu }: { component: EditorComponent; breakpoint: Breakpoint; selected: boolean; onSelect: (multi: boolean) => void; onMove: (direction: number) => void; onContextMenu: (bounds: CodexContext['bounds'], point: { x: number; y: number }) => void }) {
  const style = { ...component.styles.desktop, ...(breakpoint === 'desktop' ? {} : component.styles[breakpoint]) }
  const content = component.type === 'input' ? <input tabIndex={-1} placeholder={String(component.props.placeholder)} /> : component.type === 'button' ? <button tabIndex={-1}>{String(component.props.label)}</button> : component.type === 'list' ? <ul><li>Elemento dinamico</li><li>Stato vuoto e loading collegati</li></ul> : component.type === 'title' ? <h2>{String(component.props.label)}</h2> : <div>{String(component.props.label || component.type)}</div>
  return <article className={`canvas-component ${selected ? 'selected' : ''}`} data-component-id={component.id} style={style} onClick={(event) => { event.stopPropagation(); onSelect(event.ctrlKey || event.metaKey) }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); const box = event.currentTarget.getBoundingClientRect(); onContextMenu({ x: box.x, y: box.y, width: box.width, height: box.height }, { x: event.clientX, y: event.clientY }) }} data-testid={`component-${component.type}`}><span className="component-tag">{component.type}</span>{content}{selected && <div className="component-tools"><button aria-label="Sposta indietro" onClick={(event) => { event.stopPropagation(); onMove(-1) }}>↑</button><button aria-label="Sposta avanti" onClick={(event) => { event.stopPropagation(); onMove(1) }}>↓</button></div>}</article>
}

function Properties({ component, breakpoint, onUpdate, onDuplicate, onDelete }: { component: EditorComponent; breakpoint: Breakpoint; onUpdate: (update: (component: EditorComponent) => EditorComponent) => void; onDuplicate: () => void; onDelete: () => void }) {
  const style = { ...component.styles.desktop, ...(breakpoint === 'desktop' ? {} : component.styles[breakpoint]) }
  const setStyle = (key: keyof typeof style, value: string) => onUpdate((item) => ({ ...item, styles: { ...item.styles, [breakpoint]: { ...item.styles[breakpoint], [key]: value } } }))
  return <div className="properties"><label>Nome<input value={component.name} onChange={(event) => onUpdate((item) => ({ ...item, name: event.target.value }))} /></label><label>Testo / etichetta<input value={String(component.props.label ?? '')} onChange={(event) => onUpdate((item) => ({ ...item, props: { ...item.props, label: event.target.value }, accessibility: { ...item.accessibility, label: event.target.value } }))} /></label>{component.type === 'input' && <label>Placeholder<input value={String(component.props.placeholder ?? '')} onChange={(event) => onUpdate((item) => ({ ...item, props: { ...item.props, placeholder: event.target.value } }))} /></label>}<div className="field-pair"><label>Larghezza<input value={style.width} onChange={(event) => setStyle('width', event.target.value)} /></label><label>Altezza min.<input value={style.minHeight} onChange={(event) => setStyle('minHeight', event.target.value)} /></label></div><div className="field-pair"><label>Posizione X<input value={style.marginLeft} onChange={(event) => setStyle('marginLeft', event.target.value)} /></label><label>Posizione Y<input value={style.marginTop} onChange={(event) => setStyle('marginTop', event.target.value)} /></label></div><div className="field-pair"><label>Testo<input type="color" value={style.color} onChange={(event) => setStyle('color', event.target.value)} /></label><label>Sfondo<input type="color" value={style.background} onChange={(event) => setStyle('background', event.target.value)} /></label></div><label>Raggio bordi<input value={style.borderRadius} onChange={(event) => setStyle('borderRadius', event.target.value)} /></label><label>Visibilità<select value={style.display} onChange={(event) => setStyle('display', event.target.value)}><option value="block">Visibile</option><option value="none">Nascosto</option></select></label><div className="button-row"><button className="secondary" onClick={onDuplicate}>Duplica</button><button className="danger" onClick={onDelete}>Elimina</button></div></div>
}

function LogConsole({ logs }: { logs: FlowLog[] }) { return <section className="log-console" aria-labelledby="log-title"><div><h2 id="log-title">Console flow</h2><span>{logs.length ? `${logs.length} operazioni` : 'In attesa'}</span></div>{logs.length === 0 ? <p>Esegui il flow dalla preview per ispezionare input, output ed errori.</p> : <ol>{logs.map((log, index) => <li key={`${log.nodeId}-${index}`} className={log.level}><code>{log.level}</code><span>{log.message}</span></li>)}</ol>}</section> }

function icon(type: EditorComponent['type']) { return ({ input: '⌨', button: '●', list: '≡', title: 'T', text: '¶', container: '□', stack: '☰', grid: '▦', image: '▧', form: '▤', table: '▥', modal: '◫' } as Partial<Record<EditorComponent['type'], string>>)[type] ?? '◇' }

function addVerticalTemplate(project: Project): Project {
  const page = { id: crypto.randomUUID(), name: 'Attività', path: '/', components: [makeComponent('title'), makeComponent('input'), makeComponent('button'), makeComponent('list')] }
  return { ...project, pages: [page] }
}

function landingFlows(project: Project): { flows: Flow[]; pages: Project['pages'] } {
  const primary = project.pages[0]?.components.find((component) => component.props.slot === 'hero-primary')
  const secondary = project.pages[0]?.components.find((component) => component.props.slot === 'hero-secondary')
  if (!primary || !secondary) throw new Error('Pulsanti landing mancanti')
  const build = (name: string, componentId: string, action: 'navigate' | 'notify', config: Record<string, string>): Flow => {
    const event = crypto.randomUUID(), target = crypto.randomUUID()
    return { id: crypto.randomUUID(), name, nodes: [
      { id: event, type: 'event', label: `Click ${name}`, position: { x: 80, y: 100 }, config: { componentId } },
      { id: target, type: action, label: action === 'navigate' ? 'Vai alle feature' : 'Mostra notifica', position: { x: 330, y: 100 }, config },
    ], edges: [{ id: crypto.randomUUID(), source: event, target, path: 'success' }] }
  }
  const flows = [build('Esplora feature', primary.id, 'navigate', { target: 'features' }), build('Demo interattiva', secondary.id, 'notify', { message: 'Interactive demo enabled' })]
  return { flows, pages: project.pages.map((page) => ({ ...page, components: page.components.map((component) => component.id === primary.id ? { ...component, events: { click: flows[0].id } } : component.id === secondary.id ? { ...component, events: { click: flows[1].id } } : component) })) }
}

function dashboardFlows(project: Project): { flows: Flow[]; pages: Project['pages'] } {
  const source = project.dataSources[0]
  if (!source) throw new Error('Sorgente dashboard mancante')
  const components = project.pages[0]?.components ?? []
  const bySlot = (slot: string) => components.find((component) => component.props.slot === slot)
  const make = (name: string, eventComponent: EditorComponent | undefined, action: Flow['nodes'][number]['type'], withValidation = false): Flow => {
    if (!eventComponent) throw new Error(`Componente dashboard mancante per ${name}`)
    const event = crypto.randomUUID(), validate = crypto.randomUUID(), operation = crypto.randomUUID(), kpi = crypto.randomUUID(), refresh = crypto.randomUUID(), success = crypto.randomUUID(), error = crypto.randomUUID()
    const nodes: Flow['nodes'] = [{ id: event, type: 'event', label: name, position: { x: 0, y: 90 }, config: { componentId: eventComponent.id } }]
    if (withValidation) nodes.push({ id: validate, type: 'validate', label: 'Valida campi', position: { x: 180, y: 90 }, config: { message: 'Controlla i campi obbligatori' } })
    nodes.push({ id: operation, type: action, label: action === 'query' ? 'Carica progetti' : `${name} record`, position: { x: withValidation ? 360 : 180, y: 70 }, config: { sourceId: source.id } })
    if (['insert', 'update', 'delete', 'query'].includes(action)) {
      nodes.push({ id: kpi, type: 'kpi', label: 'Aggiorna KPI', position: { x: withValidation ? 550 : 370, y: 50 }, config: {} }, { id: refresh, type: 'refresh', label: 'Aggiorna tabella', position: { x: withValidation ? 730 : 550, y: 50 }, config: {} }, { id: success, type: 'notify', label: 'Toast successo', position: { x: withValidation ? 910 : 730, y: 50 }, config: { level: 'success' } }, { id: error, type: 'notify', label: 'Toast errore', position: { x: withValidation ? 550 : 370, y: 180 }, config: { level: 'error' } })
    }
    const edges: Flow['edges'] = []
    const first = withValidation ? validate : operation
    edges.push({ id: crypto.randomUUID(), source: event, target: first, path: 'success' })
    if (withValidation) { edges.push({ id: crypto.randomUUID(), source: validate, target: operation, path: 'success' }, { id: crypto.randomUUID(), source: validate, target: error, path: 'error' }) }
    if (['insert', 'update', 'delete', 'query'].includes(action)) edges.push({ id: crypto.randomUUID(), source: operation, target: kpi, path: 'success' }, { id: crypto.randomUUID(), source: operation, target: error, path: 'error' }, { id: crypto.randomUUID(), source: kpi, target: refresh, path: 'success' }, { id: crypto.randomUUID(), source: refresh, target: success, path: 'success' })
    return { id: crypto.randomUUID(), name, nodes, edges }
  }
  const flows = [
    make('Carica progetti', bySlot('projects-table'), 'query'), make('Crea progetto', bySlot('create'), 'insert', true),
    make('Aggiorna progetto', bySlot('project-form'), 'update', true), make('Elimina progetto', bySlot('detail-modal'), 'delete'),
    make('Cerca progetti', bySlot('search'), 'filter'), make('Filtra stato', bySlot('filter'), 'filter'), make('Ordina progetti', bySlot('sort'), 'sort'),
  ]
  const eventMap = new Map<string, string>([['projects-table', flows[0].id], ['create', flows[1].id], ['project-form', flows[2].id], ['detail-modal', flows[3].id], ['search', flows[4].id], ['filter', flows[5].id], ['sort', flows[6].id]])
  return { flows, pages: project.pages.map((page) => ({ ...page, components: page.components.map((component) => ({ ...component, events: eventMap.has(String(component.props.slot)) ? { change: eventMap.get(String(component.props.slot))! } : component.events, ...(component.props.slot === 'projects-table' ? { binding: { sourceId: source.id, state: 'data' as const } } : {}) })) })) }
}
