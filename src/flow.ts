import type { Flow } from './model'

export type FlowLog = { nodeId: string; level: 'info' | 'error'; message: string; value?: unknown }
export type FlowContext = {
  input: string
  insert: (text: string) => Promise<unknown>
  refresh: () => Promise<void>
  signal?: AbortSignal
  timeoutMs?: number
}

export async function runFlow(flow: Flow, context: FlowContext): Promise<FlowLog[]> {
  const logs: FlowLog[] = []
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]))
  const event = flow.nodes.find((node) => node.type === 'event')
  if (!event) throw new Error('Il flow non contiene un evento iniziale')
  let node = event
  let value: unknown = context.input
  let path: 'success' | 'error' = 'success'
  const visited = new Map<string, number>()
  while (node) {
    if (context.signal?.aborted) throw new DOMException('Flow annullato', 'AbortError')
    const count = (visited.get(node.id) ?? 0) + 1
    visited.set(node.id, count)
    if (count > 1) throw new Error(`Loop non controllato al nodo ${node.label}`)
    try {
      if (node.type === 'readInput') value = context.input
      if (node.type === 'validate' && (typeof value !== 'string' || !value.trim())) throw new Error(node.config.message || 'Il valore è obbligatorio')
      if (node.type === 'insert') value = await guarded(context.insert(String(value).trim()), context)
      if (node.type === 'refresh') await guarded(context.refresh(), context)
      logs.push({ nodeId: node.id, level: 'info', message: `${node.label}: completato`, value })
      path = 'success'
    } catch (error) {
      path = 'error'
      logs.push({ nodeId: node.id, level: 'error', message: error instanceof Error ? error.message : String(error) })
    }
    const edge = flow.edges.find((candidate) => candidate.source === node.id && candidate.path === path)
    if (!edge) {
      if (path === 'error') return logs
      break
    }
    const next = nodes.get(edge.target)
    if (!next) throw new Error(`Nodo destinazione mancante: ${edge.target}`)
    node = next
  }
  return logs
}

function guarded<T>(operation: Promise<T>, context: FlowContext): Promise<T> {
  return new Promise((resolve, reject) => {
    let done = false
    const finish = (callback: (value: any) => void, value: unknown) => {
      if (done) return
      done = true
      clearTimeout(timer)
      context.signal?.removeEventListener('abort', abort)
      callback(value)
    }
    const timer = setTimeout(() => finish(reject, new Error('Timeout del flow')), context.timeoutMs ?? 5000)
    const abort = () => finish(reject, new DOMException('Flow annullato', 'AbortError'))
    context.signal?.addEventListener('abort', abort, { once: true })
    operation.then((value) => finish(resolve, value), (error) => finish(reject, error))
  })
}
