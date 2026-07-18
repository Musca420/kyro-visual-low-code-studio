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
    expect(insert).toHaveBeenCalledWith('Ship it')
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
})
