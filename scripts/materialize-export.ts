import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { generateFiles } from '../src/generator'
import { createProject, makeComponent } from '../src/model'

const project = createProject('Generated Vertical Slice')
const title = makeComponent('title'), input = makeComponent('input'), button = makeComponent('button'), list = makeComponent('list')
project.pages.push({ id: crypto.randomUUID(), name: 'Home', path: '/', components: [title, input, button, list] })
const sourceId = crypto.randomUUID(), flowId = crypto.randomUUID(), reusableId = crypto.randomUUID(), moduleId = crypto.randomUUID()
project.dataSources.push({ id: sourceId, name: 'Items', provider: 'indexeddb', collection: 'items', schema: { id: 'string', text: 'string', date: 'datetime' }, capabilities: ['get', 'query', 'insert', 'update', 'delete', 'subscribe'], secretStrategy: 'none' })
list.binding = { sourceId, state: 'data' }
project.codeModules.push({ id: moduleId, name: 'Maiuscolo', description: '', inputType: 'string', outputType: 'string', operation: 'uppercase', config: {}, tests: [{ id: crypto.randomUUID(), input: 'canva', expected: 'CANVA' }] })
project.flows.push({ id: reusableId, name: 'Format item', nodes: [
  { id: 'reuse-event', type: 'event', label: 'Input', position: { x: 0, y: 0 }, config: { trigger: 'manual' } },
  { id: 'reuse-module', type: 'module', label: 'Uppercase', position: { x: 1, y: 0 }, config: { moduleId } },
  { id: 'reuse-format', type: 'format', label: 'Label', position: { x: 2, y: 0 }, config: { template: 'Done: {{value}}' } },
], edges: [
  { id: 'reuse-1', source: 'reuse-event', target: 'reuse-module', path: 'success' },
  { id: 'reuse-2', source: 'reuse-module', target: 'reuse-format', path: 'success' },
] })
project.flows.push({ id: flowId, name: 'Crea attività', nodes: [
  { id: 'event', type: 'event', label: 'Click', position: { x: 0, y: 0 }, config: { componentId: button.id } },
  { id: 'read', type: 'readInput', label: 'Leggi', position: { x: 1, y: 0 }, config: { componentId: input.id } },
  { id: 'validate', type: 'validate', label: 'Obbligatorio', position: { x: 2, y: 0 }, config: { message: 'Il valore è obbligatorio' } },
  { id: 'module', type: 'runFlow', label: 'Format item', position: { x: 3, y: 0 }, config: { flowId: reusableId } },
  { id: 'format', type: 'format', label: 'Etichetta', position: { x: 4, y: 0 }, config: { template: '✓ {{value}}' } },
  { id: 'insert', type: 'insert', label: 'Crea', position: { x: 5, y: 0 }, config: { sourceId } },
  { id: 'refresh', type: 'refresh', label: 'Aggiorna', position: { x: 6, y: 0 }, config: { componentId: list.id } },
], edges: [
  { id: '1', source: 'event', target: 'read', path: 'success' }, { id: '2', source: 'read', target: 'validate', path: 'success' },
  { id: '3', source: 'validate', target: 'module', path: 'success' }, { id: '4', source: 'module', target: 'format', path: 'success' },
  { id: '5', source: 'format', target: 'insert', path: 'success' }, { id: '6', source: 'insert', target: 'refresh', path: 'success' },
] })
button.events.click = flowId

const target = resolve('generated-app')
await rm(target, { recursive: true, force: true })
for (const [path, contents] of Object.entries(generateFiles(project))) {
  const file = resolve(target, path)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, contents, 'utf8')
}
