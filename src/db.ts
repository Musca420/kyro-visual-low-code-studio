import type { PluginManifest, Project } from './model'
import { parseProject, pluginManifestSchema } from './model'
import { z } from 'zod'
import { capabilityProposalSchema, createGlobalCapabilityVersion, globalCapabilitySchema, type CapabilityProposal, type GlobalCapability } from './globalCapability'
import type { ProjectTransactionRecord } from './transactionEngine'
import { globalCapabilityImplementationSchema, openModeSessionSchema, type GlobalCapabilityImplementation, type OpenModeSession } from './openMode'
import { artifactRecordSchema, createArtifact, verifyArtifact, type ArtifactRecord } from './artifactRegistry'

const DB_NAME = 'frontend-editor'
const DB_VERSION = 8

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
      if (!db.objectStoreNames.contains('globalCapabilities')) db.createObjectStore('globalCapabilities', { keyPath: 'id' }).createIndex('state', 'state')
      if (!db.objectStoreNames.contains('projectTransactions')) db.createObjectStore('projectTransactions', { keyPath: 'id' }).createIndex('projectId', 'projectId')
      if (!db.objectStoreNames.contains('runtimeRuns')) db.createObjectStore('runtimeRuns', { keyPath: 'id' }).createIndex('projectId', 'projectId')
      if (!db.objectStoreNames.contains('openModeSessions')) db.createObjectStore('openModeSessions', { keyPath: 'id' }).createIndex('projectId', 'projectId')
      if (!db.objectStoreNames.contains('capabilityImplementations')) db.createObjectStore('capabilityImplementations', { keyPath: 'id' }).createIndex('capabilityId', 'capabilityId')
      if (!db.objectStoreNames.contains('artifacts')) db.createObjectStore('artifacts', { keyPath: 'id' }).createIndex('projectId', 'projectId')
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
  const value = parseProject(project)
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['projects', 'projectVersions'], 'readwrite')
    let conflict: Error | undefined
    const existingRequest = transaction.objectStore('projects').get(value.id)
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result ? parseProject(existingRequest.result) : undefined
      const isNewer = existing && (
        existing.revision > value.revision
        || (existing.revision === value.revision && existing.updatedAt > value.updatedAt)
      )
      if (isNewer) {
        conflict = new Error(`A newer revision of ${value.name} is already saved`)
        return
      }
      transaction.objectStore('projects').put(value)
      transaction.objectStore('projectVersions').put({ id: `${value.id}:${value.revision}`, projectId: value.id, revision: value.revision, createdAt: value.updatedAt, project: value })
    }
    transaction.oncomplete = () => {
      db.close()
      if (conflict) reject(conflict)
      else resolve()
    }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
  const obsolete = (await listProjectVersions(value.id)).slice(40)
  await Promise.all(obsolete.map((item) => request('projectVersions', 'readwrite', (store) => store.delete(item.id))))
  return value
}

export function getProjectTransaction(id: string): Promise<ProjectTransactionRecord | undefined> {
  return request<ProjectTransactionRecord | undefined>('projectTransactions', 'readonly', (store) => store.get(id))
}

export function listProjectTransactions(projectId: string): Promise<ProjectTransactionRecord[]> {
  return request<ProjectTransactionRecord[]>('projectTransactions', 'readonly', (store) => store.index('projectId').getAll(projectId))
    .then((items) => items.sort((left, right) => right.createdAt.localeCompare(left.createdAt)))
}

