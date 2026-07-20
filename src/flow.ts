import type { Flow } from './model'

export type FlowLog = { nodeId: string; level: 'info' | 'error'; message: string; value?: unknown; durationMs?: number }
export type FlowContext = {
  input: unknown
  insert: (value: unknown, sourceId?: string) => Promise<unknown>
  query?: (sourceId?: string) => Promise<unknown[]>
  update?: (value: unknown, sourceId?: string) => Promise<unknown>
  delete?: (value: unknown, sourceId?: string) => Promise<unknown>
  refresh: (componentId?: string) => Promise<void>
  navigate?: (path: string, mode: "page" | "back" | "url") => Promise<void> | void
  openModal?: (componentId: string, operation: "open" | "close") => Promise<void> | void
  updateUI?: (componentId: string, operation: string, value: string) => Promise<void> | void
  notify?: (message: string, level: string) => Promise<void> | void
  localNotification?: (title: string, body: string, delayMs: number) => Promise<void> | void
  requestPermission?: (permission: string, rationale: string) => Promise<boolean> | boolean
  nativeAction?: (capability: string, action: string, value: unknown, config: Record<string, string>) => Promise<unknown> | unknown
  platformInfo?: () => Promise<{ platform: string; version: string }> | { platform: string; version: string }
  runSubflow?: (flowId: string, value: unknown) => Promise<unknown>
  runModule?: (moduleId: string, value: unknown) => Promise<unknown> | unknown
  getState?: (key: string) => unknown
  setState?: (key: string, value: unknown) => void
  resetState?: (key: string) => void
  request?: (url: string, method: string, body?: string) => Promise<unknown>
  getRole?: () => string | undefined
  signOut?: () => Promise<void> | void
  onLog?: (log: FlowLog) => void
  onBreakpoint?: (nodeId: string, value: unknown) => Promise<void>
  signal?: AbortSignal
  timeoutMs?: number
}

const debounceVersions = new Map<string, number>()

