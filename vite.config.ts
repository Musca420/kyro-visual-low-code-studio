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
    if (raw.length > 64_000) throw new Error('Richiesta troppo grande')
  }
  return JSON.parse(raw || '{}') as Record<string, unknown>
}

function reply(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(value))
}

function liveBridge() {
  let latest: Record<string, unknown> | undefined
  const projects = new Map<string, Record<string, unknown>>()
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
          if (request.url === '/api/live/state' && request.method === 'POST') {
            const state = await body(request)
            if (!state.projectId || !state.pageId || !Number.isInteger(state.revision)) return reply(response, 400, { error: 'Stato live non valido' })
            latest = { ...state, timestamp: new Date().toISOString(), workspace: process.cwd() }
            projects.set(String(state.projectId), latest)
            return reply(response, 200, { ok: true })
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
            agent.on('close', (code) => { agent = undefined; reply(response, code === 0 ? 200 : 500, { code, output, errors }) })
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
