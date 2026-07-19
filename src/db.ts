import type { PluginManifest, Project } from './model'
import { parseProject, pluginManifestSchema } from './model'
import { z } from 'zod'

const DB_NAME = 'frontend-editor'
const DB_VERSION = 3

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' }).createIndex('sourceId', 'sourceId')
      if (!db.objectStoreNames.contains('plugins')) db.createObjectStore('plugins', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('codexTimeline')) db.createObjectStore('codexTimeline', { keyPath: 'id' }).createIndex('projectId', 'projectId')
      if (!db.objectStoreNames.contains('projectVersions')) db.createObjectStore('projectVersions', { keyPath: 'id' }).createIndex('projectId', 'projectId')
      if (!db.objectStoreNames.contains('exports')) db.createObjectStore('exports', { keyPath: 'id' }).createIndex('projectId', 'projectId')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function request<T>(store: string, mode: IDBTransactionMode, action: (objectStore: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode)
    const operation = action(transaction.objectStore(store))
    operation.onsuccess = () => resolve(operation.result)
    operation.onerror = () => reject(operation.error)
    transaction.oncomplete = () => db.close()
  })
}

export async function listProjects(): Promise<Project[]> {
  return (await request('projects', 'readonly', (store) => store.getAll())).map(parseProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getProject(id: string): Promise<Project | undefined> {
  const value = await request<unknown>('projects', 'readonly', (store) => store.get(id))
  return value ? parseProject(value) : undefined
}

export async function saveProject(project: Project) {
  const value = parseProject({ ...project, updatedAt: new Date().toISOString() })
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['projects', 'projectVersions'], 'readwrite')
    transaction.objectStore('projects').put(value)
    transaction.objectStore('projectVersions').put({ id: `${value.id}:${value.revision}`, projectId: value.id, revision: value.revision, createdAt: value.updatedAt, project: value })
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
  const obsolete = (await listProjectVersions(value.id)).slice(40)
  await Promise.all(obsolete.map((item) => request('projectVersions', 'readwrite', (store) => store.delete(item.id))))
  return value
}

export type ProjectVersion = { id: string; projectId: string; revision: number; createdAt: string; project: Project }
export type ExportRecord = { id: string; projectId: string; fileName: string; target: string; createdAt: string; blob: Blob }

export const listProjectVersions = (projectId: string) => request<ProjectVersion[]>('projectVersions', 'readonly', (store) => store.index('projectId').getAll(projectId))
  .then((items) => items.map((item) => ({ ...item, project: parseProject(item.project) })).sort((a, b) => b.revision - a.revision))
export const listAllProjectVersions = () => request<ProjectVersion[]>('projectVersions', 'readonly', (store) => store.getAll())
  .then((items) => items.map((item) => ({ ...item, project: parseProject(item.project) })))
export const listExports = (projectId: string) => request<ExportRecord[]>('exports', 'readonly', (store) => store.index('projectId').getAll(projectId))
  .then((items) => items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
export const listAllExports = () => request<ExportRecord[]>('exports', 'readonly', (store) => store.getAll())
export async function saveExport(record: ExportRecord) {
  if (record.blob.size > 10_000_000) throw new Error('Export troppo grande per lo storico locale (10 MB)')
  await request('exports', 'readwrite', (store) => store.put(record))
  const obsolete = (await listExports(record.projectId)).slice(10)
  await Promise.all(obsolete.map((item) => request('exports', 'readwrite', (store) => store.delete(item.id))))
}

export async function deleteProject(id: string) {
  const [versions, exports] = await Promise.all([listProjectVersions(id), listExports(id)])
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['projects', 'projectVersions', 'exports'], 'readwrite')
    transaction.objectStore('projects').delete(id)
    versions.forEach((item) => transaction.objectStore('projectVersions').delete(item.id))
    exports.forEach((item) => transaction.objectStore('exports').delete(item.id))
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}

export type LocalRecord = {
  id: string
  sourceId: string
  text: string
  date: string
  description?: string
  status?: 'Planned' | 'In progress' | 'Completed' | 'On hold'
  priority?: 'Low' | 'Medium' | 'High'
  dueDate?: string
}

export const codexTimelineEntrySchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  componentId: z.string().min(1),
  componentName: z.string().min(1),
  prompt: z.string().min(1).max(8000),
  revision: z.number().int().nonnegative(),
  mode: z.enum(['plan', 'apply']),
  status: z.enum(['running', 'completed', 'error', 'cancelled', 'restored']),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  output: z.string(),
  errors: z.string(),
  changedFiles: z.array(z.string()),
  tests: z.array(z.object({ command: z.string(), passed: z.boolean(), output: z.string() })),
  beforeScreenshot: z.string().startsWith('data:image/png;base64,').max(1_500_000).optional(),
  afterScreenshot: z.string().startsWith('data:image/png;base64,').max(1_500_000).optional(),
})
export type CodexTimelineEntry = z.infer<typeof codexTimelineEntrySchema>

