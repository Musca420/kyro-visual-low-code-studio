import { useCallback } from 'react'
import { Background, Controls, Handle, Position, ReactFlow, addEdge, type Connection, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { flowNodeTypes, type EditorComponent, type Flow, type FlowNode, type Project } from './model'

const colors: Record<string, string> = { event: '#7c3aed', readInput: '#2563eb', validate: '#d97706', insert: '#059669', query: '#0f766e', update: '#15803d', delete: '#b91c1c', filter: '#9333ea', sort: '#4f46e5', kpi: '#c2410c', refresh: '#0891b2', navigate: '#0369a1', openModal: '#be185d', notify: '#db2777', log: '#64748b' }
const labels: Record<FlowNode['type'], string> = { event: 'Evento', readInput: 'Leggi input', validate: 'Valida', insert: 'Crea record', query: 'Carica dati', update: 'Aggiorna record', delete: 'Elimina record', filter: 'Filtra', sort: 'Ordina', kpi: 'Calcola KPI', refresh: 'Aggiorna UI', navigate: 'Vai alla pagina', openModal: 'Apri modal', notify: 'Mostra notifica', log: 'Debug' }
const defaults: Record<FlowNode['type'], Record<string, string>> = { event: {}, readInput: {}, validate: { message: 'Questo valore è obbligatorio' }, insert: {}, query: {}, update: {}, delete: {}, filter: { field: 'text', value: '' }, sort: { field: 'date', direction: 'asc' }, kpi: { operation: 'count' }, refresh: {}, navigate: { path: '/' }, openModal: {}, notify: { message: 'Operazione completata', level: 'success' }, log: { message: 'Valore corrente' } }

function FlowNode({ data }: NodeProps) {
  const value = data as { label: string; type: string }
  return <div className="flow-node" style={{ borderColor: colors[value.type] ?? '#64748b' }}>
    {value.type !== 'event' && <Handle type="target" position={Position.Left} />}
    <small>{value.type}</small><strong>{value.label}</strong>
    <Handle type="source" position={Position.Right} id="success" />
    {value.type === 'validate' && <Handle type="source" position={Position.Bottom} id="error" />}
  </div>
}

const nodeTypes = { editor: FlowNode }

export default function FlowEditor({ flow, components, sources, selectedNodeId, onChange, onNodeSelect }: { flow?: Flow; components: EditorComponent[]; sources: Project['dataSources']; selectedNodeId?: string; onChange: (flow: Flow) => void; onNodeSelect?: (nodeId: string) => void }) {
  const nodes: Node[] = (flow?.nodes ?? []).map((node) => ({ id: node.id, type: 'editor', position: node.position, selected: node.id === selectedNodeId, data: { label: node.label, type: node.type } }))
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
  const connect = useCallback((connection: Connection) => {
    if (!flow || !connection.source || !connection.target) return
    const updated = addEdge(connection, edges)
    onChange({ ...flow, edges: updated.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, path: edge.sourceHandle === 'error' ? 'error' : 'success' })) })
  }, [flow, edges, onChange])
  if (!flow) return <div className="empty-panel"><strong>Nessun flow</strong><span>Crea il flow dati dopo aver aggiunto input, pulsante, lista e sorgente locale.</span></div>
  return <div className="flow-builder">
    <aside className="flow-palette" aria-label="Aggiungi nodi al flow">
      <strong>Aggiungi nodo</strong>
      <span>Scegli cosa deve accadere, poi collega i pallini.</span>
      <div>{flowNodeTypes.map((type) => <button type="button" className="secondary" key={type} onClick={() => addNode(type)}><i style={{ background: colors[type] }} />{labels[type]}</button>)}</div>
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
        {['event', 'readInput', 'refresh', 'openModal'].includes(selected.type) && <label>Elemento<select aria-label="Elemento collegato" value={selected.config.componentId ?? ''} onChange={(event) => setConfig('componentId', event.target.value)}><option value="">Scegli elemento…</option>{components.map((component) => <option key={component.id} value={component.id}>{component.name} · {component.type}</option>)}</select></label>}
        {['insert', 'query', 'update', 'delete'].includes(selected.type) && <label>Sorgente dati<select aria-label="Sorgente collegata" value={selected.config.sourceId ?? ''} onChange={(event) => setConfig('sourceId', event.target.value)}><option value="">Scegli sorgente…</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>}
        {selected.type === 'validate' && <label>Messaggio di errore<input aria-label="Messaggio validazione" value={selected.config.message ?? ''} onChange={(event) => setConfig('message', event.target.value)} /></label>}
        {selected.type === 'filter' && <><label>Campo<input aria-label="Campo filtro" value={selected.config.field ?? ''} onChange={(event) => setConfig('field', event.target.value)} /></label><label>Valore<input aria-label="Valore filtro" value={selected.config.value ?? ''} onChange={(event) => setConfig('value', event.target.value)} /></label></>}
        {selected.type === 'sort' && <><label>Campo<input aria-label="Campo ordinamento" value={selected.config.field ?? ''} onChange={(event) => setConfig('field', event.target.value)} /></label><label>Direzione<select aria-label="Direzione ordinamento" value={selected.config.direction ?? 'asc'} onChange={(event) => setConfig('direction', event.target.value)}><option value="asc">Crescente</option><option value="desc">Decrescente</option></select></label></>}
        {selected.type === 'kpi' && <><label>Calcolo<select aria-label="Calcolo KPI" value={selected.config.operation ?? 'count'} onChange={(event) => setConfig('operation', event.target.value)}><option value="count">Conta record</option><option value="sum">Somma un campo</option><option value="average">Media di un campo</option></select></label>{selected.config.operation !== 'count' && <label>Campo numerico<input aria-label="Campo KPI" value={selected.config.field ?? ''} onChange={(event) => setConfig('field', event.target.value)} /></label>}</>}
        {selected.type === 'navigate' && <label>Pagina<input aria-label="Percorso navigazione" value={selected.config.path ?? '/'} onChange={(event) => setConfig('path', event.target.value)} /></label>}
        {['notify', 'log'].includes(selected.type) && <label>Messaggio<input aria-label="Messaggio nodo" value={selected.config.message ?? ''} onChange={(event) => setConfig('message', event.target.value)} /></label>}
        {selected.type === 'notify' && <label>Tipo notifica<select aria-label="Tipo notifica" value={selected.config.level ?? 'success'} onChange={(event) => setConfig('level', event.target.value)}><option value="success">Successo</option><option value="error">Errore</option><option value="info">Informazione</option></select></label>}
        <button type="button" className="danger" onClick={removeSelected}>Elimina nodo</button>
      </> : <p>Seleziona un nodo per configurarlo.</p>}
    </aside>
  </div>
}