export async function commitProjectTransaction(record: ProjectTransactionRecord): Promise<ProjectTransactionRecord> {
  if (!record.afterProject || record.finalRevision !== record.baseRevision + 1) throw new Error('An applied transaction needs one final Graph revision')
  if (record.verification?.status !== 'verified') throw new Error('A transaction must pass Verification before commit')
  const value = parseProject(record.afterProject)
  const reportArtifact = await createArtifact({
    projectId: record.projectId, kind: 'report', name: `Verification ${record.id}`, mediaType: 'application/json', payload: JSON.stringify(record.verification),
    provenance: { actor: record.actor, source: 'verification', revision: record.finalRevision, transactionId: record.id, ...(record.jobId ? { jobId: record.jobId } : {}) }, createdAt: record.createdAt,
  })
  const db = await openDb()
  const committed = await new Promise<ProjectTransactionRecord>((resolve, reject) => {
    const transaction = db.transaction(['projects', 'projectVersions', 'projectTransactions', 'artifacts'], 'readwrite')
    const transactionStore = transaction.objectStore('projectTransactions')
    let result: ProjectTransactionRecord = record
    let failure: Error | undefined
    const existingRequest = transactionStore.get(record.id)
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result as ProjectTransactionRecord | undefined
      if (existing) {
        if (existing.projectId !== record.projectId || existing.operationHash !== record.operationHash)
          failure = new Error('A transaction ID cannot be reused with different operations')
        else result = existing
        return
      }
      const projectRequest = transaction.objectStore('projects').get(record.projectId)
      projectRequest.onsuccess = () => {
        const current = projectRequest.result ? parseProject(projectRequest.result) : undefined
        if (!current || current.revision !== record.baseRevision) {
          failure = new Error('The persisted project revision changed before commit')
          return
        }
        transaction.objectStore('projects').put(value)
        transaction.objectStore('projectVersions').put({ id: `${value.id}:${value.revision}`, projectId: value.id, revision: value.revision, createdAt: value.updatedAt, project: value })
        transactionStore.add(record)
        transaction.objectStore('artifacts').add(reportArtifact)
      }
    }
    transaction.oncomplete = () => {
      db.close()
      if (failure) reject(failure)
      else resolve(result)
    }
    transaction.onerror = () => { db.close(); reject(failure ?? transaction.error) }
    transaction.onabort = () => { db.close(); reject(failure ?? transaction.error ?? new Error('Transaction commit aborted')) }
  })
  return committed
}

export async function saveFailedProjectTransaction(record: ProjectTransactionRecord) {
  const existing = await getProjectTransaction(record.id)
  if (existing) return existing
  const reportArtifact = record.verification ? await createArtifact({
    projectId: record.projectId, kind: 'report', name: `Failed verification ${record.id}`, mediaType: 'application/json', payload: JSON.stringify(record.verification),
    provenance: { actor: record.actor, source: 'verification', revision: record.baseRevision, transactionId: record.id, ...(record.jobId ? { jobId: record.jobId } : {}) }, createdAt: record.createdAt,
  }) : undefined
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(reportArtifact ? ['projectTransactions', 'artifacts'] : ['projectTransactions'], 'readwrite')
    transaction.objectStore('projectTransactions').add(record)
    if (reportArtifact) transaction.objectStore('artifacts').add(reportArtifact)
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
  return record
}

export type ProjectVersion = { id: string; projectId: string; revision: number; createdAt: string; project: Project }
export type ExportRecord = { id: string; projectId: string; fileName: string; target: string; createdAt: string; blob: Blob }
export type RuntimeRunRecord = Project['flowRuns'][number] & { projectId: string; graphRevision: number }

export const listRuntimeRuns = (projectId: string) => request<RuntimeRunRecord[]>('runtimeRuns', 'readonly', (store) => store.index('projectId').getAll(projectId))
  .then((items) => items.sort((left, right) => right.startedAt.localeCompare(left.startedAt)))
export async function saveRuntimeRun(run: RuntimeRunRecord) {
  await request('runtimeRuns', 'readwrite', (store) => store.put(run))
  const obsolete = (await listRuntimeRuns(run.projectId)).slice(20)
  await Promise.all(obsolete.map((item) => request('runtimeRuns', 'readwrite', (store) => store.delete(item.id))))
  return run
}

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
export async function saveExportArtifact(record: ExportRecord, artifactInput: ArtifactRecord) {
  if (record.blob.size > 10_000_000) throw new Error('Export troppo grande per lo storico locale (10 MB)')
  const artifact = artifactRecordSchema.parse(artifactInput), integrity = await verifyArtifact(artifact)
  if (!integrity.passed || artifact.projectId !== record.projectId || artifact.provenance.sourceId !== record.id) throw new Error('Export artifact provenance or integrity failed')
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['exports', 'artifacts'], 'readwrite')
    transaction.objectStore('exports').put(record)
    transaction.objectStore('artifacts').add(artifact)
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
  const obsolete = (await listExports(record.projectId)).slice(10)
  await Promise.all(obsolete.map((item) => request('exports', 'readwrite', (store) => store.delete(item.id))))
  return artifact
}

