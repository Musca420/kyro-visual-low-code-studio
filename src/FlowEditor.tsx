import { useCallback } from 'react'
import { Background, Controls, Handle, Position, ReactFlow, addEdge, type Connection, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Flow } from './model'

const colors: Record<string, string> = { event: '#7c3aed', readInput: '#2563eb', validate: '#d97706', insert: '#059669', refresh: '#0891b2', notify: '#db2777', log: '#64748b' }

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

export default function FlowEditor({ flow, onChange, onNodeSelect }: { flow?: Flow; onChange: (flow: Flow) => void; onNodeSelect?: (nodeId: string) => void }) {
  const nodes: Node[] = (flow?.nodes ?? []).map((node) => ({ id: node.id, type: 'editor', position: node.position, data: { label: node.label, type: node.type } }))
  const edges: Edge[] = (flow?.edges ?? []).map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.path, label: edge.path, animated: edge.path === 'success' }))
  const connect = useCallback((connection: Connection) => {
    if (!flow || !connection.source || !connection.target) return
    const updated = addEdge(connection, edges)
    onChange({ ...flow, edges: updated.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, path: edge.sourceHandle === 'error' ? 'error' : 'success' })) })
  }, [flow, edges, onChange])
  if (!flow) return <div className="empty-panel"><strong>Nessun flow</strong><span>Crea il flow dati dopo aver aggiunto input, pulsante, lista e sorgente locale.</span></div>
  return <div className="flow-canvas" aria-label="Editor grafico del flow">
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
}
