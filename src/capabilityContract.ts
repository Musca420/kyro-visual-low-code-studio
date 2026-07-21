import { z } from "zod";

export const semanticVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
export const capabilityValueTypeSchema = z.enum(["unknown", "string", "number", "boolean", "record", "list", "file"]);
export const capabilityEffectSchema = z.enum(["ui", "state", "data", "network", "filesystem", "native", "dependency", "secrets"]);
export const capabilityPlatformSchema = z.enum(["web", "pwa", "android", "ios", "desktop"]);

const portSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: capabilityValueTypeSchema,
  required: z.boolean().default(true),
});

const dependencySchema = z.object({
  name: z.string().trim().min(1).max(160),
  version: z.string().trim().min(1).max(80),
  approvalRequired: z.boolean(),
});

export const capabilityContractSchema = z.object({
  schemaVersion: z.literal(1),
  capabilityId: z.string().min(1).max(160),
  name: z.string().trim().min(3).max(80),
  version: semanticVersionSchema,
  inputs: z.array(portSchema).max(24),
  outputs: z.array(portSchema).max(24),
  effects: z.array(capabilityEffectSchema).max(8),
  permissions: z.array(z.string().trim().min(1).max(80)).max(24),
  dependencies: z.array(dependencySchema).max(24),
  platforms: z.array(capabilityPlatformSchema).min(1).max(5),
  implementation: z.object({
    kind: z.enum(["reusable_flow", "typed_module", "plugin", "native_adapter"]),
    reference: z.string().trim().min(1).max(240),
    version: semanticVersionSchema,
    status: z.enum(["missing", "testing", "verified", "blocked"]),
  }),
});

export const capabilityEvidenceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["test", "runtime", "visual", "build", "security", "approval"]),
  check: z.string().trim().min(1).max(240),
  passed: z.boolean(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
});

export const capabilityMigrationSchema = z.object({
  fromVersion: semanticVersionSchema,
  toVersion: semanticVersionSchema,
  strategy: z.enum(["compatible", "manual", "blocked"]),
  steps: z.array(z.string().trim().min(1).max(240)).max(24),
  rollbackVersion: semanticVersionSchema,
});

export type CapabilityContract = z.infer<typeof capabilityContractSchema>;
export type CapabilityEvidence = z.infer<typeof capabilityEvidenceSchema>;
export type CapabilityMigration = z.infer<typeof capabilityMigrationSchema>;

export function compareSemanticVersions(left: string, right: string) {
  const a = semanticVersionSchema.parse(left).split(".").map(Number);
  const b = semanticVersionSchema.parse(right).split(".").map(Number);
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

export function nextMinorVersion(version: string) {
  const [major, minor] = semanticVersionSchema.parse(version).split(".").map(Number);
  return `${major}.${minor + 1}.0`;
}
