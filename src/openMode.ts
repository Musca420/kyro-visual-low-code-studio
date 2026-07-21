import { z } from "zod";
import { testCodeModule, type CodeModule } from "./codeModules";
import { capabilityEvidenceSchema } from "./capabilityContract";
import { transitionGlobalCapability, type GlobalCapability } from "./globalCapability";
import type { VerificationReport } from "./verification";

const stageSchema = z.enum(["limitation", "resolution", "approval", "implementation", "verification", "registration", "completed", "failed"]);
const eventSchema = z.object({ stage: stageSchema, status: z.enum(["passed", "failed", "pending"]), detail: z.string().min(1), at: z.string().datetime() });

export const openModeSessionSchema = z.object({
  id: z.string().uuid(),
  capabilityRecordId: z.string().uuid(),
  capabilityId: z.string().min(1),
  projectId: z.string().min(1),
  stage: stageSchema,
  resolution: z.enum(["limitation", "local_module", "reviewed_plugin"]).nullable(),
  limitation: z.string().min(1),
  approvedDependency: z.object({ name: z.string().min(1), version: z.string().regex(/^\d+\.\d+\.\d+$/), license: z.string().min(1), risk: z.enum(["low", "medium", "high"]), rollback: z.string().min(1), platforms: z.array(z.enum(["web", "pwa", "android", "ios", "desktop"])).min(1) }).nullable(),
  events: z.array(eventSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type OpenModeSession = z.infer<typeof openModeSessionSchema>;

const moduleSchema = z.object({
  id: z.string(), name: z.string().min(1), description: z.string(),
  inputType: z.enum(["unknown", "string", "number", "record", "list"]), outputType: z.enum(["unknown", "string", "number", "record", "list"]),
  operation: z.enum(["trim", "uppercase", "lowercase", "template", "pick", "count"]), config: z.record(z.string(), z.string()),
  tests: z.array(z.object({ id: z.string(), input: z.string(), expected: z.string() })).min(1),
});

export const globalCapabilityImplementationSchema = z.object({
  id: z.string().min(1), capabilityId: z.string().min(1), capabilityVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  module: moduleSchema, transactionId: z.string().min(1), verification: z.object({ version: z.literal(1), status: z.literal("verified"), projectId: z.string(), baseRevision: z.number(), finalRevision: z.number().optional(), startedAt: z.string(), completedAt: z.string(), effects: z.array(z.string()), stages: z.array(z.unknown()) }),
});
export type GlobalCapabilityImplementation = z.infer<typeof globalCapabilityImplementationSchema>;

const event = (stage: OpenModeSession["stage"], status: "passed" | "failed" | "pending", detail: string) => ({ stage, status, detail, at: new Date().toISOString() });
const update = (session: OpenModeSession, patch: Partial<OpenModeSession>, nextEvent: ReturnType<typeof event>) => openModeSessionSchema.parse({ ...session, ...patch, events: [...session.events, nextEvent], updatedAt: nextEvent.at });

export function startOpenMode(capability: GlobalCapability, projectId: string) {
  const now = new Date().toISOString();
  const limitation = capability.kind === "plugin"
    ? "The visual graph cannot provide this external integration without a reviewed package and explicit approval."
    : capability.kind === "typed_module"
      ? "The visual graph cannot express this transformation yet. A confined typed module may resolve it without arbitrary code execution."
      : "The current registered nodes cannot express this reusable behavior. Kyro will not simulate it.";
  return openModeSessionSchema.parse({ id: crypto.randomUUID(), capabilityRecordId: capability.id, capabilityId: capability.capabilityId, projectId, stage: "limitation", resolution: null, limitation, approvedDependency: null, events: [event("limitation", "passed", limitation)], createdAt: now, updatedAt: now });
}

export function chooseOpenModeResolution(session: OpenModeSession, resolution: OpenModeSession["resolution"]) {
  if (session.stage !== "limitation" || !resolution) throw new Error("Open Mode must record the limitation before choosing a resolution");
  const stage = resolution === "reviewed_plugin" ? "approval" : resolution === "local_module" ? "implementation" : "completed";
  return update(session, { resolution, stage }, event("resolution", "passed", resolution === "limitation" ? "The limitation is explicit; no success was simulated" : `Selected ${resolution.replace("_", " ")}`));
}

export function approveOpenModeDependency(session: OpenModeSession, approval: NonNullable<OpenModeSession["approvedDependency"]>) {
  if (session.stage !== "approval" || session.resolution !== "reviewed_plugin") throw new Error("Dependency approval is unavailable for this resolution");
  const exactPackageName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
  if (!exactPackageName.test(approval.name)) throw new Error("Use the exact package name, not a generic dependency description");
  return update(session, { approvedDependency: approval, stage: "implementation" }, event("approval", "passed", `Approved ${approval.name}@${approval.version}; no package has been installed yet`));
}

export function failOpenModeSession(session: OpenModeSession, detail: string) {
  return update(session, { stage: "failed" }, event("verification", "failed", detail));
}

async function hash(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyOpenModeModule(session: OpenModeSession, capability: GlobalCapability, module: CodeModule, transactionId: string, report: VerificationReport) {
  if (session.stage !== "implementation" || session.resolution !== "local_module") throw new Error("A local module implementation was not selected");
  if (capability.id !== session.capabilityRecordId || report.projectId !== session.projectId) throw new Error("Open Mode verification scope does not match the capability and project");
  const results = testCodeModule(module);
  const failure = results.find((result) => !result.passed);
  const implementedSession = update(session, { stage: "verification" }, event("implementation", report.status === "verified" ? "passed" : "failed", `Module ${module.name} was submitted through Transaction ${transactionId}`));
  if (failure || report.status !== "verified" || results.length < capability.validationTests.length) {
    const detail = failure ? `Module test failed: ${failure.actual}` : report.status !== "verified" ? "The project transaction was not verified" : `The module has ${results.length} tests but the capability requires ${capability.validationTests.length}`;
    return { session: update(implementedSession, { stage: "failed" }, event("verification", "failed", detail)), capability, implementation: null };
  }
  const createdAt = new Date().toISOString();
  const verifiedReport = { ...report, status: "verified" as const };
  const evidence = await Promise.all([
    ...capability.validationTests.map(async (check, index) => capabilityEvidenceSchema.parse({ id: crypto.randomUUID(), kind: "test", check, passed: true, hash: await hash({ module, result: results[index] }), createdAt })),
    capabilityEvidenceSchema.parse({ id: crypto.randomUUID(), kind: "runtime", check: `Transaction ${transactionId} verified the shared runtime`, passed: true, hash: await hash(verifiedReport), createdAt }),
  ]);
  const testing = capability.state === "testing" ? capability : transitionGlobalCapability(capability, "testing");
  const implemented = { ...testing, contract: { ...testing.contract, implementation: { kind: "typed_module" as const, reference: `global-module:${module.id}`, version: testing.version, status: "verified" as const } } };
  const active = transitionGlobalCapability(implemented, "active", evidence);
  const verified = update(implementedSession, { stage: "registration" }, event("verification", "passed", `${results.length} module tests and the shared Runtime passed`));
  const completed = update(verified, { stage: "completed" }, event("registration", "passed", `Activated ${active.name} v${active.version} with verified module ${module.name}`));
  return { session: completed, capability: active, implementation: { id: module.id, capabilityId: active.capabilityId, capabilityVersion: active.version, module, transactionId, verification: verifiedReport } };
}
