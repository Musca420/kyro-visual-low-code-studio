/// <reference types="node" />
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'

export type WorkspaceSnapshot = Map<string, Buffer>

const ignored = new Set(['.git', '.kyro', 'node_modules', 'dist', 'artifacts', 'playwright-report', 'test-results'])

export async function snapshotWorkspace(root: string): Promise<WorkspaceSnapshot> {
  const snapshot: WorkspaceSnapshot = new Map()
  let bytes = 0
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) {
        const size = (await stat(path)).size
        if (size > 1_000_000 || bytes + size > 20_000_000) continue
        const content = await readFile(path); bytes += content.length
        snapshot.set(relative(root, path).split(sep).join('/'), content)
      }
    }
  }
  await visit(resolve(root))
  return snapshot
}

export function changedPaths(before: WorkspaceSnapshot, after: WorkspaceSnapshot): string[] {
  return [...new Set([...before.keys(), ...after.keys()])].filter((path) => !before.get(path)?.equals(after.get(path) ?? Buffer.alloc(0)) || !after.has(path))
}

export async function restoreWorkspace(root: string, before: WorkspaceSnapshot, after: WorkspaceSnapshot) {
  const paths = changedPaths(before, after)
  const current = await snapshotWorkspace(root)
  const conflicting = paths.filter((path) => {
    const expected = after.get(path), actual = current.get(path)
    return expected ? !actual?.equals(expected) : actual !== undefined
  })
  if (conflicting.length) throw new Error(`Ripristino fermato: modifiche successive in ${conflicting.join(', ')}`)
  const safeRoot = resolve(root)
  for (const name of paths) {
    const target = resolve(root, name)
    if (!target.startsWith(`${safeRoot}${sep}`)) throw new Error(`Percorso non sicuro: ${name}`)
    const content = before.get(name)
    if (content) { await mkdir(dirname(target), { recursive: true }); await writeFile(target, content) }
    else await rm(target, { force: true })
  }
  return paths
}
