import { describe, expect, it, vi } from 'vitest'
import { runFlow } from '../src/flow'
import type { Flow } from '../src/model'

const flow: Flow = {
  id: 'flow', name: 'Create',
  nodes: [
    { id: 'event', type: 'event', label: 'Click', position: { x: 0, y: 0 }, config: {} },
    { id: 'read', type: 'readInput', label: 'Read', position: { x: 1, y: 0 }, config: { componentId: 'input' } },
    { id: 'validate', type: 'validate', label: 'Required', position: { x: 2, y: 0 }, config: { message: 'Required' } },
    { id: 'insert', type: 'insert', label: 'Insert', position: { x: 3, y: 0 }, config: { sourceId: 'db' } },
    { id: 'refresh', type: 'refresh', label: 'Refresh', position: { x: 4, y: 0 }, config: {} },
    { id: 'error', type: 'notify', label: 'Error', position: { x: 3, y: 1 }, config: {} },
  ],
  edges: [
    { id: '1', source: 'event', target: 'read', path: 'success' }, { id: '2', source: 'read', target: 'validate', path: 'success' },
    { id: '3', source: 'validate', target: 'insert', path: 'success' }, { id: '4', source: 'validate', target: 'error', path: 'error' },
    { id: '5', source: 'insert', target: 'refresh', path: 'success' }, { id: '6', source: 'insert', target: 'error', path: 'error' },
  ],
}

describe('flow runtime', () => {
  it('runs the success path deterministically', async () => {
    const insert = vi.fn(async (text: string) => ({ text }))
    const refresh = vi.fn(async () => undefined)
    const logs = await runFlow(flow, { input: ' Ship it ', insert, refresh })
    expect(insert).toHaveBeenCalledWith('Ship it', 'db')
    expect(refresh).toHaveBeenCalledOnce()
    expect(logs.map((log) => log.nodeId)).toEqual(['event', 'read', 'validate', 'insert', 'refresh'])
  })

  it('uses the error path and never inserts invalid input', async () => {
    const insert = vi.fn(async () => undefined)
    const logs = await runFlow(flow, { input: '  ', insert, refresh: async () => undefined })
    expect(insert).not.toHaveBeenCalled()
    expect(logs.some((log) => log.level === 'error' && log.message === 'Required')).toBe(true)
    expect(logs.at(-1)?.nodeId).toBe('error')
  })

  it('stops uncontrolled loops', async () => {
    const cyclic: Flow = { id: 'cycle', name: 'cycle', nodes: [{ id: 'event', type: 'event', label: 'Event', position: { x: 0, y: 0 }, config: {} }], edges: [{ id: 'loop', source: 'event', target: 'event', path: 'success' }] }
    await expect(runFlow(cyclic, { input: '', insert: async () => undefined, refresh: async () => undefined })).rejects.toThrow('Loop non controllato')
  })

  it('routes timed out operations to the error path', async () => {
    const logs = await runFlow(flow, { input: 'slow', insert: () => new Promise(() => undefined), refresh: async () => undefined, timeoutMs: 10 })
    expect(logs.some((log) => log.level === 'error' && log.message === 'Timeout del flow')).toBe(true)
    expect(logs.at(-1)?.nodeId).toBe('error')
  })

  it('carica, filtra, ordina e calcola un KPI mostrando il valore attraversato', async () => {
    const nodes: Flow['nodes'] = [
      { id: 'start', type: 'event', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'query', type: 'query', label: 'Query', position: { x: 1, y: 0 }, config: { sourceId: 'db' } },
      { id: 'filter', type: 'filter', label: 'Filter', position: { x: 2, y: 0 }, config: { field: 'status', value: 'done' } },
      { id: 'sort', type: 'sort', label: 'Sort', position: { x: 3, y: 0 }, config: { field: 'name', direction: 'desc' } },
      { id: 'kpi', type: 'kpi', label: 'Count', position: { x: 4, y: 0 }, config: { operation: 'count' } },
      { id: 'notify', type: 'notify', label: 'Notify', position: { x: 5, y: 0 }, config: { message: 'Calcolo pronto', level: 'success' } },
    ]
    const visual: Flow = { id: 'visual', name: 'Visual', nodes, edges: nodes.slice(1).map((node, index) => ({ id: String(index), source: nodes[index].id, target: node.id, path: 'success' })) }
    const notify = vi.fn()
    const logs = await runFlow(visual, { input: '', insert: async () => undefined, refresh: async () => undefined, query: async () => [{ name: 'Alpha', status: 'done' }, { name: 'Beta', status: 'todo' }, { name: 'Gamma', status: 'done' }], notify })
    expect(logs.find((entry) => entry.nodeId === 'kpi')?.value).toBe(2)
    expect(notify).toHaveBeenCalledWith('Calcolo pronto', 'success')
  })

  it('dirama una condizione non verificata senza trasformarla in errore runtime', async () => {
    const conditional: Flow = { id: 'condition', name: 'Condition', nodes: [
      { id: 'start', type: 'event', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'condition', type: 'condition', label: 'Solo admin', position: { x: 1, y: 0 }, config: { field: '', operator: 'equals', value: 'admin' } },
      { id: 'yes', type: 'notify', label: 'Allowed', position: { x: 2, y: 0 }, config: { message: 'Sì' } },
      { id: 'no', type: 'notify', label: 'Denied', position: { x: 2, y: 1 }, config: { message: 'No' } },
    ], edges: [
      { id: '1', source: 'start', target: 'condition', path: 'success' },
      { id: '2', source: 'condition', target: 'yes', path: 'success' },
      { id: '3', source: 'condition', target: 'no', path: 'error' },
    ] }
    const notify = vi.fn()
    const logs = await runFlow(conditional, { input: 'viewer', insert: async () => undefined, refresh: async () => undefined, notify })
    expect(logs.some((entry) => entry.level === 'error')).toBe(false)
    expect(notify).toHaveBeenCalledWith('No', 'error')
  })
})