export async function runFlow(flow: Flow, context: FlowContext): Promise<FlowLog[]> {
  const logs: FlowLog[] = []
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]))
  const event = flow.nodes.find((node) => node.type === 'event')
  if (!event) throw new Error('The flow has no starting event')
  let node = event
  let value: unknown = context.input
  let path = 'success'
  const visited = new Map<string, number>()
  const loops = new Map<string, { items: unknown[]; index: number }>()
  const push = (log: FlowLog) => { logs.push(log); context.onLog?.(log) }
  let steps = 0
  const clock = () => typeof performance === 'undefined' ? Date.now() : performance.now()
  while (node) {
    if (++steps > 1000) throw new Error('The flow exceeded the 1,000-step limit')
    if (context.signal?.aborted) throw new DOMException('Flow cancelled', 'AbortError')
    const count = (visited.get(node.id) ?? 0) + 1
    visited.set(node.id, count)
    if (count > 1 && loops.size === 0) throw new Error(`Uncontrolled loop at ${node.label}`)
    const nodeStarted = clock()
    try {
      if (node.config.breakpoint === 'true' && breakpointMatches(value, node.config.breakpointWhen, node.config.breakpointValue)) await context.onBreakpoint?.(node.id, value)
      if (node.type === 'readInput') value = context.input
      if (node.type === 'validate') validate(value, node.config.field, node.config.rule, node.config.value, node.config.message)
      let conditionResult = node.type === 'condition' ? matches(value, node.config.field, node.config.operator, node.config.value) : undefined
      if (node.type === 'requestPermission') { const granted = await required(context.requestPermission, 'Permission requests are not available')(node.config.permission || '', node.config.rationale || ''); value = { permission: node.config.permission, granted }; conditionResult = granted }
      if (node.type === 'platformCondition') { const info = await required(context.platformInfo, 'Platform information is not available')(); conditionResult = platformMatches(info, node.config.platform, node.config.minVersion, node.config.maxVersion); value = { ...info, matches: conditionResult } }
      const switchPath = node.type === 'switch' ? switchCase(value, node.config.field, node.config.cases) : undefined
      let loopPath: string | undefined
      if (node.type === 'loop') {
        let state = loops.get(node.id)
        if (!state) {
          if (!Array.isArray(value)) throw new Error('The loop needs a list')
          const limit = Math.min(100, Math.max(1, Number(node.config.max) || 100))
          if (value.length > limit) throw new Error(`The loop exceeds the ${limit}-item limit`)
          state = { items: value, index: 0 }; loops.set(node.id, state)
        } else state.index += 1
        if (state.index < state.items.length) { value = state.items[state.index]; loopPath = 'each' }
        else { value = state.items; loops.delete(node.id); loopPath = 'done' }
      }
      if (node.type === 'getState') value = required(context.getState, 'State is unavailable')(node.config.key || '')
      if (node.type === 'setState') required(context.setState, 'State is unavailable')(node.config.key || '', value)
      if (node.type === 'resetState') { required(context.resetState, 'State is unavailable')(node.config.key || ''); value = undefined }
      if (node.type === 'delay') await guarded(new Promise((resolve) => setTimeout(resolve, Math.min(10000, Math.max(0, Number(node.config.ms) || 0)))), context)
      if (node.type === 'debounce' && !await debounce(`${flow.id}:${node.id}`, Number(node.config.ms) || 0, context)) return logs
      if (node.type === 'format') value = (node.config.template || '{{value}}').replaceAll('{{value}}', String(value ?? ''))
      if (node.type === 'map') value = mapItems(value, node.config.field, node.config.template)
      if (node.type === 'http') value = await guarded(required(context.request, 'API requests are unavailable')(safeHttpUrl(node.config.url), node.config.method || 'GET', ['GET', 'DELETE'].includes(node.config.method || 'GET') ? undefined : (node.config.body || '{{value}}').replaceAll('{{value}}', typeof value === 'string' ? value : JSON.stringify(value))), context)
      if (node.type === 'file') value = await guarded(prepareFile(value, Number(node.config.maxMb) || 2, node.config.accept), context)
      if (node.type === 'requireRole') { const role = context.getRole?.() ?? node.config.previewRole ?? 'viewer'; const allowed = (node.config.roles || 'admin').split(',').map((item) => item.trim()).filter(Boolean); if (!allowed.includes(role)) throw new Error(node.config.message || `This action requires the ${allowed.join(' or ')} role`); value = { role, allowed: true } }
      if (node.type === 'signOut') await context.signOut?.()
      if (node.type === 'insert') { const next = typeof value === 'string' ? value.trim() : value; value = await guarded(node.config.sourceId ? context.insert(next, node.config.sourceId) : context.insert(next), context) }
      if (node.type === 'query') {
        const previous = value
        const records = await guarded(required(context.query, 'Data loading is not available')(node.config.sourceId), context)
        value = node.config.mode === 'one' ? findRecord(records, previous, node.config.id, node.config.field) : records
      }
      if (node.type === 'update') value = await guarded(required(context.update, 'Data updates are unavailable')(value, node.config.sourceId), context)
      if (node.type === 'delete') value = await guarded(required(context.delete, 'Data deletion is unavailable')(value, node.config.sourceId), context)
      if (node.type === 'filter') value = filter(value, node.config.field, node.config.value)
      if (node.type === 'sort') value = sort(value, node.config.field, node.config.direction === 'desc')
      if (node.type === 'kpi') value = aggregate(value, node.config.operation, node.config.field)
      if (node.type === 'refresh') await guarded(context.refresh(node.config.componentId), context)
      if (node.type === 'navigate') { const mode = node.config.mode === 'back' || node.config.mode === 'url' ? node.config.mode : 'page'; if (mode === 'url') safeHttpUrl(node.config.path); await context.navigate?.(node.config.path || '/', mode) }
      if (node.type === 'openModal') await context.openModal?.(node.config.componentId || '', node.config.operation === 'close' ? 'close' : 'open')
      if (node.type === 'updateUI') await required(context.updateUI, 'UI updates are unavailable')(node.config.componentId || '', node.config.operation || 'show', node.config.value || '')
      if (node.type === 'notify') await context.notify?.(node.config.message || String(value), node.config.level || path)
      if (node.type === 'localNotification') await required(context.localNotification, 'Local notifications are not available')(node.config.title || 'Reminder', node.config.body || String(value ?? ''), Math.min(604800000, Math.max(0, Number(node.config.delayMs) || 0)))
      if (node.type === 'nativeAction') value = await guarded(Promise.resolve(required(context.nativeAction, 'Device actions are not available')(node.config.capability || '', node.config.action || '', value, node.config)), context)
      if (node.type === 'runFlow') value = await guarded(required(context.runSubflow, 'Reusable flows are not available')(node.config.flowId || '', value), context)
      if (node.type === 'module') value = await guarded(Promise.resolve(required(context.runModule, 'Module execution is unavailable')(node.config.moduleId || '', value)), context)
      path = loopPath ?? switchPath ?? (conditionResult === false ? 'error' : 'success')
      push({ nodeId: node.id, level: 'info', message: conditionResult === false ? `${node.label}: condition not met` : `${node.label}: completed`, value, durationMs: Math.max(0, clock() - nodeStarted) })
    } catch (error) {
      path = 'error'
      push({ nodeId: node.id, level: 'error', message: error instanceof Error ? error.message : String(error), durationMs: Math.max(0, clock() - nodeStarted) })
    }
    const edge = flow.edges.find((candidate) => candidate.source === node.id && candidate.path === path)
    if (!edge) {
      if (path === 'error') return logs
      break
    }
    const next = nodes.get(edge.target)
    if (!next) throw new Error(`Missing destination node: ${edge.target}`)
    node = next
  }
  return logs
}

