import { useState } from 'react'
import { Background, Controls, Handle, Position, ReactFlow, addEdge, type Connection, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { flowNodeTypes, type EditorComponent, type Flow, type FlowNode, type Project } from './model'
import { CodeModuleEditor } from './CodeModuleEditor'

const colors: Record<string, string> = { event: '#7c3aed', readInput: '#2563eb', validate: '#d97706', condition: '#ea580c', switch: '#dc2626', loop: '#e11d48', getState: '#8b5cf6', setState: '#7c3aed', resetState: '#6d28d9', delay: '#f59e0b', debounce: '#f97316', format: '#a855f7', map: '#c026d3', http: '#0ea5e9', insert: '#059669', query: '#0f766e', update: '#15803d', delete: '#b91c1c', filter: '#9333ea', sort: '#4f46e5', kpi: '#c2410c', refresh: '#0891b2', navigate: '#0369a1', openModal: '#be185d', notify: '#db2777', module: '#06b6d4', log: '#64748b' }
const labels: Record<FlowNode['type'], string> = { event: 'Evento', readInput: 'Leggi input', validate: 'Valida', condition: 'Condizione', switch: 'Scegli percorso', loop: 'Per ogni elemento', getState: 'Leggi stato', setState: 'Salva stato', resetState: 'Azzera stato', delay: 'Attendi', debounce: 'Limita input rapidi', format: 'Componi testo', map: 'Trasforma elenco', http: 'Chiama API', insert: 'Crea record', query: 'Carica dati', update: 'Aggiorna record', delete: 'Elimina record', filter: 'Filtra', sort: 'Ordina', kpi: 'Calcola KPI', refresh: 'Aggiorna UI', navigate: 'Vai alla pagina', openModal: 'Apri modal', notify: 'Mostra notifica', module: 'Funzione avanzata', log: 'Debug' }
const defaults: Record<FlowNode['type'], Record<string, string>> = { event: {}, readInput: {}, validate: { message: 'Questo valore è obbligatorio' }, condition: { field: '', operator: 'equals', value: '' }, switch: { field: '', cases: 'bozza,in corso,completato' }, loop: { max: '100' }, getState: { key: 'value' }, setState: { key: 'value' }, resetState: { key: 'value' }, delay: { ms: '300' }, debounce: { ms: '300' }, format: { template: '{{value}}' }, map: { field: 'text', template: '{{value}}' }, http: { url: 'https://api.example.com/items', method: 'GET', body: '{{value}}' }, insert: {}, query: {}, update: {}, delete: {}, filter: { field: 'text', value: '' }, sort: { field: 'date', direction: 'asc' }, kpi: { operation: 'count' }, refresh: {}, navigate: { path: '/' }, openModal: {}, notify: { message: 'Operazione completata', level: 'success' }, module: {}, log: { message: 'Valore corrente' } }
type ValueType = 'unknown' | 'string' | 'record' | 'list' | 'number'
const ports: Record<FlowNode['type'], { input: ValueType; output: ValueType }> = { event: { input: 'unknown', output: 'unknown' }, readInput: { input: 'unknown', output: 'string' }, validate: { input: 'unknown', output: 'unknown' }, condition: { input: 'unknown', output: 'unknown' }, switch: { input: 'unknown', output: 'unknown' }, loop: { input: 'list', output: 'unknown' }, getState: { input: 'unknown', output: 'unknown' }, setState: { input: 'unknown', output: 'unknown' }, resetState: { input: 'unknown', output: 'unknown' }, delay: { input: 'unknown', output: 'unknown' }, debounce: { input: 'unknown', output: 'unknown' }, format: { input: 'unknown', output: 'string' }, map: { input: 'list', output: 'list' }, http: { input: 'unknown', output: 'unknown' }, insert: { input: 'string', output: 'record' }, query: { input: 'unknown', output: 'list' }, update: { input: 'record', output: 'record' }, delete: { input: 'record', output: 'unknown' }, filter: { input: 'list', output: 'list' }, sort: { input: 'list', output: 'list' }, kpi: { input: 'list', output: 'number' }, refresh: { input: 'unknown', output: 'unknown' }, navigate: { input: 'unknown', output: 'unknown' }, openModal: { input: 'unknown', output: 'unknown' }, notify: { input: 'unknown', output: 'unknown' }, module: { input: 'unknown', output: 'unknown' }, log: { input: 'unknown', output: 'unknown' } }

function FlowNode({ data }: NodeProps) {
  const value = data as { label: string; type: string; input: ValueType; output: ValueType; cases?: string[] }
  return <div className="flow-node" style={{ borderColor: colors[value.type] ?? '#64748b' }}>
    {value.type !== 'event' && <Handle type="target" position={Position.Left} />}
    <small>{value.type}</small><strong>{value.label}</strong>
    {!['switch', 'loop'].includes(value.type) && <Handle type="source" position={Position.Right} id="success" />}
    {value.type === 'loop' && <Handle type="source" position={Position.Right} id="each" title="Ogni elemento" />}
    <span className="port-types">{value.input} → {value.output}</span>
    {['validate', 'condition', 'switch'].includes(value.type) && <Handle type="source" position={Position.Bottom} id="error" style={value.type === 'switch' ? { left: '10%' } : undefined} />}
    {value.type === 'switch' && value.cases?.map((item, index) => <Handle key={item} type="source" position={Position.Bottom} id={`case:${item}`} title={item} style={{ left: `${25 + index * (65 / Math.max(1, value.cases!.length - 1))}%` }} />)}
    {value.type === 'loop' && <Handle type="source" position={Position.Bottom} id="done" title="Completato" />}
  </div>
}

const nodeTypes = { editor: FlowNode }

export default function FlowEditor({ flow, components, sources, modules, selectedNodeId, onChange, onModulesChange, onCreateModule, onNodeSelect }: { flow?: Flow; components: EditorComponent[]; sources: Project['dataSources']; modules: Project['codeModules']; selectedNodeId?: string; onChange: (flow: Flow) => void; onModulesChange: (modules: Project['codeModules']) => void; onCreateModule: (module: Project['codeModules'][number], nodeId: string) => void; onNodeSelect?: (nodeId: string) => void }) {
  const [connectionError, setConnectionError] = useState('')
  const [paletteQuery, setPaletteQuery] = useState('')
  const portFor = (node: FlowNode) => node.type === 'module' ? (() => {
    const module = modules.find((item) => item.id === node.config.moduleId)
    return module ? { input: module.inputType, output: module.outputType } : ports.module
  })() : ports[node.type]
  const nodes: Node[] = (flow?.nodes ?? []).map((node) => ({ id: node.id, type: 'editor', position: node.position, selected: node.id === selectedNodeId, data: { label: node.label, type: node.type, cases: node.type === 'switch' ? node.config.cases?.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 4) : undefined, ...portFor(node) } }))
  const edges: Edge[] = (flow?.edges ?? []).map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.path, label: edge.path, animated: edge.path === 'success' }))
  const selected = flow?.nodes.find((node) => node.id === selectedNodeId)
  const addNode = (type: FlowNode['type']) => {
    if (!flow) return
    const index = flow.nodes.length
    const node: FlowNode = { id: crypto.randomUUID(), type, label: labels[type], position: { x: 80 + (index % 4) * 190, y: 80 + Math.floor(index / 4) * 120 }, config: defaults[type] }
    onChange({ ...flow, nodes: [...flow.nodes, node] })
    onNodeSelect?.(node.id)
  }
  const updateSelected = (patch: Partial<FlowNode>) => selected && flow && onChange({ ...flow, nodes: flow.nodes.map((node) => node.id === selected.id ? { ...node, ...patch } : node) })
  const setConfig = (key: string, value: string) => selected && updateSelected({ config: { ...selected.config, [key]: value } })
  const removeSelected = () => {
    if (!selected || !flow) return
    onChange({ ...flow, nodes: flow.nodes.filter((node) => node.id !== selected.id), edges: flow.edges.filter((edge) => edge.source !== selected.id && edge.target !== selected.id) })
    onNodeSelect?.('')
  }
  const connect = (connection: Connection) => {
    if (!flow || !connection.source || !connection.target) return
    const source = flow.nodes.find((node) => node.id === connection.source), target = flow.nodes.find((node) => node.id === connection.target)
    if (!source || !target) return
    const output = portFor(source).output, input = portFor(target).input
    if (output !== 'unknown' && input !== 'unknown' && output !== input) return setConnectionError(`Collegamento non valido: ${labels[source.type]} produce ${output}, ${labels[target.type]} richiede ${input}.`)
    setConnectionError('')
    const updated = addEdge(connection, edges)
    onChange({ ...flow, edges: updated.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, path: edge.sourceHandle || 'success' })) })
  }
  if (!flow) return <div className="empty-panel"><strong>Nessun flow</strong><span>Crea il flow dati dopo aver aggiunto input, pulsante, lista e sorgente locale.</span></div>
  const matchingTypes = flowNodeTypes.filter((type) => `${labels[type]} ${type}`.toLowerCase().includes(paletteQuery.trim().toLowerCase()))
  const groups: { label: string; types: FlowNode['type'][]; open?: boolean }[] = [
    { label: 'Interazioni', open: true, types: ['event', 'readInput', 'validate', 'condition', 'switch', 'delay', 'format', 'navigate', 'openModal', 'notify'] },
    { label: 'Dati e API', types: ['insert', 'query', 'update', 'delete', 'filter', 'sort', 'map', 'kpi', 'http'] },
    { label: 'Avanzato', types: ['getState', 'setState', 'resetState', 'loop', 'debounce', 'refresh', 'module', 'log'] },
  ]
  const nodeButtons = (types: readonly FlowNode['type'][]) => <div>{types.map((type) => <button type="button" className="secondary" key={type} onClick={() => addNode(type)}><i style={{ background: colors[type] }} />{labels[type]}</button>)}</div>
  return <div className="flow-builder">
    <aside className="flow-palette" aria-label="Aggiungi nodi al flow">
      <strong>Aggiungi nodo</strong>
      <span>Scegli cosa deve accadere, poi collega i pallini.</span>
      <input type="search" aria-label="Cerca azione" placeholder="Cerca: notifica, dati, API…" value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} />
      {paletteQuery.trim() ? nodeButtons(matchingTypes) : <div className="flow-groups">{groups.map((group) => <details key={group.label} open={group.open}><summary>{group.label}<span>{group.types.length}</span></summary>{nodeButtons(group.types)}</details>)}</div>}
    </aside>
    <div className="flow-canvas" aria-label="Editor grafico del flow">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onNodeSelect?.(node.id)}
      onConnect={connect}
      onNodesChange={(changes) => {
        const positions = new Map(changes.flatMap((change) => change.type === 'position' && change.position ? [[change.id, change.position] as const] : []))
        if (positions.size) onChange({ ...flow, nodes: flow.nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position })) })
      }}
      fitView
      deleteKeyCode={null}
    ><Background /><Controls /></ReactFlow>
    </div>
    <aside className="flow-inspector" aria-label="Configura nodo selezionato">
      {selected ? <>
        <strong>{labels[selected.type]}</strong>
        <label>Nome visibile<input aria-label="Nome nodo" value={selected.label} onChange={(event) => updateSelected({ label: event.target.value })} /></label>
        <label className="switch"><input aria-label="Ferma qui durante il debug" type="checkbox" checked={selected.config.breakpoint === 'true'} onChange={(event) => setConfig('breakpoint', String(event.target.checked))} /> Ferma qui durante il debug</label>
        {['event', 'readInput', 'refresh', 'openModal'].includes(selected.type) && <label>Elemento<select aria-label="Elemento collegato" value={selected.config.componentId ?? ''} onChange={(event) => setConfig('componentId', event.target.value)}><option value="">Scegli elemento…</option>{components.map((component) => <option key={component.id} value={component.id}>{component.name} · {component.type}</option>)}</select></label>}
        {['insert', 'query', 'update', 'delete'].includes(selected.type) && <label>Sorgente dati<select aria-label="Sorgente collegata" value={selected.config.sourceId ?? ''} onChange={(event) => setConfig('sourceId', event.target.value)}><option value="">Scegli sorgente…</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>}
        {selected.type === 'validate' && <label>Messaggio di errore<input aria-label="Messaggio validazione" value={selected.config.message ?? ''} onChange={(event) => setConfig('message', event.target.value)} /></label>}
        {selected.type === 'condition' && <><label>Campo opzionale<input aria-label="Campo condizione" value={selected.config.field ?? ''} onChange={(event) => setConfig('field', event.target.value)} /></label><label>Confronto<select aria-label="Operatore condizione" value={selected.config.operator ?? 'equals'} onChange={(event) => setConfig('operator', event.target.value)}><option value="equals">È uguale a</option><option value="notEquals">Non è uguale a</option><option value="contains">Contiene</option><option value="greater">È maggiore di</option><option value="less">È minore di</option><option value="exists">Esiste</option></select></label>{selected.config.operator !== 'exists' && <label>Valore<input aria-label="Valore condizione" value={selected.config.value ?? ''} onChange={(event) => setConfig('value', event.target.value)} /></label>}</>}
        {selected.type === 'switch' && <><label>Campo opzionale<input aria-label="Campo scelta" value={selected.config.field ?? ''} onChange={(event) => setConfig('field', event.target.value)} /></label><label>Casi separati da virgola<input aria-label="Casi scelta" value={selected.config.cases ?? ''} onChange={(event) => setConfig('cases', event.target.value)} /></label><small>Ogni caso appare come un pallino sotto il nodo. Il pallino rosso è il percorso “altro”.</small></>}
        {selected.type === 'loop' && <><label>Numero massimo di elementi<input aria-label="Limite ciclo" type="number" min="1" max="100" value={selected.config.max ?? '100'} onChange={(event) => setConfig('max', event.target.value)} /></label><small>Collega “Ogni elemento” alle azioni da ripetere, poi riporta l’ultima azione a questo nodo. “Completato” prosegue dopo il ciclo.</small></>}
        {['getState', 'setState', 'resetState'].includes(selected.type) && <label>Nome dello stato<input aria-label="Nome stato" value={selected.config.key ?? ''} onChange={(event) => setConfig('key', event.target.value)} /></label>}
        {['delay', 'debounce'].includes(selected.type) && <label>{selected.type === 'debounce' ? 'Pausa dopo l’ultimo input' : 'Attesa in millisecondi'}<input aria-label={selected.type === 'debounce' ? 'Durata debounce' : 'Durata attesa'} type="number" min="0" max="10000" value={selected.config.ms ?? '300'} onChange={(event) => setConfig('ms', event.target.value)} /></label>}
        {selected.type === 'format' && <label>Modello di testo<input aria-label="Formato testo" value={selected.config.template ?? '{{value}}'} onChange={(event) => setConfig('template', event.target.value)} /></label>}
        {selected.type === 'map' && <><label>Campo di ogni elemento<input aria-label="Campo trasformazione" value={selected.config.field ?? ''} onChange={(event) => setConfig('field', event.target.value)} /></label><label>Modello risultato<input aria-label="Formato trasformazione" value={selected.config.template ?? '{{value}}'} onChange={(event) => setConfig('template', event.target.value)} /></label></>}
        {selected.type === 'http' && <><label>Indirizzo API<input aria-label="Indirizzo API" type="url" value={selected.config.url ?? ''} onChange={(event) => setConfig('url', event.target.value)} /></label><label>Operazione<select aria-label="Metodo API" value={selected.config.method ?? 'GET'} onChange={(event) => setConfig('method', event.target.value)}><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select></label>{selected.config.method !== 'GET' && <label>Corpo richiesta<textarea aria-label="Corpo richiesta API" value={selected.config.body ?? '{{value}}'} onChange={(event) => setConfig('body', event.target.value)} /></label>}<small>Nessuna password viene salvata qui. Per credenziali usa una variabile d’ambiente e un backend.</small></>}
        {selected.type === 'filter' && <><label>Campo<input aria-label="Campo filtro" value={selected.config.field ?? ''} onChange={(event) => setConfig('field', event.target.value)} /></label><label>Valore<input aria-label="Valore filtro" value={selected.config.value ?? ''} onChange={(event) => setConfig('value', event.target.value)} /></label></>}
        {selected.type === 'sort' && <><label>Campo<input aria-label="Campo ordinamento" value={selected.config.field ?? ''} onChange={(event) => setConfig('field', event.target.value)} /></label><label>Direzione<select aria-label="Direzione ordinamento" value={selected.config.direction ?? 'asc'} onChange={(event) => setConfig('direction', event.target.value)}><option value="asc">Crescente</option><option value="desc">Decrescente</option></select></label></>}
        {selected.type === 'kpi' && <><label>Calcolo<select aria-label="Calcolo KPI" value={selected.config.operation ?? 'count'} onChange={(event) => setConfig('operation', event.target.value)}><option value="count">Conta record</option><option value="sum">Somma un campo</option><option value="average">Media di un campo</option></select></label>{selected.config.operation !== 'count' && <label>Campo numerico<input aria-label="Campo KPI" value={selected.config.field ?? ''} onChange={(event) => setConfig('field', event.target.value)} /></label>}</>}
        {selected.type === 'navigate' && <label>Pagina<input aria-label="Percorso navigazione" value={selected.config.path ?? '/'} onChange={(event) => setConfig('path', event.target.value)} /></label>}
        {['notify', 'log'].includes(selected.type) && <label>Messaggio<input aria-label="Messaggio nodo" value={selected.config.message ?? ''} onChange={(event) => setConfig('message', event.target.value)} /></label>}
        {selected.type === 'notify' && <label>Tipo notifica<select aria-label="Tipo notifica" value={selected.config.level ?? 'success'} onChange={(event) => setConfig('level', event.target.value)}><option value="success">Successo</option><option value="error">Errore</option><option value="info">Informazione</option></select></label>}
        {selected.type === 'module' && <><label>Modulo<select aria-label="Modulo collegato" value={selected.config.moduleId ?? ''} onChange={(event) => setConfig('moduleId', event.target.value)}><option value="">Scegli modulo…</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}</select></label><button type="button" className="secondary" onClick={() => {
          const module = { id: crypto.randomUUID(), name: 'Pulisci testo', description: '', inputType: 'string' as const, outputType: 'string' as const, operation: 'trim' as const, config: {}, tests: [{ id: crypto.randomUUID(), input: ' prova ', expected: 'prova' }] };
          onCreateModule(module, selected.id);
        }}>Nuovo modulo protetto</button>{modules.find((module) => module.id === selected.config.moduleId) && <CodeModuleEditor module={modules.find((module) => module.id === selected.config.moduleId)!} onChange={(updated) => onModulesChange(modules.map((module) => module.id === updated.id ? updated : module))} />}</>}
        <button type="button" className="danger" onClick={removeSelected}>Elimina nodo</button>
      </> : <p>Seleziona un nodo per configurarlo.</p>}
      {connectionError && <p role="alert" className="flow-connection-error">{connectionError}</p>}
    </aside>
  </div>
}
