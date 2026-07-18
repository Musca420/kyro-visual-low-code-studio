// @vitest-environment node
/// <reference types="node" />
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { changedPaths, restoreWorkspace, snapshotWorkspace } from '../server/workspaceTransactions'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))) })

describe('workspace transaction', () => {
  it('restores changed, created and deleted files as one operation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'frontend-editor-')); roots.push(root)
    await writeFile(join(root, 'kept.txt'), 'before'); await writeFile(join(root, 'deleted.txt'), 'restore me')
    const before = await snapshotWorkspace(root)
    await writeFile(join(root, 'kept.txt'), 'after'); await writeFile(join(root, 'created.txt'), 'new'); await rm(join(root, 'deleted.txt'))
    const after = await snapshotWorkspace(root)
    expect(changedPaths(before, after).sort()).toEqual(['created.txt', 'deleted.txt', 'kept.txt'])
    await restoreWorkspace(root, before, after)
    await expect(readFile(join(root, 'kept.txt'), 'utf8')).resolves.toBe('before')
    await expect(readFile(join(root, 'deleted.txt'), 'utf8')).resolves.toBe('restore me')
    await expect(readFile(join(root, 'created.txt'))).rejects.toThrow()
  })

  it('refuses to overwrite edits made after the transaction', async () => {
    const root = await mkdtemp(join(tmpdir(), 'frontend-editor-')); roots.push(root)
    await writeFile(join(root, 'file.txt'), 'before'); const before = await snapshotWorkspace(root)
    await writeFile(join(root, 'file.txt'), 'agent'); const after = await snapshotWorkspace(root)
    await writeFile(join(root, 'file.txt'), 'user')
    await expect(restoreWorkspace(root, before, after)).rejects.toThrow(/modifiche successive/)
    await expect(readFile(join(root, 'file.txt'), 'utf8')).resolves.toBe('user')
  })
})