export const listArtifacts = (projectId: string) => request<ArtifactRecord[]>('artifacts', 'readonly', (store) => store.index('projectId').getAll(projectId))
  .then((items) => items.map((item) => artifactRecordSchema.parse(item)).sort((left, right) => right.createdAt.localeCompare(left.createdAt)))
export const listAllArtifacts = () => request<ArtifactRecord[]>('artifacts', 'readonly', (store) => store.getAll()).then((items) => items.map((item) => artifactRecordSchema.parse(item)))
export async function saveArtifact(input: ArtifactRecord) {
  const record = artifactRecordSchema.parse(input), integrity = await verifyArtifact(record)
  if (!integrity.passed) throw new Error(`Artifact integrity failed: ${integrity.issues.join('; ')}`)
  const existing = await request<ArtifactRecord | undefined>('artifacts', 'readonly', (store) => store.get(record.id))
  if (existing) {
    const current = artifactRecordSchema.parse(existing)
    if (current.sha256 !== record.sha256 || JSON.stringify(current.provenance) !== JSON.stringify(record.provenance)) throw new Error('Artifact identity collision')
    return current
  }
  await request('artifacts', 'readwrite', (store) => store.add(record))
  return record
}

export async function deleteProject(id: string) {
  const [versions, exports, transactions, runs, artifacts] = await Promise.all([listProjectVersions(id), listExports(id), listProjectTransactions(id), listRuntimeRuns(id), listArtifacts(id)])
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['projects', 'projectVersions', 'exports', 'projectTransactions', 'runtimeRuns', 'artifacts'], 'readwrite')
    transaction.objectStore('projects').delete(id)
    versions.forEach((item) => transaction.objectStore('projectVersions').delete(item.id))
    exports.forEach((item) => transaction.objectStore('exports').delete(item.id))
    transactions.forEach((item) => transaction.objectStore('projectTransactions').delete(item.id))
    runs.forEach((item) => transaction.objectStore('runtimeRuns').delete(item.id))
    artifacts.forEach((item) => transaction.objectStore('artifacts').delete(item.id))
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
  warnings: z.string().optional(),
  changedFiles: z.array(z.string()),
  tests: z.array(z.object({ command: z.string(), passed: z.boolean(), output: z.string() })),
  transactionId: z.string().optional(),
  contextHash: z.string().optional(),
  contextBytes: z.number().int().nonnegative().optional(),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(), cachedInputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(), reasoningOutputTokens: z.number().int().nonnegative(), totalTokens: z.number().int().nonnegative(),
  }).optional(),
  learningCandidate: z.object({
    kind: z.enum(["reusable_flow", "typed_module", "plugin"]),
    name: z.string().min(1),
    generalizedIntent: z.string().min(1),
    inputs: z.array(z.string()),
    outputs: z.array(z.string()),
    activation: z.enum(["passing_tests", "explicit_review"]),
  }).optional(),
  capabilityProposal: capabilityProposalSchema.optional(),
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
  if (!existing || existing.sourceId !== sourceId) throw new Error('Project not found')
  const value = projectInputSchema.parse(input)
  const record: LocalRecord = { ...existing, text: value.name, description: value.description, status: value.status, priority: value.priority, dueDate: value.dueDate, date: new Date().toISOString() }
  await request('records', 'readwrite', (store) => store.put(record))
  return record
}

