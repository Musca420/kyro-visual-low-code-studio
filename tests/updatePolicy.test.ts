import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { signedPayload, verifyUpdateArtifact, verifyUpdateManifest } = require('../electron/updatePolicy.cjs') as {
  signedPayload: (manifest: Record<string, unknown>) => string
  verifyUpdateArtifact: (bytes: Buffer, manifest: Record<string, unknown>) => boolean
  verifyUpdateManifest: (manifest: Record<string, unknown>, options: Record<string, unknown>) => Record<string, unknown>
}

function fixture() {
  const artifact = Buffer.from('frontend-editor-signed-update')
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const manifest: Record<string, unknown> = {
    version: '1.2.0', channel: 'stable', publishedAt: '2026-07-18T18:00:00.000Z',
    platform: 'win32', arch: 'x64', url: 'https://updates.example.test/FrontendEditor-1.2.0.exe',
    sha256: createHash('sha256').update(artifact).digest('hex'), size: artifact.length,
  }
  manifest.signature = sign(null, Buffer.from(signedPayload(manifest)), privateKey).toString('base64')
  return { artifact, manifest, publicKey: publicKey.export({ type: 'spki', format: 'pem' }) }
}

describe('secure desktop update policy', () => {
  it('accetta soltanto manifest firmato e artefatto con hash esatto', () => {
    const { artifact, manifest, publicKey } = fixture()
    const verified = verifyUpdateManifest(manifest, {
      currentVersion: '1.1.9', channel: 'stable', platform: 'win32', arch: 'x64',
      publicKey, now: Date.parse('2026-07-18T19:00:00.000Z'),
    })
    expect(verified.version).toBe('1.2.0')
    expect(verifyUpdateArtifact(artifact, verified)).toBe(true)
    expect(() => verifyUpdateArtifact(Buffer.from('tampered'), verified)).toThrow(/Dimensione|Hash/)
  })

  it('rifiuta firma alterata, canale errato e downgrade', () => {
    const { manifest, publicKey } = fixture()
    const options = { currentVersion: '1.1.9', channel: 'stable', platform: 'win32', arch: 'x64', publicKey, now: Date.parse('2026-07-18T19:00:00.000Z') }
    expect(() => verifyUpdateManifest({ ...manifest, size: Number(manifest.size) + 1 }, options)).toThrow('Firma aggiornamento non valida')
    expect(() => verifyUpdateManifest(manifest, { ...options, channel: 'beta' })).toThrow('Canale inatteso')
    expect(() => verifyUpdateManifest(manifest, { ...options, currentVersion: '1.2.0' })).toThrow('downgrade rifiutato')
  })
})
