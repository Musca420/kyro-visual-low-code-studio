import type { Flow } from './model'

export type FlowLog = { nodeId: string; level: 'info' | 'error'; message: string; value?: unknown }
export type FlowContext = {
  input: string
  insert: (text: string, sourceId?: string) => Promise<unknown>
  query?: (sourceId?: string) => Promise<unknown[]>
  update?: (value: unknown, sourceId?: string) => Promise<unknown>
  delete?: (value: unknown, sourceId?: string) => Promise<unknown>
  refresh: (componentId?: string) => Promise<void>
  navigate?: (path: string) => Promise<void> | void
  openModal?: (componentId: string) => Promise<void> | void
  notify?: (message: string, level: string) => Promise<void> | void
  runModule?: (moduleId: string, value: unknown) => Promise<unknown> | unknown
  getState?: (key: string) => unknown
  setState?: (key: string, value: unknown) => void
  resetState?: (key: string) => void
  request?: (url: string, method: string, body?: string) => Promise<unknown>
  signal?: AbortSignal
  timeoutMs?: number
}

const debounceVersions = new Map<string, number>()

export async function runFlow(flow: Flow, context: FlowContext): Promise<FlowLog[]> {
  const logs: FlowLog[] = []
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]))
  const event = flow.nodes.find((node) => node.type === 'event')
  if (!event) throw new Error('Il flow non contiene un evento iniziale')
  let node = event
  let value: unknown = context.input
  let path = 'success'
  const visited = new Map<string, number>()
  while (node) {
    if (context.signal?.aborted) throw new DOMException('Flow annullato', 'AbortError')
    const count = (visited.get(node.id) ?? 0) + 1
    visited.set(node.id, count)
    if (count > 1) throw new Error(`Loop non controllato al nodo ${node.label}`)
    try {
      if (node.type === 'readInput') value = context.input
      if (node.type === 'validate' && (typeof value !== 'string' || !value.trim())) throw new Error(node.config.message || 'Il valore è obbligatorio')
      const conditionResult = node.type === 'condition' ? matches(value, node.config.field, node.config.operator, node.config.value) : undefined
      const switchPath = node.type === 'switch' ? switchCase(value, node.config.field, node.config.cases) : undefined
      if (node.type === 'getState') value = required(context.getState, 'Stato non disponibile')(node.config.key || '')
      if (node.type === 'setState') required(context.setState, 'Stato non disponibile')(node.config.key || '', value)
      if (node.type === 'resetState') { required(context.resetState, 'Stato non disponibile')(node.config.key || ''); value = undefined }
      if (node.type === 'delay') await guarded(new Promise((resolve) => setTimeout(resolve, Math.min(10000, Math.max(0, Number(node.config.ms) || 0)))), context)
      if (node.type === 'debounce' && !await debounce(`${flow.id}:${node.id}`, Number(node.config.ms) || 0, context)) return logs
      if (node.type === 'format') value = (node.config.template || '{{value}}').replaceAll('{{value}}', String(value ?? ''))
      if (node.type === 'map') value = mapItems(value, node.config.field, node.config.template)
      if (node.type === 'http') value = await guarded(required(context.request, 'Richieste API non disponibili')(safeHttpUrl(node.config.url), node.config.method || 'GET', ['GET', 'DELETE'].includes(node.config.method || 'GET') ? undefined : (node.config.body || '{{value}}').replaceAll('{{value}}', typeof value === 'string' ? value : JSON.stringify(value))), context)
      if (node.type === 'insert') value = await guarded(node.config.sourceId ? context.insert(String(value).trim(), node.config.sourceId) : context.insert(String(value).trim()), context)
      if (node.type === 'query') value = await guarded(required(context.query, 'Caricamento dati non disponibile')(node.config.sourceId), context)
      if (node.type === 'update') value = await guarded(required(context.update, 'Aggiornamento dati non disponibile')(value, node.config.sourceId), context)
      if (node.type === 'delete') value = await guarded(required(context.delete, 'Eliminazione dati non disponibile')(value, node.config.sourceId), context)
      if (node.type === 'filter') value = filter(value, node.config.field, node.config.value)
      if (node.type === 'sort') value = sort(value, node.config.field, node.config.direction === 'desc')
      if (node.type === 'kpi') value = aggregate(value, node.config.operation, node.config.field)
      if (node.type === 'refresh') await guarded(context.refresh(node.config.componentId), context)
      if (node.type === 'navigate') await context.navigate?.(node.config.path || '/')
      if (node.type === 'openModal') await context.openModal?.(node.config.componentId || '')
      if (node.type === 'notify') await context.notify?.(node.config.message || String(value), node.config.level || path)
      if (node.type === 'module') value = await guarded(Promise.resolve(required(context.runModule, 'Esecuzione modulo non disponibile')(node.config.moduleId || '', value)), context)
      path = switchPath ?? (conditionResult === false ? 'error' : 'success')
      logs.push({ nodeId: node.id, level: 'info', message: conditionResult === false ? `${node.label}: condizione non verificata` : `${node.label}: completato`, value })
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

export function safeHttpUrl(value = '') {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Usa un indirizzo API HTTP o HTTPS')
  return url.toString()
}

const required = <T>(value: T | undefined, message: string): T => {
  if (!value) throw new Error(message)
  return value
}

const field = (value: unknown, key = '') => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined

const filter = (value: unknown, key = '', expected = '') => {
  if (!Array.isArray(value)) throw new Error('Il nodo filtro richiede un elenco')
  const needle = expected.toLowerCase()
  return value.filter((item) => String(field(item, key) ?? '').toLowerCase().includes(needle))
}

const sort = (value: unknown, key = '', descending = false) => {
  if (!Array.isArray(value)) throw new Error('Il nodo ordinamento richiede un elenco')
  return [...value].sort((left, right) => String(field(left, key) ?? '').localeCompare(String(field(right, key) ?? '')) * (descending ? -1 : 1))
}

const aggregate = (value: unknown, operation = 'count', key = '') => {
  if (!Array.isArray(value)) throw new Error('Il nodo KPI richiede un elenco')
  if (operation === 'count') return value.length
  const numbers = value.map((item) => Number(field(item, key))).filter(Number.isFinite)
  if (operation === 'sum') return numbers.reduce((total, item) => total + item, 0)
  if (operation === 'average') return numbers.length ? numbers.reduce((total, item) => total + item, 0) / numbers.length : 0
  throw new Error(`Operazione KPI non supportata: ${operation}`)
}

const mapItems = (value: unknown, key = '', template = '{{value}}') => {
  if (!Array.isArray(value)) throw new Error('Il nodo trasformazione richiede un elenco')
  return value.map((item) => template.replaceAll('{{value}}', String(key ? field(item, key) ?? '' : item ?? '')))
}

const matches = (value: unknown, key = '', operator = 'equals', expected = '') => {
  const actual = key ? field(value, key) : value
  if (operator === 'exists') return actual !== undefined && actual !== null && actual !== ''
  if (operator === 'equals') return String(actual) === expected
  if (operator === 'notEquals') return String(actual) !== expected
  if (operator === 'contains') return String(actual).toLowerCase().includes(expected.toLowerCase())
  if (operator === 'greater') return Number(actual) > Number(expected)
  if (operator === 'less') return Number(actual) < Number(expected)
  throw new Error(`Operatore condizione non supportato: ${operator}`)
}

const switchCase = (value: unknown, key = '', cases = '') => {
  const actual = String(key ? field(value, key) ?? '' : value ?? '')
  const match = cases.split(',').map((item) => item.trim()).filter(Boolean).find((item) => item === actual)
  return match ? `case:${match}` : 'error'
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

async function debounce(key: string, milliseconds: number, context: FlowContext) {
  const version = (debounceVersions.get(key) ?? 0) + 1
  debounceVersions.set(key, version)
  await guarded(new Promise((resolve) => setTimeout(resolve, Math.min(10000, Math.max(0, milliseconds)))), context)
  return debounceVersions.get(key) === version
}
