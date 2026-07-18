import { describe, expect, it } from 'vitest'
import { createProject, makeComponent, parseProject, pluginManifestSchema, serializeProject } from '../src/model'

describe('project model', () => {
  it('assegna una revisione iniziale e migra i documenti senza revisione', () => {
    const project = createProject('Revision')
    expect(project.revision).toBe(0)
    const legacy = JSON.parse(JSON.stringify(project))
    delete legacy.revision
    expect(parseProject(legacy).revision).toBe(0)
  })

  it('valida parent mancanti e gerarchie cicliche', () => {
    const project = createProject('Tree')
    const parent = makeComponent('container'), child = makeComponent('button')
    child.parentId = parent.id
    project.pages.push({ id: 'page', name: 'Home', path: '/', components: [parent, child] })
    expect(parseProject(project).pages[0].components[1].parentId).toBe(parent.id)
    parent.parentId = child.id
    expect(() => parseProject(project)).toThrow('Gerarchia ciclica')
    parent.parentId = undefined; child.parentId = 'missing'
    expect(() => parseProject(project)).toThrow('Contenitore mancante')
  })
  it('round-trips deterministically and preserves stable ids', () => {
    const project = createProject('Demo')
    const component = makeComponent('input')
    project.pages.push({ id: crypto.randomUUID(), name: 'Home', path: '/', components: [component] })
    const first = serializeProject(project)
    const restored = parseProject(JSON.parse(first))
    expect(serializeProject(restored)).toBe(first)
    expect(restored.pages[0].components[0].id).toBe(component.id)
  })
  it('valida e conserva i blocchi visuali riutilizzabili', () => {
    const project = createProject('Blocchi')
    const card = makeComponent('card')
    project.reusableComponents.push({ id: 'feature', name: 'Feature', components: [card], exposedProperties: [{ componentId: card.id, property: 'label', label: 'Titolo' }] })
    expect(parseProject(project).reusableComponents[0].name).toBe('Feature')
    project.reusableComponents[0].exposedProperties[0].componentId = 'missing'
    expect(() => parseProject(project)).toThrow('Proprietà esposta senza componente')
  })
  it('conserva al massimo una cronologia flow tipizzata nel progetto', () => {
    const project = createProject('Profiling')
    project.flowRuns.push({ id: 'run', flowId: 'flow', startedAt: new Date().toISOString(), durationMs: 12.5, logs: [{ nodeId: 'node', level: 'info', message: 'Fatto', durationMs: 12.5 }] })
    expect(parseProject(project).flowRuns[0].logs[0].durationMs).toBe(12.5)
  })

  it('rejects dangling references with a useful error', () => {
    const project = createProject('Invalid')
    const component = makeComponent('button')
    component.events.click = 'missing-flow'
    project.pages.push({ id: crypto.randomUUID(), name: 'Home', path: '/', components: [component] })
    expect(() => parseProject(project)).toThrow('Flow mancante missing-flow')
  })

  it('rejects unknown format versions safely', () => {
    expect(() => parseProject({ formatVersion: 99 })).toThrow('Versione progetto non supportata: 99')
  })

  it('migrates legacy version 0 without losing pages', () => {
    const current = createProject('Legacy')
    const legacy = { ...current, formatVersion: 0, theme: undefined, exportConfig: undefined }
    const migrated = parseProject(legacy)
    expect(migrated.formatVersion).toBe(1)
    expect(migrated.exportConfig).toEqual({ target: 'web', capacitor: false })
  })

  it('isola i contributi plugin dietro permessi dichiarati', () => {
    const manifest = {
      id: 'test.visual', name: 'Visual', version: '1.0.0', author: 'Test', compatibility: '1.x' as const,
      dependencies: [], permissions: ['components'] as const,
      contributions: [{ kind: 'component' as const, id: 'visual-card', label: 'Visual card', componentType: 'card' as const, props: {}, styles: { background: '#112233' } }],
      configuration: {},
    }
    expect(pluginManifestSchema.parse(manifest).contributions).toHaveLength(1)
    expect(() => pluginManifestSchema.parse({ ...manifest, permissions: [] })).toThrow('richiede il permesso components')
  })

  it('conserva schemi visuali con testo, numeri, booleani e date', () => {
    const project = createProject('Schema ricco')
    project.dataSources.push({ id: 'source', name: 'Prodotti', provider: 'indexeddb', collection: 'products', schema: { id: 'string', price: 'number', active: 'boolean', publishedAt: 'datetime' }, capabilities: ['get', 'query'], secretStrategy: 'none' })
    expect(parseProject(project).dataSources[0].schema).toEqual({ id: 'string', price: 'number', active: 'boolean', publishedAt: 'datetime' })
  })

  it('versiona gli schemi e valida relazioni tra sorgenti', () => {
    const project = createProject('Relazioni')
    project.dataSources.push(
      { id: 'clients', name: 'Clienti', provider: 'indexeddb', collection: 'clients', schema: { id: 'string', name: 'string' }, schemaVersion: 1, migrations: [], relations: [], capabilities: ['get', 'query'], secretStrategy: 'none' },
      { id: 'projects', name: 'Progetti', provider: 'indexeddb', collection: 'projects', schema: { id: 'string', clientId: 'string' }, schemaVersion: 2, migrations: [{ version: 2, createdAt: new Date().toISOString(), previousSchema: { id: 'string' }, nextSchema: { id: 'string', clientId: 'string' } }], relations: [{ id: 'relation', field: 'clientId', targetSourceId: 'clients', targetField: 'id', kind: 'one' }], capabilities: ['get', 'query'], secretStrategy: 'none' },
    )
    const restored = parseProject(project)
    expect(restored.dataSources[1].schemaVersion).toBe(2)
    expect(restored.dataSources[1].relations?.[0]).toMatchObject({ field: 'clientId', targetSourceId: 'clients' })
    restored.dataSources[1].relations![0].targetField = 'missing'
    expect(() => parseProject(restored)).toThrow('Campo relazione mancante Clienti.missing')
  })
})
