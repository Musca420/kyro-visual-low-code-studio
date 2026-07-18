const { createHash, verify } = require("node:crypto");

const channels = new Set(["stable", "beta", "nightly"]);
const platforms = new Set(["win32", "darwin", "linux"]);
const arches = new Set(["x64", "arm64"]);
const artifactExtensions = [".exe", ".dmg", ".zip", ".deb", ".rpm", ".appimage", ".nupkg"];

function versionParts(value) {
  if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error(`Versione aggiornamento non valida: ${value}`);
  return value.split(".").map(Number);
}

function compareVersions(left, right) {
  const a = versionParts(left), b = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function signedPayload(manifest) {
  return JSON.stringify({
    version: manifest.version,
    channel: manifest.channel,
    publishedAt: manifest.publishedAt,
    platform: manifest.platform,
    arch: manifest.arch,
    url: manifest.url,
    sha256: manifest.sha256,
    size: manifest.size,
  });
}

function verifyUpdateManifest(manifest, options) {
  if (!manifest || typeof manifest !== "object") throw new Error("Manifest aggiornamento assente");
  versionParts(String(manifest.version));
  if (!channels.has(manifest.channel)) throw new Error("Canale aggiornamento non valido");
  if (!platforms.has(manifest.platform) || !arches.has(manifest.arch)) throw new Error("Piattaforma aggiornamento non valida");
  if (manifest.channel !== options.channel) throw new Error(`Canale inatteso: ${manifest.channel}`);
  if (manifest.platform !== options.platform || manifest.arch !== options.arch) throw new Error("Artefatto destinato a un'altra piattaforma");
  if (compareVersions(manifest.version, options.currentVersion) <= 0) throw new Error("Aggiornamento obsoleto o downgrade rifiutato");
  const publishedAt = Date.parse(manifest.publishedAt);
  if (!Number.isFinite(publishedAt) || publishedAt > (options.now ?? Date.now()) + 300_000) throw new Error("Data pubblicazione non valida");
  const url = new URL(manifest.url);
  if (url.protocol !== "https:") throw new Error("Gli aggiornamenti richiedono HTTPS");
  if (!artifactExtensions.some((extension) => url.pathname.toLowerCase().endsWith(extension))) throw new Error("Tipo artefatto non consentito");
  if (!/^[a-f0-9]{64}$/.test(manifest.sha256) || !Number.isSafeInteger(manifest.size) || manifest.size <= 0 || manifest.size > 250_000_000) throw new Error("Metadati artefatto non validi");
  if (typeof manifest.signature !== "string" || !manifest.signature) throw new Error("Firma aggiornamento assente");
  const valid = verify(
    null,
    Buffer.from(signedPayload(manifest)),
    options.publicKey,
    Buffer.from(manifest.signature, "base64"),
  );
  if (!valid) throw new Error("Firma aggiornamento non valida");
  return Object.freeze({ ...manifest });
}

function verifyUpdateArtifact(bytes, manifest) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.length !== manifest.size) throw new Error("Dimensione artefatto diversa dal manifest");
  const digest = createHash("sha256").update(buffer).digest("hex");
  if (digest !== manifest.sha256) throw new Error("Hash artefatto non valido");
  return true;
}

module.exports = { compareVersions, signedPayload, verifyUpdateArtifact, verifyUpdateManifest };
