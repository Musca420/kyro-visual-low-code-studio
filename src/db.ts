import type { PluginManifest, Project } from './model'
import { parseProject, pluginManifestSchema } from './model'
import { z } from 'zod'

const DB_NAME = 'frontend-editor'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' }).createIndex('sourceId', 'sourceId')
      if (!db.objectStoreNames.contains('plugins')) db.createObjectStore('plugins', { keyPath: 'id' })
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
  await request('projects', 'readwrite', (store) => store.put(value))
  return value
}

export const deleteProject = (id: string) => request('projects', 'readwrite', (store) => store.delete(id))

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

export async function mergeDatabaseBackup(projects: Project[], records: LocalRecord[], plugins: PluginManifest[]) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['projects', 'records', 'plugins'], 'readwrite')
    const projectStore = transaction.objectStore('projects')
    const recordStore = transaction.objectStore('records')
    const pluginStore = transaction.objectStore('plugins')
    projects.forEach((project) => projectStore.put(parseProject(project)))
    records.forEach((record) => recordStore.put(record))
    plugins.forEach((plugin) => pluginStore.put(pluginManifestSchema.parse(plugin)))
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('Ripristino annullato')) }
  })
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
