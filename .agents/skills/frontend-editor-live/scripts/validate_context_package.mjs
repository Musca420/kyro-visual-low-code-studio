import fs from 'node:fs'

const input = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : fs.readFileSync(0, 'utf8')
const value = JSON.parse(input)
const required = ['projectId', 'pageId', 'revision', 'componentId', 'componentType', 'treePath', 'bounds', 'properties', 'styles', 'events', 'dataSources', 'flows']
const missing = required.filter((key) => value[key] === undefined || value[key] === null)
if (missing.length) throw new Error(`Context package incompleto: ${missing.join(', ')}`)
if (!Number.isInteger(value.revision) || value.revision < 0) throw new Error('revision deve essere un intero non negativo')
if (!Array.isArray(value.treePath) || !value.treePath.length) throw new Error('treePath deve identificare il componente')
console.log(JSON.stringify({ valid: true, projectId: value.projectId, componentId: value.componentId, revision: value.revision }))
