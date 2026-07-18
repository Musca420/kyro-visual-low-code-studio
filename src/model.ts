import { z } from 'zod'

export const BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const
export type Breakpoint = (typeof BREAKPOINTS)[number]

const styleSchema = z.object({
  width: z.string().default('100%'),
  minHeight: z.string().default('44px'),
  color: z.string().default('#172033'),
  background: z.string().default('#ffffff'),
  borderRadius: z.string().default('10px'),
  padding: z.string().default('12px'),
  fontSize: z.string().default('16px'),
  marginLeft: z.string().default('0px'),
  marginTop: z.string().default('0px'),
  boxShadow: z.string().default('none'),
  display: z.enum(['block', 'none']).default('block'),
})

export const componentTypes = [
  'container', 'stack', 'grid', 'spacer', 'text', 'title', 'link', 'image', 'icon',
  'button', 'input', 'textarea', 'select', 'checkbox', 'radio', 'form', 'card',
  'list', 'table', 'navbar', 'tabs', 'modal', 'loader', 'empty', 'alert', 'toast',
] as const
export const containerTypes = ['container', 'stack', 'grid', 'form', 'card', 'navbar', 'tabs', 'modal'] as const

export const componentSchema = z.object({
  id: z.string().min(1),
  type: z.enum(componentTypes),
  name: z.string().min(1),
  parentId: z.string().min(1).optional(),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  styles: z.object({ desktop: styleSchema, tablet: styleSchema.partial(), mobile: styleSchema.partial() }),
  events: z.record(z.string(), z.string()),
  binding: z.object({ sourceId: z.string(), state: z.enum(['data', 'loading', 'empty', 'error']) }).optional(),
  accessibility: z.object({ label: z.string(), role: z.string().optional() }),
})

export type EditorComponent = z.infer<typeof componentSchema>

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(['event', 'readInput', 'validate', 'insert', 'query', 'update', 'delete', 'filter', 'sort', 'kpi', 'refresh', 'navigate', 'openModal', 'notify', 'log']),
  label: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.string(), z.string()),
})

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  path: z.enum(['success', 'error']).default('success'),
})

export const pluginManifestSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9.-]+$/),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  author: z.string().min(1),
  compatibility: z.literal('1.x'),
  dependencies: z.array(z.string()).default([]),
  permissions: z.array(z.enum(['components', 'flows', 'data', 'themes'])).default([]),
  contributions: z.array(z.string()).default([]),
  configuration: z.record(z.string(), z.string()).default({}),
})

export type PluginManifest = z.infer<typeof pluginManifestSchema>

export const projectSchema = z.object({
  formatVersion: z.literal(1),
  id: z.string(),
  name: z.string().min(1),
  revision: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  pages: z.array(z.object({ id: z.string(), name: z.string(), path: z.string(), components: z.array(componentSchema) })),
  flows: z.array(z.object({ id: z.string(), name: z.string(), nodes: z.array(nodeSchema), edges: z.array(edgeSchema) })),
  state: z.record(z.string(), z.unknown()),
  dataSources: z.array(z.object({
    id: z.string(), name: z.string(), provider: z.literal('indexeddb'), collection: z.string(),
    schema: z.record(z.string(), z.enum(['string', 'datetime'])),
    capabilities: z.array(z.enum(['get', 'query', 'insert', 'update', 'delete', 'subscribe'])),
    secretStrategy: z.literal('none'),
  })),
  theme: z.object({ tokens: z.record(z.string(), z.string()) }),
  animations: z.array(z.object({ id: z.string(), name: z.string(), css: z.string() })),
  assets: z.array(z.object({ id: z.string(), name: z.string(), url: z.string() })),
  plugins: z.array(z.object({ id: z.string(), version: z.string(), enabled: z.boolean() })),
  dependencies: z.record(z.string(), z.string()),
  exportConfig: z.object({ target: z.literal('web'), capacitor: z.boolean() }),
})

export type Project = z.infer<typeof projectSchema>
export type Flow = Project['flows'][number]

const baseStyle = {
  width: '100%', minHeight: '44px', color: '#172033', background: '#ffffff',
  borderRadius: '10px', padding: '12px', fontSize: '16px', display: 'block' as const,
  marginLeft: '0px', marginTop: '0px', boxShadow: 'none',
}

