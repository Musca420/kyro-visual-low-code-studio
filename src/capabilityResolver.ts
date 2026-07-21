import { operationCatalog, operationDefinitions, operationEntries, operationNameSet, operationPlatforms, type KyroOperationPlatform, type KyroOperationType, type OperationEffect } from "./agentRegistry";
import { capabilityProposalJsonSchema, globalCapabilitySchema } from "./globalCapability";

type GraphState = Record<string, unknown>;
type Requirement = { kind: "operation" | "capability" | "effect"; id: string };
type MissingRequirement = Requirement & { reason: string };
type BlockedRequirement = Requirement & { reason: string };

const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const platformSet = new Set<string>(operationPlatforms);
const registeredEffects = ["ui", "state", "data", "network", "filesystem", "native", "dependency"] satisfies OperationEffect[];
const effectSet = new Set<string>(registeredEffects);

function parseRequirements(value: unknown): Requirement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const candidate = object(item), kind = candidate.kind, id = String(candidate.id ?? "").trim();
    return (["operation", "capability", "effect"].includes(String(kind)) && id) ? [{ kind: kind as Requirement["kind"], id }] : [];
  }).slice(0, 50);
}

export type CapabilityResolution = ReturnType<typeof resolveCapability>;

export function resolveCapability(requestValue: unknown, state: GraphState = {}) {
  const input = typeof requestValue === "string" ? { request: requestValue } : object(requestValue);
  const request = String(input.request ?? "").trim().slice(0, 4_000);
  const requirements = parseRequirements(input.requirements);
  const targetPlatforms = (Array.isArray(input.targetPlatforms) ? input.targetPlatforms : [])
    .map(String).filter((platform): platform is KyroOperationPlatform => platformSet.has(platform));
  const uniquePlatforms = [...new Set(targetPlatforms)].slice(0, operationPlatforms.length);
  const graphCapabilities = Array.isArray(state.capabilities) ? state.capabilities.slice(0, 24) : [];
  const globalCapabilities = (Array.isArray(state.globalCapabilities) ? state.globalCapabilities : [])
    .map((item) => globalCapabilitySchema.safeParse(item)).filter((item) => item.success).map((item) => item.data).slice(0, 24);
  const selectedOperations: KyroOperationType[] = [];
  const supportedRequirements: Requirement[] = [];
  const missingRequirements: MissingRequirement[] = [];
  const blockedRequirements: BlockedRequirement[] = [];

  if (!requirements.length || !uniquePlatforms.length) {
    return result("unknown" as const, "insufficient_typed_context", "Typed requirements and target platforms are required");
  }

  for (const requirement of requirements.filter((item) => item.kind === "operation")) {
    if (!operationNameSet.has(requirement.id)) {
      missingRequirements.push({ ...requirement, reason: "Operation is not registered" });
      continue;
    }
    const type = requirement.id as KyroOperationType, definition = operationDefinitions[type];
    if (["disabled", "deprecated"].includes(definition.support)) {
      blockedRequirements.push({ ...requirement, reason: `Operation support is ${definition.support}` });
      continue;
    }
    const missingPlatform = uniquePlatforms.find((platform) => !definition.platforms.includes(platform));
    if (missingPlatform) {
      blockedRequirements.push({ ...requirement, reason: `Operation does not support ${missingPlatform}` });
      continue;
    }
    supportedRequirements.push(requirement);
    if (!selectedOperations.includes(type)) selectedOperations.push(type);
  }

  for (const requirement of requirements.filter((item) => item.kind === "capability")) {
    const capability = globalCapabilities.find((item) => item.id === requirement.id || item.capabilityId === requirement.id);
    if (!capability) {
      missingRequirements.push({ ...requirement, reason: "Capability is not installed" });
      continue;
    }
    if (capability.state !== "active" || capability.contract.implementation.status !== "verified") {
      blockedRequirements.push({ ...requirement, reason: "Capability is not active with a verified implementation" });
      continue;
    }
    const missingPlatform = uniquePlatforms.find((platform) => !capability.contract.platforms.includes(platform));
    if (missingPlatform) {
      blockedRequirements.push({ ...requirement, reason: `Capability does not support ${missingPlatform}` });
      continue;
    }
    const unprovenPlatform = uniquePlatforms.find((platform) => !capability.evidence.some((evidence) => evidence.passed && evidence.kind === "runtime" && evidence.platform === platform && evidence.runtimeVersion && evidence.dependencyVersions && evidence.implementationHash));
    if (unprovenPlatform) {
      blockedRequirements.push({ ...requirement, reason: `Capability has no valid runtime evidence for ${unprovenPlatform}` });
      continue;
    }
    supportedRequirements.push(requirement);
  }

  for (const requirement of requirements.filter((item) => item.kind === "effect")) {
    if (!effectSet.has(requirement.id)) {
      missingRequirements.push({ ...requirement, reason: "Effect is not registered" });
      continue;
    }
    const covered = selectedOperations.some((type) => operationDefinitions[type].effects.includes(requirement.id as OperationEffect))
      || globalCapabilities.some((capability) => supportedRequirements.some((item) => item.kind === "capability" && (item.id === capability.id || item.id === capability.capabilityId)) && capability.contract.effects.includes(requirement.id as never));
    if (covered) supportedRequirements.push(requirement);
    else missingRequirements.push({ ...requirement, reason: "No selected operation or capability proves this effect" });
  }

  const unresolved = missingRequirements.length + blockedRequirements.length;
  const status = unresolved === 0
    ? (selectedOperations.length + supportedRequirements.filter((item) => item.kind === "capability").length > 1 ? "composable" : "supported")
    : supportedRequirements.length ? "partial" : "unsupported";
  return result(status, status === "supported" || status === "composable" ? "typed_registry" : "capability_gap", unresolved ? "Some typed requirements are unresolved" : "Every typed requirement is proven");

  function result(status: "supported" | "composable" | "partial" | "unsupported" | "unknown", strategy: string, explanation: string) {
    const requiredConfirmations = selectedOperations.filter((type) => operationDefinitions[type].confirmation);
    return {
      request, status, codexRequired: false, strategy, explanation, requirements, targetPlatforms: uniquePlatforms,
      supportedRequirements, missingRequirements, blockedRequirements, selectedOperations, requiredConfirmations,
      operationContracts: operationCatalog.filter((operation) => selectedOperations.includes(operation.name)),
      capabilityProposalContract: capabilityProposalJsonSchema,
      registeredOperations: operationEntries.map(([type]) => type), registeredEffects, graphCapabilities, globalCapabilities,
      fallback: { doesNotBlockOnMissingSkill: true, steps: ["Codex receives the explicit gap instead of a guessed route.", "Codex may compose registered operations, propose a typed module, or request review for an extension.", "Kyro validates the transaction, runtime and visual result before commit."] },
      learningCandidate: { state: "draft", generalizeFromIntent: true, activationRequiresPassingTests: true, installationRequiresApproval: true, rule: "Generalize the capability; never hard-code the current project, component ID or prompt." },
      verification: ["typed operation validation", "next graph revision", "runtime validation", "visual preview", "undo"],
    };
  }
}

export function proposalCoversCapabilityGap(resolution: CapabilityResolution, proposal?: { effects?: readonly string[] } | null) {
  const effects = new Set(proposal?.effects ?? []);
  return Boolean(proposal) && resolution.blockedRequirements.length === 0 && resolution.missingRequirements.every((item) => item.kind === "capability" || (item.kind === "effect" && effects.has(item.id)));
}
