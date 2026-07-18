import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { generateFiles } from '../src/generator'
import { createProject, makeComponent } from '../src/model'

const project = createProject('Generated Vertical Slice')
project.pages.push({ id: crypto.randomUUID(), name: 'Home', path: '/', components: [makeComponent('title'), makeComponent('input'), makeComponent('button'), makeComponent('list')] })
project.dataSources.push({ id: crypto.randomUUID(), name: 'Items', provider: 'indexeddb', collection: 'items', schema: { id: 'string', text: 'string', date: 'datetime' }, capabilities: ['get', 'query', 'insert', 'update', 'delete', 'subscribe'], secretStrategy: 'none' })

const target = resolve('generated-app')
await rm(target, { recursive: true, force: true })
for (const [path, contents] of Object.entries(generateFiles(project))) {
  const file = resolve(target, path)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, contents, 'utf8')
}