export async function deleteProjectRecord(sourceId: string, id: string) {
  const existing = await request<LocalRecord | undefined>('records', 'readonly', (store) => store.get(id))
  if (!existing || existing.sourceId !== sourceId) throw new Error('Project not found')
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

export const listGlobalCapabilities = () => request<GlobalCapability[]>('globalCapabilities', 'readonly', (store) => store.getAll())
  .then((items) => items.map((item) => globalCapabilitySchema.parse(item)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))

export async function registerGlobalCapability(proposalValue: CapabilityProposal, source: { jobId: string; prompt: string }) {
  const proposal = capabilityProposalSchema.parse(proposalValue)
  const installed = await listGlobalCapabilities()
  const existing = installed.find((item) => item.kind === proposal.kind && item.generalizedIntent.toLocaleLowerCase() === proposal.generalizedIntent.toLocaleLowerCase())
  const capability = createGlobalCapabilityVersion(proposal, source, existing)
  await request('globalCapabilities', 'readwrite', (store) => store.put(capability))
  return capability
}

export const listOpenModeSessions = (projectId: string) => request<OpenModeSession[]>('openModeSessions', 'readonly', (store) => store.index('projectId').getAll(projectId))
  .then((items) => items.map((item) => openModeSessionSchema.parse(item)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))

export const listCapabilityImplementations = (capabilityId: string) => request<GlobalCapabilityImplementation[]>('capabilityImplementations', 'readonly', (store) => store.index('capabilityId').getAll(capabilityId))
  .then((items) => items.map((item) => globalCapabilityImplementationSchema.parse(item)))

export const saveOpenModeSession = (session: OpenModeSession) => request('openModeSessions', 'readwrite', (store) => store.put(openModeSessionSchema.parse(session)))
export const listAllOpenModeSessions = () => request<OpenModeSession[]>('openModeSessions', 'readonly', (store) => store.getAll()).then((items) => items.map((item) => openModeSessionSchema.parse(item)))
export const listAllCapabilityImplementations = () => request<GlobalCapabilityImplementation[]>('capabilityImplementations', 'readonly', (store) => store.getAll()).then((items) => items.map((item) => globalCapabilityImplementationSchema.parse(item)))

export async function saveVerifiedOpenModeResult(result: { session: OpenModeSession; capability: GlobalCapability; implementation: GlobalCapabilityImplementation | null }) {
  const session = openModeSessionSchema.parse(result.session)
  if (session.stage !== 'completed' || result.capability.state !== 'active' || !result.implementation) throw new Error('Only a completed verified Open Mode result can be registered')
  const capability = globalCapabilitySchema.parse(result.capability), implementation = globalCapabilityImplementationSchema.parse(result.implementation)
  if (capability.capabilityId !== implementation.capabilityId || capability.version !== implementation.capabilityVersion) throw new Error('Capability implementation scope mismatch')
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['openModeSessions', 'globalCapabilities', 'capabilityImplementations'], 'readwrite')
    transaction.objectStore('openModeSessions').put(session)
    transaction.objectStore('globalCapabilities').put(capability)
    transaction.objectStore('capabilityImplementations').put(implementation)
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
  return { session, capability, implementation }
}

export async function mergeDatabaseBackup(projects: Project[], records: LocalRecord[], plugins: PluginManifest[], timeline: CodexTimelineEntry[] = [], versions: ProjectVersion[] = [], exports: ExportRecord[] = [], globalCapabilities: GlobalCapability[] = [], openModeSessions: OpenModeSession[] = [], capabilityImplementations: GlobalCapabilityImplementation[] = [], artifacts: ArtifactRecord[] = []) {
  for (const artifact of artifacts) if (!(await verifyArtifact(artifact)).passed) throw new Error(`Backup artifact ${artifact.id} failed integrity verification`)
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['projects', 'records', 'plugins', 'codexTimeline', 'projectVersions', 'exports', 'globalCapabilities', 'openModeSessions', 'capabilityImplementations', 'artifacts'], 'readwrite')
    const projectStore = transaction.objectStore('projects')
    const recordStore = transaction.objectStore('records')
    const pluginStore = transaction.objectStore('plugins')
    const timelineStore = transaction.objectStore('codexTimeline')
    const versionStore = transaction.objectStore('projectVersions')
    const exportStore = transaction.objectStore('exports')
    const capabilityStore = transaction.objectStore('globalCapabilities')
    const openModeStore = transaction.objectStore('openModeSessions')
    const implementationStore = transaction.objectStore('capabilityImplementations')
    const artifactStore = transaction.objectStore('artifacts')
    projects.forEach((project) => projectStore.put(parseProject(project)))
    records.forEach((record) => recordStore.put(record))
    plugins.forEach((plugin) => pluginStore.put(pluginManifestSchema.parse(plugin)))
    timeline.forEach((entry) => timelineStore.put(codexTimelineEntrySchema.parse(entry)))
    versions.forEach((version) => versionStore.put({ ...version, project: parseProject(version.project) }))
    exports.forEach((item) => exportStore.put(item))
    globalCapabilities.forEach((item) => capabilityStore.put(globalCapabilitySchema.parse(item)))
    openModeSessions.forEach((item) => openModeStore.put(openModeSessionSchema.parse(item)))
    capabilityImplementations.forEach((item) => implementationStore.put(globalCapabilityImplementationSchema.parse(item)))
    artifacts.forEach((item) => artifactStore.put(artifactRecordSchema.parse(item)))
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
