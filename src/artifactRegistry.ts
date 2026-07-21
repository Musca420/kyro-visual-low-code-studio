import { z } from "zod";

export const artifactKindSchema = z.enum(["report", "screenshot", "trace", "build", "export"]);
export const artifactProvenanceSchema = z.object({
  actor: z.enum(["manual", "codex", "system"]),
  source: z.enum(["verification", "codex", "export", "build"]),
  revision: z.number().int().nonnegative(),
  jobId: z.string().min(1).optional(),
  transactionId: z.string().min(1).optional(),
  sourceId: z.string().min(1).optional(),
  phase: z.enum(["before", "after", "result"]).optional(),
});
export const artifactRecordSchema = z.object({
  version: z.literal(1),
  id: z.string().regex(/^artifact-[a-f0-9]{64}$/),
  projectId: z.string().min(1),
  kind: artifactKindSchema,
  name: z.string().min(1).max(240),
  mediaType: z.string().min(1).max(120),
  size: z.number().int().nonnegative().max(10_000_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  data: z.string().max(13_400_000),
  provenance: artifactProvenanceSchema,
  location: z.string().regex(/^indexeddb:artifacts\/artifact-[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
});

export type ArtifactRecord = z.infer<typeof artifactRecordSchema>;
export type ArtifactProvenance = z.infer<typeof artifactProvenanceSchema>;
export type ArtifactKind = z.infer<typeof artifactKindSchema>;

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
};
export const artifactBytes = (record: ArtifactRecord) => Uint8Array.from(atob(record.data), (character) => character.charCodeAt(0));

async function digest(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]))
  : value;

async function identity(projectId: string, kind: ArtifactKind, sha256: string, provenance: ArtifactProvenance) {
  return `artifact-${await digest(new TextEncoder().encode(JSON.stringify(canonical({ projectId, kind, sha256, provenance }))))}`;
}

export async function createArtifact(input: {
  projectId: string; kind: ArtifactKind; name: string; mediaType: string;
  payload: string | Uint8Array | Blob; provenance: ArtifactProvenance; createdAt?: string;
}): Promise<ArtifactRecord> {
  const bytes = typeof input.payload === "string" ? new TextEncoder().encode(input.payload) : input.payload instanceof Blob ? new Uint8Array(await input.payload.arrayBuffer()) : input.payload;
  if (bytes.byteLength > 10_000_000) throw new Error("Artifact exceeds the 10 MB local evidence limit");
  const sha256 = await digest(bytes), id = await identity(input.projectId, input.kind, sha256, input.provenance);
  return artifactRecordSchema.parse({
    version: 1, id, projectId: input.projectId, kind: input.kind, name: input.name,
    mediaType: input.mediaType, size: bytes.byteLength, sha256, data: bytesToBase64(bytes),
    provenance: input.provenance, location: `indexeddb:artifacts/${id}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}

export async function createScreenshotArtifact(input: Omit<Parameters<typeof createArtifact>[0], "kind" | "mediaType" | "payload"> & { dataUrl: string }) {
  const match = input.dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i);
  if (!match) throw new Error("Screenshot evidence must be a base64 image data URL");
  return createArtifact({ ...input, kind: "screenshot", mediaType: match[1], payload: Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0)) });
}

export async function verifyArtifact(input: ArtifactRecord) {
  const record = artifactRecordSchema.parse(input), bytes = artifactBytes(record), actualHash = await digest(bytes);
  const actualId = await identity(record.projectId, record.kind, actualHash, record.provenance);
  const issues = [actualHash !== record.sha256 ? "Content hash does not match" : "", actualId !== record.id ? "Provenance identity does not match" : "", record.size !== bytes.byteLength ? "Content size does not match" : ""].filter(Boolean);
  return { passed: issues.length === 0, actualHash, issues };
}