const projectInputSchema = z.object({
  name: z.string().trim().min(2, 'Il nome deve contenere almeno 2 caratteri'),
  description: z.string().trim().min(4, 'La descrizione deve contenere almeno 4 caratteri'),
  status: z.enum(['Planned', 'In progress', 'Completed', 'On hold']),
  priority: z.enum(['Low', 'Medium', 'High']),
  dueDate: z.string().date('Inserisci una data valida'),
})

export async function insertRecord(sourceId: string, text: string): Promise<LocalRecord> {
  const record = { id: crypto.randomUUID(), sourceId, text, date: new Date().toISOString() }
  await request('records', 'readwrite', (store) => store.add(record))
  return record
}

export async function insertGenericRecord(sourceId: string, input: unknown): Promise<LocalRecord> {
  if (typeof input === 'string') return insertRecord(sourceId, input)
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Il record deve essere un insieme di campi')
  const fields = input as Record<string, unknown>
  const record = {
    ...fields,
    id: typeof fields.id === 'string' && fields.id ? fields.id : crypto.randomUUID(),
    sourceId,
    text: String(fields.text ?? fields.name ?? fields.title ?? 'Elemento'),
    date: typeof fields.date === 'string' ? fields.date : new Date().toISOString(),
  } as LocalRecord
  await request('records', 'readwrite', (store) => store.add(record))
  return record
}

export async function updateGenericRecord(sourceId: string, id: string, input: unknown): Promise<LocalRecord> {
  const existing = await request<LocalRecord | undefined>('records', 'readonly', (store) => store.get(id))
  if (!existing || existing.sourceId !== sourceId) throw new Error('Record non trovato')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('La modifica deve contenere campi validi')
  const fields = input as Record<string, unknown>
  const record = { ...existing, ...fields, id: existing.id, sourceId, text: String(fields.text ?? fields.name ?? fields.title ?? existing.text), date: new Date().toISOString() } as LocalRecord
  await request('records', 'readwrite', (store) => store.put(record))
  return record
}

export async function deleteGenericRecord(sourceId: string, id: string) {
  const existing = await request<LocalRecord | undefined>('records', 'readonly', (store) => store.get(id))
  if (!existing || existing.sourceId !== sourceId) throw new Error('Record non trovato')
  await request('records', 'readwrite', (store) => store.delete(id))
}

export async function insertProjectRecord(sourceId: string, input: unknown): Promise<LocalRecord> {
  const value = projectInputSchema.parse(input)
  const record: LocalRecord = { id: crypto.randomUUID(), sourceId, text: value.name, description: value.description, status: value.status, priority: value.priority, dueDate: value.dueDate, date: new Date().toISOString() }
  await request('records', 'readwrite', (store) => store.add(record))
  return record
}

export async function updateProjectRecord(sourceId: string, id: string, input: unknown): Promise<LocalRecord> {
  const existing = await request<LocalRecord | undefined>('records', 'readonly', (store) => store.get(id))
  if (!existing || existing.sourceId !== sourceId) throw new Error('Progetto non trovato')
  const value = projectInputSchema.parse(input)
  const record: LocalRecord = { ...existing, text: value.name, description: value.description, status: value.status, priority: value.priority, dueDate: value.dueDate, date: new Date().toISOString() }
  await request('records', 'readwrite', (store) => store.put(record))
  return record
}

