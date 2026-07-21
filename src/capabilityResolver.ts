import { operationDefinitions, type KyroOperationDomain } from "./agentRegistry";
import { globalCapabilitySchema } from "./globalCapability";

type GraphState = Record<string, unknown>;

const domains = new Set<KyroOperationDomain>(operationDefinitions.map(([, domain]) => domain));
const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export type CapabilityResolution = ReturnType<typeof resolveCapability>;

export function resolveCapability(requestValue: unknown, state: GraphState = {}) {
  const input = typeof requestValue === "string" ? { request: requestValue } : object(requestValue);
  const request = String(input.request ?? "").trim().slice(0, 4_000);
  const selectedDomains = Array.isArray(input.domains)
    ? input.domains.filter((domain): domain is KyroOperationDomain => domains.has(domain as KyroOperationDomain))
    : [];
  if (!selectedDomains.length) selectedDomains.push(...domains);
  const capabilityIds = Array.isArray(input.capabilityIds) ? input.capabilityIds.map(String).slice(0, 24) : [];
  const operations = operationDefinitions
    .filter(([, domain]) => selectedDomains.includes(domain))
    .map(([type]) => type);
  const graphCapabilities = Array.isArray(state.capabilities) ? state.capabilities.slice(0, 24) : [];
  const globalCapabilities = (Array.isArray(state.globalCapabilities) ? state.globalCapabilities : [])
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => globalCapabilitySchema.safeParse(item))
    .filter((item) => item.success)
    .map((item) => item.data)
    .filter((item) => capabilityIds.includes(item.id) || capabilityIds.includes(item.capabilityId))
    .slice(0, 8);
  const activeGlobal = globalCapabilities.find((item) => item.state === "active" && item.contract.implementation.status === "verified");
  const hasExternalBoundary = input.requiresExternal === true;
  const prefersModule = !hasExternalBoundary && input.prefersModule === true;
  const strategy = activeGlobal
    ? "reuse_global_capability"
    : hasExternalBoundary
    ? "reviewed_extension"
    : prefersModule
      ? "tested_typed_module"
      : "compose_visual_graph";

  return {
    request,
    status: activeGlobal ? "resolvable" : hasExternalBoundary ? "extension_required" : operations.length ? "resolvable" : "extension_required",
    codexRequired: false,
    strategy,
    domains: selectedDomains,
    capabilityIds,
    registeredOperations: operations,
    graphCapabilities,
    globalCapabilities,
    fallback: {
      doesNotBlockOnMissingSkill: true,
      steps: [
        "Kyro composes the request with the smallest available typed graph operations.",
        "Codex may propose a tested typed module when the graph cannot express it.",
        "If external code is required, Codex prepares a reviewed extension proposal and asks before installing anything.",
        "Kyro validates the result against the graph, runtime and visual preview, then records one undoable transaction.",
      ],
    },
    learningCandidate: {
      kind: strategy === "compose_visual_graph" || strategy === "reuse_global_capability" ? "reusable_flow" : strategy === "tested_typed_module" ? "typed_module" : "plugin",
      state: "draft",
      generalizeFromIntent: true,
      activationRequiresPassingTests: true,
      installationRequiresApproval: strategy === "reviewed_extension",
      rule: "Generalize the capability, never hard-code the current app, component ID or user request.",
    },
    verification: ["typed operation validation", "next graph revision", "runtime validation", "visual preview", "undo"],
  };
}
