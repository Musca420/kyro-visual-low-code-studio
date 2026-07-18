import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const codexCommand = process.platform === 'win32' ? process.execPath : 'codex'
const codexPrefix = process.platform === 'win32' ? [resolve(process.env.APPDATA ?? '', 'npm/node_modules/@openai/codex/bin/codex.js')] : []

async function body(request: IncomingMessage) {
  let raw = ''
  for await (const chunk of request) {
    raw += chunk
    if (raw.length > 4_000_000) throw new Error('Richiesta troppo grande')
  }
  return JSON.parse(raw || '{}') as Record<string, unknown>
}

function reply(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(value))
}

async function gitSnapshot() {
  try {
    const [status, diff] = await Promise.all([run('git', ['status', '--short'], { cwd: process.cwd(), timeout: 10_000 }), run('git', ['diff', '--no-ext-diff', '--no-color', 'HEAD'], { cwd: process.cwd(), timeout: 10_000, maxBuffer: 1_000_000 })])
    return { status: status.stdout, diff: diff.stdout }
  } catch { return { status: '', diff: '' } }
}

function liveBridge() {
  let latest: Record<string, unknown> | undefined
  const projects = new Map<string, Record<string, unknown>>()
  const commands: { id: string; projectId: string; pageId: string; revision: number; tool: string; args: Record<string, unknown>; status: 'pending' | 'applied' | 'error'; error?: string; result?: unknown }[] = []
  let agent: ChildProcessWithoutNullStreams | undefined
  return {
    name: 'frontend-editor-live-bridge',
    configureServer(server: { middlewares: { use: (handler: (request: IncomingMessage, response: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use(async (request, response, next) => {
        try {
          const url = new URL(request.url ?? '/', 'http://127.0.0.1')
          if (url.pathname === '/api/live/status' && request.method === 'GET') {
            const state = url.searchParams.get('projectId') ? projects.get(url.searchParams.get('projectId')!) : latest
            return reply(response, state ? 200 : 503, state ?? { error: 'Editor non ancora collegato' })
          }
          if (url.pathname === '/api/live/state' && request.method === 'POST') {
            const state = await body(request)
            if (!state.projectId || !state.pageId || !Number.isInteger(state.revision)) return reply(response, 400, { error: 'Stato live non valido' })
            latest = { ...state, timestamp: new Date().toISOString(), workspace: process.cwd() }
            projects.set(String(state.projectId), latest)
            return reply(response, 200, { ok: true })
          }
          if (url.pathname.startsWith('/api/live/tools/') && request.method === 'POST') {
            const tool = url.pathname.split('/').at(-1)!, input = await body(request), projectId = String(input.projectId ?? ''), state = projects.get(projectId)
            if (!state) return reply(response, 404, { error: 'Progetto live non trovato' })
            const tree = Array.isArray(state.componentTree) ? state.componentTree as Record<string, unknown>[] : [], flows = Array.isArray(state.flows) ? state.flows as Record<string, unknown>[] : []
            const reads: Record<string, () => unknown> = {
              get_editor_status: () => ({ projectId: state.projectId, pageId: state.pageId, revision: state.revision, selectedComponentIds: state.selectedComponentIds, timestamp: state.timestamp, previewState: state.previewState, viewport: state.viewport }),
              get_active_project: () => state,
              get_active_page: () => ({ id: state.pageId, components: tree }),
              get_current_selection: () => tree.filter((item) => (state.selectedComponentIds as unknown[]).includes(item.id)),
              get_component: () => tree.find((item) => item.id === input.componentId),
              get_component_tree: () => tree,
              get_component_layout: () => (state.layouts as Record<string, unknown> | undefined)?.[String(input.componentId)],
              get_computed_styles: () => tree.find((item) => item.id === input.componentId)?.styles,
              get_page_flows: () => flows,
              get_component_flows: () => flows.filter((flow) => Array.isArray(flow.nodes) && (flow.nodes as Record<string, unknown>[]).some((node) => (node.config as Record<string, unknown> | undefined)?.componentId === input.componentId)),
              get_data_sources: () => state.dataSources,
              get_runtime_state: () => ({ previewState: state.previewState, viewport: state.viewport }),
              get_validation_errors: () => state.validationErrors,
              get_console_errors: () => state.consoleErrors,
              validate_project: () => ({ valid: !(state.validationErrors as unknown[])?.length, errors: state.validationErrors }),
            }
            if (reads[tool]) return reply(response, 200, reads[tool]())
            const mutations = new Set(['move_component', 'resize_component', 'set_component_property', 'set_component_style', 'set_responsive_style', 'add_component', 'remove_component', 'reorder_component', 'create_flow', 'connect_nodes', 'bind_component_data', 'create_data_source', 'apply_editor_transaction', 'undo_last_transaction', 'open_preview', 'capture_canvas', 'capture_preview'])
            if (!mutations.has(tool)) return reply(response, 404, { error: `Tool non disponibile: ${tool}` })
            if (input.revision !== state.revision) return reply(response, 409, { error: 'Revisione obsoleta' })
            if (commands.some((item) => item.projectId === projectId && item.status === 'pending')) return reply(response, 409, { error: 'Una transazione è già in attesa' })
            const command = { id: crypto.randomUUID(), projectId, pageId: String(input.pageId ?? state.pageId), revision: Number(input.revision), tool, args: (input.args ?? {}) as Record<string, unknown>, status: 'pending' as const }
            commands.push(command)
            return reply(response, 202, { transactionId: command.id, status: command.status })
          }
          if (url.pathname === '/api/live/commands' && request.method === 'GET') return reply(response, 200, commands.filter((item) => item.projectId === url.searchParams.get('projectId') && item.status === 'pending'))
          if (url.pathname.startsWith('/api/live/commands/') && request.method === 'POST') {
            const command = commands.find((item) => item.id === url.pathname.split('/').at(-1)), result = await body(request)
            if (!command) return reply(response, 404, { error: 'Transazione non trovata' })
            command.status = result.ok === true ? 'applied' : 'error'; command.error = result.error ? String(result.error) : undefined; command.result = result.result
            return reply(response, 200, command)
          }
          if (url.pathname.startsWith('/api/live/transactions/') && request.method === 'GET') {
            const command = commands.find((item) => item.id === url.pathname.split('/').at(-1))
            return reply(response, command ? 200 : 404, command ?? { error: 'Transazione non trovata' })
          }
          if (request.url === '/api/codex/status' && request.method === 'GET') {
            try { const result = await run(codexCommand, [...codexPrefix, 'login', 'status'], { cwd: process.cwd(), timeout: 10_000 }); return reply(response, 200, { authenticated: true, message: result.stdout.trim() || result.stderr.trim(), workspace: process.cwd() }) }
            catch (error) { return reply(response, 200, { authenticated: false, message: error instanceof Error ? error.message : String(error), workspace: process.cwd() }) }
          }
          if (request.url === '/api/codex/run' && request.method === 'POST') {
            if (agent) return reply(response, 409, { error: 'Codex sta già lavorando' })
            const input = await body(request), prompt = String(input.prompt ?? ''), mode = input.mode === 'apply' ? 'apply' : 'plan'
            if (!prompt.trim() || prompt.length > 8_000) return reply(response, 400, { error: 'La richiesta deve contenere da 1 a 8000 caratteri' })
            const current = projects.get(String(input.projectId))
            if (!current || input.revision !== current.revision) return reply(response, 409, { error: 'Il progetto è cambiato: aggiorna il contesto prima di continuare' })
            const instruction = `${mode === 'plan' ? 'Analizza e proponi un piano. Non modificare file.' : 'Applica la modifica richiesta e verifica il risultato.'}\n\n${prompt}\n\nContesto Frontend Editor:\n${JSON.stringify(input.context)}`
            agent = spawn(codexCommand, [...codexPrefix, '-a', 'never', 'exec', '--json', '--ephemeral', '-C', process.cwd(), '-s', mode === 'plan' ? 'read-only' : 'workspace-write', '-'], { cwd: process.cwd(), stdio: 'pipe' })
            let output = '', errors = ''
            agent.stdout.on('data', (chunk) => { output += chunk; if (output.length > 250_000) agent?.kill() })
            agent.stderr.on('data', (chunk) => { errors += chunk })
            agent.stdin.end(instruction)
            agent.on('close', async (code) => { agent = undefined; reply(response, code === 0 ? 200 : 500, { code, output, errors, git: await gitSnapshot() }) })
            return
          }
          if (request.url === '/api/codex/cancel' && request.method === 'POST') { const cancelled = Boolean(agent); agent?.kill(); agent = undefined; return reply(response, 200, { cancelled }) }
          next()
        } catch (error) { reply(response, 500, { error: error instanceof Error ? error.message : String(error) }) }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), liveBridge()],
  test: { environment: 'jsdom', setupFiles: './tests/setup.ts', include: ['tests/**/*.test.{ts,tsx}'] },
})
