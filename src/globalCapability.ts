import { z } from "zod";
import { capabilityContractSchema, capabilityEffectSchema, capabilityEvidenceSchema, capabilityMigrationSchema, capabilityPlatformSchema, nextMinorVersion, type CapabilityEvidence } from "./capabilityContract";

export const capabilityProposalSchema = z.object({
  scope: z.literal("global"),
  kind: z.enum(["reusable_flow", "typed_module", "plugin"]),
  name: z.string().trim().min(3).max(80),
  generalizedIntent: z.string().trim().min(8).max(1_000),
  inputs: z.array(z.string().trim().min(1).max(80)).max(24),
  outputs: z.array(z.string().trim().min(1).max(80)).max(24),
  permissions: z.array(z.string().trim().min(1).max(80)).max(24),
  dependencies: z.array(z.string().trim().min(1).max(160)).max(24),
  validationTests: z.array(z.string().trim().min(1).max(240)).min(1).max(24),
  activation: z.enum(["passing_tests", "explicit_review"]),
  effects: z.array(capabilityEffectSchema).max(8).default([]),
  platforms: z.array(capabilityPlatformSchema).min(1).max(5).default(["web"]),
});

export type CapabilityProposal = z.infer<typeof capabilityProposalSchema>;

const globalCapabilityRecordSchema = capabilityProposalSchema.extend({
  id: z.string().uuid(),
  capabilityId: z.string().min(1).max(160),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  state: z.enum(["draft", "testing", "active", "deprecated", "blocked", "rejected"]),
  statusReason: z.string().max(500).default(""),
  contract: capabilityContractSchema,
  evidence: z.array(capabilityEvidenceSchema).max(100).default([]),
  migrations: z.array(capabilityMigrationSchema).max(50).default([]),
  previousVersion: z.string().regex(/^\d+\.\d+\.\d+$/).nullable().default(null),
  sourceJobId: z.string().min(1),
  sourcePrompt: z.string().min(1).max(8_000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const currentGlobalCapabilitySchema = globalCapabilityRecordSchema.superRefine((capability, context) => {
  if (capability.state !== "active") return;
  const passedChecks = new Set(capability.evidence.filter((item) => item.passed).map((item) => item.check));
  if (capability.contract.implementation.status !== "verified") context.addIssue({ code: "custom", path: ["contract", "implementation", "status"], message: "An active capability needs a verified implementation" });
  for (const check of capability.validationTests) if (!passedChecks.has(check)) context.addIssue({ code: "custom", path: ["evidence"], message: `Missing passing evidence: ${check}` });
  if (!capability.evidence.some((item) => item.kind === "runtime" && item.passed)) context.addIssue({ code: "custom", path: ["evidence"], message: "An active capability needs runtime evidence" });
  if (capability.activation === "explicit_review" && !capability.evidence.some((item) => item.kind === "approval" && item.passed)) context.addIssue({ code: "custom", path: ["evidence"], message: "An active capability needs approval evidence" });
});

const port = (name: string) => ({ name, type: "unknown" as const, required: true });
const legacyToCurrent = (value: unknown) => {
  if (!value || typeof value !== "object") return value;
  const item = value as Record<string, unknown>;
  if (item.contract) return value;
  const proposal = capabilityProposalSchema.safeParse(item);
  if (!proposal.success || typeof item.id !== "string" || typeof item.version !== "string") return value;
  const legacyState = String(item.state ?? "draft");
  const state = legacyState === "active" ? "blocked" : legacyState;
  return {
    ...item,
    ...proposal.data,
    capabilityId: item.id,
    state,
    statusReason: legacyState === "active" ? "Legacy activation requires contract verification" : "Migrated legacy capability",
    previousVersion: null,
    evidence: [],
    migrations: [],
    contract: {
      schemaVersion: 1,
      capabilityId: item.id,
      name: proposal.data.name,
      version: item.version,
      inputs: proposal.data.inputs.map(port),
      outputs: proposal.data.outputs.map(port),
      effects: proposal.data.effects,
      permissions: proposal.data.permissions,
      dependencies: proposal.data.dependencies.map((name) => ({ name, version: "unresolved", approvalRequired: true })),
      platforms: proposal.data.platforms,
      implementation: { kind: proposal.data.kind, reference: `pending:${item.id}`, version: item.version, status: "missing" },
    },
  };
};

export const globalCapabilitySchema = z.preprocess(legacyToCurrent, currentGlobalCapabilitySchema);
export type GlobalCapability = z.infer<typeof currentGlobalCapabilitySchema>;

export function createGlobalCapabilityVersion(proposalValue: CapabilityProposal, source: { jobId: string; prompt: string }, previous?: GlobalCapability): GlobalCapability {
  const proposal = capabilityProposalSchema.parse(proposalValue);
  const now = new Date().toISOString();
  const capabilityId = previous?.capabilityId ?? crypto.randomUUID();
  const version = previous ? nextMinorVersion(previous.version) : "0.1.0";
  return currentGlobalCapabilitySchema.parse({
    ...proposal,
    id: crypto.randomUUID(),
    capabilityId,
    version,
    state: "draft",
    statusReason: "Implementation and verification required",
    previousVersion: previous?.version ?? null,
    migrations: previous ? [{ fromVersion: previous.version, toVersion: version, strategy: "blocked", steps: ["Implement and verify the new contract before migrating projects"], rollbackVersion: previous.version }] : [],
    evidence: [],
    contract: {
      schemaVersion: 1,
      capabilityId,
      name: proposal.name,
      version,
      inputs: proposal.inputs.map(port),
      outputs: proposal.outputs.map(port),
      effects: proposal.effects,
      permissions: proposal.permissions,
      dependencies: proposal.dependencies.map((name) => ({ name, version: "unresolved", approvalRequired: true })),
      platforms: proposal.platforms,
      implementation: { kind: proposal.kind, reference: `pending:${capabilityId}`, version, status: "missing" },
    },
    sourceJobId: source.jobId,
    sourcePrompt: source.prompt,
    createdAt: now,
    updatedAt: now,
  });
}

export function capabilityActivationIssues(capability: GlobalCapability) {
  const passedChecks = new Set(capability.evidence.filter((item) => item.passed).map((item) => item.check));
  const issues = capability.validationTests.filter((check) => !passedChecks.has(check)).map((check) => `Missing passing evidence: ${check}`);
  if (capability.contract.implementation.status !== "verified") issues.push("Implementation is not verified");
  if (!capability.evidence.some((item) => item.kind === "runtime" && item.passed)) issues.push("Runtime evidence is required");
  if (capability.activation === "explicit_review" && !capability.evidence.some((item) => item.kind === "approval" && item.passed)) issues.push("Explicit approval evidence is required");
  return issues;
}

export function transitionGlobalCapability(capabilityValue: GlobalCapability, target: GlobalCapability["state"], evidence: CapabilityEvidence[] = []) {
  const capability = currentGlobalCapabilitySchema.parse({ ...capabilityValue, evidence: [...capabilityValue.evidence, ...evidence] });
  const allowed: Record<GlobalCapability["state"], GlobalCapability["state"][]> = {
    draft: ["testing", "rejected"], testing: ["active", "blocked", "rejected"], active: ["deprecated", "blocked"], deprecated: ["testing", "blocked"], blocked: ["testing", "rejected"], rejected: [],
  };
  if (!allowed[capability.state].includes(target)) throw new Error(`Capability cannot move from ${capability.state} to ${target}`);
  const issues = target === "active" ? capabilityActivationIssues(capability) : [];
  if (issues.length) throw new Error(issues.join("; "));
  return currentGlobalCapabilitySchema.parse({ ...capability, state: target, statusReason: target === "active" ? "Verified evidence passed" : `Lifecycle changed to ${target}`, updatedAt: new Date().toISOString() });
}

export function finalizeCapabilityMigration(capability: GlobalCapability, steps: string[]) {
  if (capability.state !== "active" || !capability.previousVersion) throw new Error("Only a verified active successor can finalize migration");
  if (!steps.length) throw new Error("Migration needs at least one reproducible step");
  return currentGlobalCapabilitySchema.parse({
    ...capability,
    migrations: [{ fromVersion: capability.previousVersion, toVersion: capability.version, strategy: "compatible", steps, rollbackVersion: capability.previousVersion }],
    updatedAt: new Date().toISOString(),
  });
}

export function capabilityRollbackTarget(versions: GlobalCapability[], current: GlobalCapability) {
  if (!current.previousVersion) throw new Error("This capability has no previous version");
  const target = versions.find((item) => item.capabilityId === current.capabilityId && item.version === current.previousVersion && ["active", "deprecated"].includes(item.state));
  if (!target) throw new Error(`Rollback version ${current.previousVersion} is unavailable`);
  return target;
}
