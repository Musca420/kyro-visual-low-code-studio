import type { Project } from "../model";

export function withGeneratedBackend(project: Project, files: Record<string, string>) {
  if (!project.dataSources.some((source) => source.provider === "generated"))
    return files;
  const pkg = JSON.parse(files["package.json"]) as {
    scripts: Record<string, string>;
  };
  pkg.scripts.server = "node server/index.mjs";
  files["package.json"] = JSON.stringify(pkg, null, 2);
  files["server/data.json"] = "[]";
  files["server/users.json"] = "[]";
  files["server/index.mjs"] = `import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
const file = new URL('./data.json', import.meta.url)
const usersFile = new URL('./users.json', import.meta.url)
const read = async () => JSON.parse(await readFile(file, 'utf8'))
const save = async (records) => writeFile(file, JSON.stringify(records, null, 2))
const readUsers = async () => JSON.parse(await readFile(usersFile, 'utf8'))
const saveUsers = async (users) => writeFile(usersFile, JSON.stringify(users, null, 2))
const body = async (request) => { let value = ''; for await (const chunk of request) value += chunk; return value ? JSON.parse(value) : {} }
const authEnabled = ${JSON.stringify(project.appConfig.authentication.mode === "generated")}
const allowedRoles = ${JSON.stringify(project.appConfig.authentication.roles)}
const readOnlyRoles = new Set(['viewer'])
const canWrite = (role) => role === 'admin' || (allowedRoles.includes(role) && !readOnlyRoles.has(role))
const authSecret = process.env.AUTH_SECRET || ''
const port = Number(process.env.PORT || 8787)
const configuredOrigin = process.env.ALLOWED_ORIGIN || ''
const corsOrigin = (origin) => { try { const value = new URL(origin), local = ['http:', 'https:'].includes(value.protocol) && ['127.0.0.1', 'localhost'].includes(value.hostname); return local || origin === configuredOrigin ? origin : '' } catch { return '' } }
if (authEnabled && !authSecret) throw new Error('AUTH_SECRET is required: copy .env.example and configure a secure value')
const sign = (user) => { const payload = Buffer.from(JSON.stringify({ id: user.id, role: user.role, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url'); return payload + '.' + createHmac('sha256', authSecret).update(payload).digest('base64url') }
const session = (request) => { if (!authEnabled) return { role: 'admin' }; const token = String(request.headers.authorization || '').replace(/^Bearer /, ''), [payload, signature] = token.split('.'); if (!payload || !signature) return; const expected = Buffer.from(createHmac('sha256', authSecret).update(payload).digest('base64url')), actual = Buffer.from(signature); if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return; const value = JSON.parse(Buffer.from(payload, 'base64url')); return value.exp > Date.now() ? value : undefined }
const clients = new Set()
const broadcast = () => clients.forEach((client) => client.write('event: records\\ndata: changed\\n\\n'))
createServer(async (request, response) => {
  try {
    response.setHeader('content-type', 'application/json')
    const origin = String(request.headers.origin || ''), allowedOrigin = corsOrigin(origin)
    if (allowedOrigin) { response.setHeader('access-control-allow-origin', allowedOrigin); response.setHeader('vary', 'origin') }
    response.setHeader('access-control-allow-headers', 'content-type,authorization')
    response.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS')
    if (request.method === 'OPTIONS') { response.writeHead(origin && !allowedOrigin ? 403 : 204); return response.end() }
    const url = new URL(request.url, 'http://127.0.0.1')
    if (url.pathname === '/events' && request.method === 'GET') { response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); response.write('event: ready\\ndata: connected\\n\\n'); clients.add(response); request.on('close', () => clients.delete(response)); return }
    if (url.pathname === '/auth/register' && request.method === 'POST') { const users = await readUsers(); if (users.length) { response.writeHead(409); return response.end(JSON.stringify({ error: 'The first account already exists' })) } const input = await body(request); if (!/^\\S+@\\S+\\.\\S+$/.test(input.email) || String(input.password || '').length < 8) { response.writeHead(400); return response.end(JSON.stringify({ error: 'A valid email and a password of at least 8 characters are required' })) } const salt = randomBytes(16).toString('hex'), hash = scryptSync(input.password, salt, 64).toString('hex'), user = { id: crypto.randomUUID(), email: input.email.toLowerCase(), salt, hash, role: allowedRoles.includes('admin') ? 'admin' : allowedRoles[0] || 'viewer' }; users.push(user); await saveUsers(users); response.writeHead(201); return response.end(JSON.stringify({ id: user.id, email: user.email, role: user.role })) }
    if (url.pathname === '/auth/login' && request.method === 'POST') { const input = await body(request), user = (await readUsers()).find((item) => item.email === String(input.email || '').toLowerCase()); if (!user) { response.writeHead(401); return response.end(JSON.stringify({ error: 'Invalid credentials' })) } const actual = scryptSync(String(input.password || ''), user.salt, 64), expected = Buffer.from(user.hash, 'hex'); if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) { response.writeHead(401); return response.end(JSON.stringify({ error: 'Invalid credentials' })) } return response.end(JSON.stringify({ token: sign(user), role: user.role })) }
    const current = session(request)
    if (url.pathname === '/auth/session' && request.method === 'GET') { if (!current) { response.writeHead(401); return response.end(JSON.stringify({ error: 'Session expired' })) } return response.end(JSON.stringify({ id: current.id, role: current.role })) }
    if (authEnabled && !current) { response.writeHead(401); return response.end(JSON.stringify({ error: 'Sign in to continue' })) }
    const records = await read(), id = url.pathname.split('/')[2]
    if (url.pathname === '/records' && request.method === 'GET') return response.end(JSON.stringify(records))
    if (url.pathname === '/records' && request.method === 'POST') { if (!canWrite(current.role)) { response.writeHead(403); return response.end(JSON.stringify({ error: 'This role has read-only access' })) } const input = await body(request), record = { ...input, id: crypto.randomUUID(), date: new Date().toISOString() }; records.push(record); await save(records); broadcast(); response.writeHead(201); return response.end(JSON.stringify(record)) }
    const index = records.findIndex((record) => record.id === id)
    if (index < 0) { response.writeHead(404); return response.end(JSON.stringify({ error: 'Record not found' })) }
    if (request.method === 'PUT') { if (!canWrite(current.role)) { response.writeHead(403); return response.end(JSON.stringify({ error: 'This role has read-only access' })) } records[index] = { ...records[index], ...(await body(request)), id }; await save(records); broadcast(); return response.end(JSON.stringify(records[index])) }
    if (request.method === 'DELETE') { if (current.role !== 'admin') { response.writeHead(403); return response.end(JSON.stringify({ error: 'Only an administrator can delete records' })) } records.splice(index, 1); await save(records); broadcast(); response.writeHead(204); return response.end() }
    response.writeHead(404); response.end(JSON.stringify({ error: 'Route not found' }))
  } catch (error) { response.writeHead(500); response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })) }
}).listen(port, '127.0.0.1', () => console.log('Backend ready at http://127.0.0.1:' + port))
`;
  files[".env.example"] = `${files[".env.example"] ? `${files[".env.example"]}\n\n` : ""}# Optional non-local frontend origin allowed by CORS\nALLOWED_ORIGIN=`;
  files["README-BACKEND.md"] =
    `# Generated backend\n\nRun \`npm run server\`, then \`npm run dev\` in another process. Records are stored in \`server/data.json\`. The API listens only on 127.0.0.1:8787 by default and accepts GET/POST/PUT/DELETE on /records; set PORT to use another local port. Localhost origins are accepted on any port; set ALLOWED_ORIGIN for one deployed frontend.${project.appConfig.authentication.mode === "generated" ? " Access is protected: configure AUTH_SECRET before starting; the first registration creates the administrator." : " Configure authentication before public deployment."}`;
  return files;
}
