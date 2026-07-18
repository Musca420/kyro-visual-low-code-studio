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

  it('preserves nested containers in the exported markup', () => {
    const project = createProject('Nested Export')
    const stack = makeComponent('stack'), button = makeComponent('button')
    stack.id = 'stack'; button.id = 'nested-button'; button.parentId = stack.id
    project.pages.push({ id: 'page', name: 'Home', path: '/', components: [stack, button] })
    const html = generateFiles(project)['index.html']
    expect(html).toContain('<div id="stack" class="generated-container generated-stack"')
    expect(html.indexOf('id="stack"')).toBeLessThan(html.indexOf('id="nested-button"'))
    expect(html).toMatch(/id="stack"[^]*id="nested-button"[^]*<\/div>/)
  })
})