export async function deleteProjectRecord(sourceId: string, id: string) {
  const existing = await request<LocalRecord | undefined>('records', 'readonly', (store) => store.get(id))
  if (!existing || existing.sourceId !== sourceId) throw new Error('Progetto non trovato')
  await request('records', 'readwrite', (store) => store.delete(id))
}

export async function queryRecords(sourceId: string): Promise<LocalRecord[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('records', 'readonly')
    const operation = transaction.objectStore('records').index('sourceId').getAll(sourceId)
    operation.onsuccess = () => resolve((operation.result as LocalRecord[]).sort((a, b) => b.date.localeCompare(a.date)))
    operation.onerror = () => reject(operation.error)
    transaction.oncomplete = () => db.close()
  })
}

export const listPlugins = () => request<PluginManifest[]>('plugins', 'readonly', (store) => store.getAll())
export const listAllRecords = () => request<LocalRecord[]>('records', 'readonly', (store) => store.getAll())

export async function mergeDatabaseBackup(projects: Project[], records: LocalRecord[], plugins: PluginManifest[], timeline: CodexTimelineEntry[] = [], versions: ProjectVersion[] = [], exports: ExportRecord[] = []) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['projects', 'records', 'plugins', 'codexTimeline', 'projectVersions', 'exports'], 'readwrite')
    const projectStore = transaction.objectStore('projects')
    const recordStore = transaction.objectStore('records')
    const pluginStore = transaction.objectStore('plugins')
    const timelineStore = transaction.objectStore('codexTimeline')
    const versionStore = transaction.objectStore('projectVersions')
    const exportStore = transaction.objectStore('exports')
    projects.forEach((project) => projectStore.put(parseProject(project)))
    records.forEach((record) => recordStore.put(record))
    plugins.forEach((plugin) => pluginStore.put(pluginManifestSchema.parse(plugin)))
    timeline.forEach((entry) => timelineStore.put(codexTimelineEntrySchema.parse(entry)))
    versions.forEach((version) => versionStore.put({ ...version, project: parseProject(version.project) }))
    exports.forEach((item) => exportStore.put(item))
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('Ripristino annullato')) }
  })
}
export function listCodexTimeline(projectId: string): Promise<CodexTimelineEntry[]> {
  return request<CodexTimelineEntry[]>('codexTimeline', 'readonly', (store) => store.index('projectId').getAll(projectId))
    .then((items) => items.map((item) => codexTimelineEntrySchema.parse(item)).sort((a, b) => b.startedAt.localeCompare(a.startedAt)))
}
export function listAllCodexTimeline(): Promise<CodexTimelineEntry[]> {
  return request<CodexTimelineEntry[]>('codexTimeline', 'readonly', (store) => store.getAll())
    .then((items) => items.map((item) => codexTimelineEntrySchema.parse(item)))
}
export async function saveCodexTimelineEntry(value: CodexTimelineEntry) {
  const entry = codexTimelineEntrySchema.parse(value)
  await request('codexTimeline', 'readwrite', (store) => store.put(entry))
  const obsolete = (await listCodexTimeline(entry.projectId)).slice(100)
  await Promise.all(obsolete.map((item) => request('codexTimeline', 'readwrite', (store) => store.delete(item.id))))
}
export async function installPlugin(value: unknown) {
  const manifest = pluginManifestSchema.parse(value)
  const installed = await listPlugins()
  if (installed.some((plugin) => plugin.id === manifest.id)) throw new Error(`Collisione ID plugin: ${manifest.id}`)
  const missing = manifest.dependencies.filter((dependency) => !installed.some((plugin) => plugin.id === dependency))
  if (missing.length) throw new Error(`Dipendenze plugin mancanti: ${missing.join(', ')}`)
  return request('plugins', 'readwrite', (store) => store.add(manifest))
}
export const removePlugin = (id: string) => request('plugins', 'readwrite', (store) => store.delete(id))
