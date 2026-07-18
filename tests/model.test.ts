import { describe, expect, it } from 'vitest'
import { createProject, makeComponent, parseProject, serializeProject } from '../src/model'

describe('project model', () => {
  it('assegna una revisione iniziale e migra i documenti senza revisione', () => {
    const project = createProject('Revision')
    expect(project.revision).toBe(0)
    const legacy = JSON.parse(JSON.stringify(project))
    delete legacy.revision
    expect(parseProject(legacy).revision).toBe(0)
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
    expect(migrated.exportConfig).toEqual({ target: 'web', capacitor: true })
  })
})
