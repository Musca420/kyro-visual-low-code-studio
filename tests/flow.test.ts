import { describe, expect, it, vi } from 'vitest'
import { runFlow, safeHttpUrl } from '../src/flow'
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

  it('esegue un modulo protetto come nodo del flow', async () => {
    const advanced: Flow = { id: 'advanced', name: 'Advanced', nodes: [
      { id: 'start', type: 'event', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'module', type: 'module', label: 'Pulisci', position: { x: 1, y: 0 }, config: { moduleId: 'clean' } },
      { id: 'log', type: 'log', label: 'Result', position: { x: 2, y: 0 }, config: {} },
    ], edges: [
      { id: '1', source: 'start', target: 'module', path: 'success' },
      { id: '2', source: 'module', target: 'log', path: 'success' },
    ] }
    const logs = await runFlow(advanced, { input: ' prova ', insert: async () => undefined, refresh: async () => undefined, runModule: (_id, value) => String(value).trim() })
    expect(logs.find((entry) => entry.nodeId === 'module')?.value).toBe('prova')
  })

  it('compone testo, conserva stato e attende senza bloccare il flow', async () => {
    const state = new Map<string, unknown>()
    const stateful: Flow = { id: 'state', name: 'State', nodes: [
      { id: 'event', type: 'event', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'format', type: 'format', label: 'Format', position: { x: 1, y: 0 }, config: { template: 'Ciao {{value}}' } },
      { id: 'set', type: 'setState', label: 'Save', position: { x: 2, y: 0 }, config: { key: 'greeting' } },
      { id: 'delay', type: 'delay', label: 'Wait', position: { x: 3, y: 0 }, config: { ms: '1' } },
      { id: 'get', type: 'getState', label: 'Read', position: { x: 4, y: 0 }, config: { key: 'greeting' } },
    ], edges: ['event', 'format', 'set', 'delay'].map((source, index) => ({ id: String(index), source, target: ['format', 'set', 'delay', 'get'][index], path: 'success' })) }
    const logs = await runFlow(stateful, { input: 'Canva', insert: async () => undefined, refresh: async () => undefined, getState: (key) => state.get(key), setState: (key, value) => state.set(key, value), resetState: (key) => void state.delete(key) })
    expect(logs.at(-1)?.value).toBe('Ciao Canva')
  })

  it('chiama un API senza accettare protocolli eseguibili', async () => {
    const api: Flow = { id: 'api', name: 'API', nodes: [
      { id: 'event', type: 'event', label: 'Start', position: { x: 0, y: 0 }, config: {} },
      { id: 'http', type: 'http', label: 'Create', position: { x: 1, y: 0 }, config: { url: 'https://api.example.test/items', method: 'POST', body: '{"name":"{{value}}"}' } },
    ], edges: [{ id: 'edge', source: 'event', target: 'http', path: 'success' }] }
    const request = vi.fn(async () => ({ id: '1' }))
    const logs = await runFlow(api, { input: 'Canva', insert: async () => undefined, refresh: async () => undefined, request })
    expect(request).toHaveBeenCalledWith('https://api.example.test/items', 'POST', '{"name":"Canva"}')
    expect(logs.at(-1)?.value).toEqual({ id: '1' })
    expect(() => safeHttpUrl('javascript:alert(1)')).toThrow('HTTP o HTTPS')
  })
})
