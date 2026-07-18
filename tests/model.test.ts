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
})