export function makeComponent(type: EditorComponent['type']): EditorComponent {
  const label: Partial<Record<EditorComponent['type'], string>> = {
    input: 'Nuova attività', button: 'Aggiungi', list: 'Attività', title: 'Titolo', text: 'Testo',
  }
  return componentSchema.parse({
    id: crypto.randomUUID(), type, name: `${type[0].toUpperCase()}${type.slice(1)}`,
    props: { label: label[type] ?? type, placeholder: type === 'input' ? 'Scrivi qualcosa…' : '' },
    styles: { desktop: baseStyle, tablet: {}, mobile: { fontSize: '15px' } },
    events: {}, accessibility: { label: label[type] ?? type },
  })
}

export function createProject(name: string): Project {
  const now = new Date().toISOString()
  return projectSchema.parse({
    formatVersion: 1, id: crypto.randomUUID(), name: name.trim(), revision: 0, createdAt: now, updatedAt: now,
    pages: [], flows: [], state: {}, dataSources: [], theme: { tokens: { primary: '#6d5dfc', surface: '#ffffff' } },
    animations: [], assets: [], plugins: [], dependencies: {}, exportConfig: { target: 'web', capacitor: true },
  })
}

export function parseProject(input: unknown): Project {
  input = migrateProject(input)
  if (typeof input === 'object' && input && 'formatVersion' in input && (input as { formatVersion: unknown }).formatVersion !== 1) {
    throw new Error(`Versione progetto non supportata: ${String((input as { formatVersion: unknown }).formatVersion)}`)
  }
  const result = projectSchema.safeParse(input)
  if (!result.success) throw new Error(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'))
  validateReferences(result.data)
  return result.data
}

function migrateProject(input: unknown): unknown {
  if (!input || typeof input !== 'object' || (input as { formatVersion?: unknown }).formatVersion !== 0) return input
  const legacy = input as Record<string, unknown>
  return {
    ...legacy,
    formatVersion: 1,
    state: legacy.state ?? {},
    dataSources: legacy.dataSources ?? [],
    theme: legacy.theme ?? { tokens: {} },
    animations: legacy.animations ?? [],
    assets: legacy.assets ?? [],
    plugins: legacy.plugins ?? [],
    dependencies: legacy.dependencies ?? {},
    exportConfig: legacy.exportConfig ?? { target: 'web', capacitor: true },
  }
}

export function validateReferences(project: Project) {
  const componentIds = new Set(project.pages.flatMap((page) => page.components.map((component) => component.id)))
  const flowIds = new Set(project.flows.map((flow) => flow.id))
  const sourceIds = new Set(project.dataSources.map((source) => source.id))
  for (const page of project.pages) {
    const pageIds = new Set(page.components.map((component) => component.id))
    if (pageIds.size !== page.components.length) throw new Error(`ID componente duplicato nella pagina ${page.id}`)
    for (const component of page.components) {
      if (component.parentId && !pageIds.has(component.parentId)) throw new Error(`Contenitore mancante ${component.parentId} in ${component.id}`)
      if (component.parentId === component.id) throw new Error(`Un componente non può contenere sé stesso: ${component.id}`)
      const visited = new Set([component.id]); let parentId = component.parentId
      while (parentId) { if (visited.has(parentId)) throw new Error(`Gerarchia ciclica in ${component.id}`); visited.add(parentId); parentId = page.components.find((item) => item.id === parentId)?.parentId }
      for (const flowId of Object.values(component.events)) if (!flowIds.has(flowId)) throw new Error(`Flow mancante ${flowId} in ${component.id}`)
      if (component.binding && !sourceIds.has(component.binding.sourceId)) throw new Error(`Sorgente mancante ${component.binding.sourceId}`)
    }
  }
  for (const flow of project.flows) {
    const nodes = new Set(flow.nodes.map((node) => node.id))
    for (const edge of flow.edges) if (!nodes.has(edge.source) || !nodes.has(edge.target)) throw new Error(`Collegamento non valido ${edge.id}`)
    for (const node of flow.nodes) if (node.type === 'readInput' && !componentIds.has(node.config.componentId)) throw new Error(`Input mancante ${node.config.componentId}`)
  }
}

export function serializeProject(project: Project) {
  return JSON.stringify(sortValue(parseProject(project)), null, 2)
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortValue(item)]))
  return value
}