export async function runProjectFlow(flowId: string, flows: Flow[], context: FlowContext, ancestry: string[] = []): Promise<FlowLog[]> {
  if (ancestry.includes(flowId)) throw new Error(`Reusable flow cycle: ${[...ancestry, flowId].join(' → ')}`)
  if (ancestry.length >= 20) throw new Error('Reusable flows exceeded the maximum depth of 20')
  const flow = flows.find((item) => item.id === flowId)
  if (!flow) throw new Error(`Reusable flow not found: ${flowId}`)
  return runFlow(flow, {
    ...context,
    runSubflow: async (targetId, value) => {
      const logs = await runProjectFlow(targetId, flows, { ...context, input: value }, [...ancestry, flowId])
      const last = logs.at(-1)
      if (last?.level === 'error') throw new Error(last.message)
      return last?.value ?? value
    },
  })
}

export function safeHttpUrl(value = '') {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS API address')
  return url.toString()
}

const required = <T>(value: T | undefined, message: string): T => {
  if (!value) throw new Error(message)
  return value
}

const field = (value: unknown, key = '') => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined

const findRecord = (records: unknown[], input: unknown, configuredId = '{{value}}', inputField = 'id') => {
  const id = configuredId === '{{value}}' ? (input && typeof input === 'object' ? field(input, inputField || 'id') : input) : configuredId
  if (id === undefined || id === null || String(id).trim() === '') throw new Error('Provide the record ID to load')
  const record = records.find((item) => String(field(item, 'id') ?? '') === String(id))
  if (!record) throw new Error(`Record ${String(id)} was not found`)
  return record
}

