import { operationDefinitions, type KyroOperationDomain } from "./agentRegistry";

type GraphState = Record<string, unknown>;

const domainTerms: Record<KyroOperationDomain, RegExp> = {
  app: /\b(page|screen|route|navigation|app|website|pwa|theme|auth|role|offline)\b/i,
  design: /\b(design|component|button|text|image|layout|column|color|font|spacing|responsive|animation|hover|focus)\b/i,
  actions: /\b(flow|action|click|tap|submit|condition|loop|state|toast|modal|gesture|validate)\b/i,
  data: /\b(data|database|record|crud|query|search|filter|sort|api|binding|persist)\b/i,
  extensions: /\b(plugin|package|sdk|native|camera|bluetooth|location|notification|payment|sensor|custom code)\b/i,
  publish: /\b(export|publish|android|apk|build|deploy|self-host)\b/i,
};

const transformTerms = /\b(transform|parse|format|normalize|convert|calculate|extract|map|aggregate)\b/i;
const externalTerms = /\b(payment|stripe|email|sms|cloud|oauth|sdk|package|plugin|camera|bluetooth|sensor|push notification)\b/i;
const words = (value: unknown) => new Set(String(value ?? "").toLocaleLowerCase().match(/[a-z0-9]{4,}/g) ?? []);

export type CapabilityResolution = ReturnType<typeof resolveCapability>;

export function resolveCapability(requestValue: unknown, state: GraphState = {}) {
  const request = String(requestValue ?? "").trim().slice(0, 4_000);
  const domains = (Object.entries(domainTerms) as [KyroOperationDomain, RegExp][])
    .filter(([, terms]) => terms.test(request))
    .map(([domain]) => domain);
  if (!domains.length) domains.push("actions");
  const operations = operationDefinitions
    .filter(([, domain]) => domains.includes(domain))
    .map(([type]) => type);
  const graphCapabilities = Array.isArray(state.capabilities) ? state.capabilities.slice(0, 24) : [];
  const requestWords = words(request);
  const globalCapabilities = (Array.isArray(state.globalCapabilities) ? state.globalCapabilities : [])
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter((item) => {
      const intentWords = words(item.generalizedIntent);
      return [...intentWords].filter((word) => requestWords.has(word)).length >= 2;
    })
    .slice(0, 8);
  const activeGlobal = globalCapabilities.find((item) => item.state === "active");
  const hasExternalBoundary = externalTerms.test(request);
  const prefersModule = !hasExternalBoundary && transformTerms.test(request);
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
    codexRequired: true,
    strategy,
    domains,
    registeredOperations: operations,
    graphCapabilities,
    globalCapabilities,
    fallback: {
      doesNotBlockOnMissingSkill: true,
      steps: [
        "Codex solves the request with the smallest available typed graph operations.",
        "If the graph cannot express it, Codex proposes a tested typed module.",
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
