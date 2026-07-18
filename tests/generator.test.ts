import { describe, expect, it } from 'vitest'
import { generateFiles } from '../src/generator'
import { createProject, makeComponent } from '../src/model'

describe('web generator', () => {
  it('emits a typed, runnable and secret-free project', () => {
    const project = createProject('Export Test')
    project.pages.push({ id: 'page', name: 'Home', path: '/', components: [makeComponent('input'), makeComponent('button'), makeComponent('list')] })
    project.dataSources.push({ id: 'source', name: 'Items', provider: 'indexeddb', collection: 'items', schema: { id: 'string', text: 'string', date: 'datetime' }, capabilities: ['get', 'query', 'insert', 'update', 'delete', 'subscribe'], secretStrategy: 'none' })
    const files = generateFiles(project)
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['package.json', 'src/main.ts', 'src/style.css', 'capacitor.config.ts', 'README.md']))
    expect(files['src/main.ts']).toContain('indexedDB.open')
    expect(files['src/main.ts']).not.toMatch(/password|apiKey|token/i)
    expect(JSON.parse(files['package.json']).scripts.build).toBe('tsc && vite build')
  })
})