const validate = (value: unknown, key = '', rule = 'required', expected = '', message = '') => {
  const actual = key ? field(value, key) : value
  const valid = rule === 'required' ? actual !== undefined && actual !== null && String(actual).trim() !== ''
    : rule === 'email' ? /^\S+@\S+\.\S+$/.test(String(actual ?? ''))
      : rule === 'minLength' ? String(actual ?? '').length >= Math.max(0, Number(expected) || 0)
        : rule === 'min' ? Number(actual) >= Number(expected)
          : rule === 'max' ? Number(actual) <= Number(expected)
            : false
  if (!valid) throw new Error(message || `The ${key || 'current'} field is not valid`)
}

const filter = (value: unknown, key = '', expected = '') => {
  if (!Array.isArray(value)) throw new Error('The filter step needs a list')
  const needle = expected.toLowerCase()
  return value.filter((item) => String(field(item, key) ?? '').toLowerCase().includes(needle))
}

const sort = (value: unknown, key = '', descending = false) => {
  if (!Array.isArray(value)) throw new Error('The sort step needs a list')
  return [...value].sort((left, right) => String(field(left, key) ?? '').localeCompare(String(field(right, key) ?? '')) * (descending ? -1 : 1))
}

const aggregate = (value: unknown, operation = 'count', key = '') => {
  if (!Array.isArray(value)) throw new Error('The KPI step needs a list')
  if (operation === 'count') return value.length
  const numbers = value.map((item) => Number(field(item, key))).filter(Number.isFinite)
  if (operation === 'sum') return numbers.reduce((total, item) => total + item, 0)
  if (operation === 'average') return numbers.length ? numbers.reduce((total, item) => total + item, 0) / numbers.length : 0
  throw new Error(`Unsupported KPI operation: ${operation}`)
}

const mapItems = (value: unknown, key = '', template = '{{value}}') => {
  if (!Array.isArray(value)) throw new Error('The transform step needs a list')
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
  throw new Error(`Unsupported condition operator: ${operator}`)
}

const switchCase = (value: unknown, key = '', cases = '') => {
  const actual = String(key ? field(value, key) ?? '' : value ?? '')
  const match = cases.split(',').map((item) => item.trim()).filter(Boolean).find((item) => item === actual)
  return match ? `case:${match}` : 'error'
}

const breakpointMatches = (value: unknown, when = 'always', expected = '') => when === 'always' || (when === 'equals' ? String(value) === expected : when === 'contains' ? String(value).toLowerCase().includes(expected.toLowerCase()) : false)

const platformMatches = (info: { platform: string; version: string }, platform = '', minimum = '', maximum = '') => {
  if (platform && info.platform.toLowerCase() !== platform.toLowerCase()) return false
  const current = Number.parseInt(info.version, 10), min = minimum ? Number.parseInt(minimum, 10) : undefined, max = maximum ? Number.parseInt(maximum, 10) : undefined
  if (min !== undefined && (!Number.isFinite(current) || current < min)) return false
  if (max !== undefined && (!Number.isFinite(current) || current > max)) return false
  return true
}

async function prepareFile(value: unknown, maxMb: number, accept = '') {
  if (!(value instanceof File)) throw new Error('Choose a file before continuing')
  const limit = Math.min(10, Math.max(1, maxMb)) * 1024 * 1024
  if (value.size > limit) throw new Error(`The file exceeds the ${Math.min(10, Math.max(1, maxMb))} MB limit`)
  const accepted = accept.split(',').map((item) => item.trim()).filter(Boolean)
  if (accepted.length && !accepted.some((item) => item.endsWith('/*') ? value.type.startsWith(item.slice(0, -1)) : value.type === item || value.name.toLowerCase().endsWith(item.toLowerCase()))) throw new Error('This file type is not accepted')
  const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(value) })
  return { name: value.name, type: value.type || 'application/octet-stream', size: value.size, dataUrl }
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
    const timer = setTimeout(() => finish(reject, new Error('Flow timed out')), context.timeoutMs ?? 5000)
    const abort = () => finish(reject, new DOMException('Flow cancelled', 'AbortError'))
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
