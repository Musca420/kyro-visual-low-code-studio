import type { EditorComponent, Project } from "./model";
import { nativeCapabilities, nativeCapability, nativeNodeIssue } from "./nativeCapabilities";

export type CapabilityIssue = {
  id: string;
  kind: "interaction" | "data" | "backend" | "authentication" | "storage" | "native" | "state";
  title: string;
  explanation: string;
  target: "flow" | "data" | "settings" | "codex";
  plan?: {
    requirements: string[];
    alternatives: string[];
    costNote: string;
    confirmationRequired: boolean;
  };
};

export type ComponentProgramView = {
  componentId: string;
  events: { event: string; flowId: string; flowName: string }[];
  dataSources: { id: string; name: string; provider: string }[];
  dependentFlows: { id: string; name: string }[];
  generatedFiles: string[];
  issues: CapabilityIssue[];
};

export type FlowNodeProgramView = {
  nodeId: string;
  nodeLabel: string;
  components: { id: string; name: string; type: string }[];
  dataSources: { id: string; name: string; provider: string }[];
  incoming: { id: string; label: string; path: string }[];
  outgoing: { id: string; label: string; path: string }[];
  generatedFiles: string[];
  errors: string[];
};

export type DataSourceProgramView = {
  sourceId: string;
  name: string;
  provider: string;
  collection: string;
  fields: { name: string; type: string }[];
  capabilities: string[];
  components: { id: string; name: string; type: string; pageId: string; pageName: string }[];
  flows: { id: string; name: string; nodes: string[] }[];
  generatedFiles: string[];
  warnings: string[];
};

export function inspectComponentProgram(
  project: Project,
  pageId: string,
  componentId: string,
): ComponentProgramView {
  const page = project.pages.find((item) => item.id === pageId);
  const component = page?.components.find((item) => item.id === componentId);
  if (!page || !component) throw new Error("Componente non trovato nel grafo");

  const events = Object.entries(component.events).flatMap(([event, flowId]) => {
    const flow = project.flows.find((item) => item.id === flowId);
    return flow ? [{ event, flowId, flowName: flow.name }] : [];
  });
  const dependentFlows = project.flows
    .filter(
      (flow) =>
        events.some((event) => event.flowId === flow.id) ||
        flow.nodes.some((node) => node.config.componentId === component.id),
    )
    .map(({ id, name }) => ({ id, name }));
  const dataSources = component.binding
    ? project.dataSources
        .filter((source) => source.id === component.binding?.sourceId)
        .map(({ id, name, provider }) => ({ id, name, provider }))
    : [];

  return {
    componentId,
    events,
    dataSources,
    dependentFlows,
    generatedFiles: generatedFiles(project, "component"),
    issues: resolveCapabilities(project, page.components, component),
  };
}

export function resolveCapabilities(
  project: Project,
  components: EditorComponent[],
  component: EditorComponent,
): CapabilityIssue[] {
  const issues: CapabilityIssue[] = [];
  const capabilityIds = new Set(component.intent.capabilityIds ?? []);
  const dataVisual = ["list", "table", "chart", "calendar"].includes(component.type);
  const interactive = ["button", "form", "upload"].includes(component.type);

  if (interactive && Object.keys(component.events).length === 0)
    issues.push({
      id: "interaction",
      kind: "interaction",
      title: "Action not connected yet",
      explanation: "The element can be pressed, but it does not start a flow yet.",
      target: "flow",
    });
  if ((dataVisual || component.intent.entity) && !component.binding)
    issues.push({
      id: "data-binding",
      kind: "data",
      title: "Data not connected",
      explanation: project.dataSources.length
        ? "Choose an existing source or create a new one and connect this element."
        : "Displaying data requires a source. Store it on the device, connect a service, or generate a backend.",
      target: "data",
    });
  if (component.type === "upload" && project.dataSources.every((source) => source.provider !== "generated"))
    issues.push({
      id: "storage",
      kind: "storage",
      title: "File storage is required",
      explanation: "Uploads require storage or a backend; files must not be simulated only in the browser.",
      target: "codex",
      plan: {
        requirements: ["Choose where files are stored", "Define size, formats, and permissions", "Keep any keys only in the backend"],
        alternatives: ["Small files in the local project", "Included self-hosted backend", "External storage service already used by the team"],
        costNote: "Local storage has no service fee; external storage may charge for space and traffic.",
        confirmationRequired: true,
      },
    });
  if (capabilityIds.has("authentication.user") && project.appConfig.authentication.mode === "none")
    issues.push({
      id: "authentication",
      kind: "authentication",
      title: "User access is not configured",
      explanation: "Choose managed access or connect the identity provider already used by the project.",
      target: "settings",
      plan: {
        requirements: ["Choose email/password or external identity", "Define roles and protected pages", "Configure domain and callback for an external service"],
        alternatives: ["Access included in the generated backend", "Existing OIDC provider", "No accounts: local data only"],
        costNote: "The included backend is self-hosted; an external provider may have free tiers and per-user costs.",
        confirmationRequired: true,
      },
    });
  if (capabilityIds.has("payments.checkout"))
    issues.push({
      id: "payment-provider",
      kind: "backend",
      title: "Payment provider required",
      explanation: "Payments and secrets require an external service and secure server-side operations.",
      target: "codex",
      plan: {
        requirements: ["Account with the chosen provider", "Public key in the client and secret only in the backend", "HTTPS webhook to confirm the result"],
        alternatives: ["Hosted payment link: simplest path", "Embedded checkout with generated backend", "Demo mode without real charges"],
        costNote: "Kyro does not charge fees, but the provider may charge commissions and require identity verification.",
        confirmationRequired: true,
      },
    });
  if (
    (capabilityIds.has("notifications.local") || capabilityIds.has("notifications.push")) &&
    project.exportConfig.target === "android" &&
    !project.exportConfig.android?.permissions.includes("POST_NOTIFICATIONS")
  )
    issues.push({
      id: "notification-permission",
      kind: "native",
      title: "Android permission missing",
      explanation: "Android notifications require POST_NOTIFICATIONS and a clear permission request.",
      target: "settings",
      plan: {
        requirements: ["Declare the Android permission", "Explain why it is needed", "Choose local or push notifications"],
        alternatives: ["Local notifications on the device", "Push through an external service", "In-app alerts without permission"],
        costNote: "Local notifications need no service; push may require an account and external infrastructure.",
        confirmationRequired: true,
      },
    });
  const connectedFlowIds = new Set(Object.values(component.events));
  const connectedNodes = project.flows.filter((flow) => connectedFlowIds.has(flow.id)).flatMap((flow) => flow.nodes);
  for (const requested of component.intent.permissions) {
    const capability = nativeCapability(requested) ?? nativeCapabilities.find((item) => item.permissions.includes(requested));
    const configured = connectedNodes.some((node) => node.type === "nativeAction" && node.config.capability === capability?.id);
    if (capability && !configured) issues.push({
      id: `native-${capability.id}`,
      kind: "native",
      title: `${capability.label} is not connected`,
      explanation: `${component.name} declares that it needs ${capability.label}, but its actions do not contain the required device node yet.`,
      target: "flow",
      plan: {
        requirements: [...capability.permissions.map((permission) => `Permission: ${permission}`), ...Object.keys(capability.packages).map((dependency) => `Extension: ${dependency}`)],
        alternatives: capability.platforms.includes("web") ? ["Use the supported web API", "Use the Android device capability", "Remove this requirement"] : ["Use the Android device capability", "Remove this requirement"],
        costNote: capability.externalApproval ? "This uses a community extension. Kyro will review and ask before installing it." : "This capability has no Kyro fee; external services may have their own terms.",
        confirmationRequired: capability.externalApproval,
      },
    });
  }
  for (const state of component.intent.requiredStates) {
    const types: Record<typeof state, EditorComponent["type"][]> = {
      loading: ["loader", "skeleton"],
      success: ["toast", "alert"],
      error: ["alert", "toast"],
    };
    if (!components.some((item) => types[state].includes(item.type)))
      issues.push({
        id: `state-${state}`,
        kind: "state",
        title: `${state[0].toUpperCase()}${state.slice(1)} state is not represented`,
        explanation: `The intent requires a ${state} state, but this page does not yet contain a suitable visual element.`,
        target: "codex",
      });
  }
  return issues;
}

export function inspectFlowNodeProgram(
  project: Project,
  flowId: string,
  nodeId: string,
): FlowNodeProgramView {
  const flow = project.flows.find((item) => item.id === flowId);
  const node = flow?.nodes.find((item) => item.id === nodeId);
  if (!flow || !node) throw new Error("Nodo non trovato nel grafo");
  const componentIds = new Set<string>();
  if (node.config.componentId) componentIds.add(node.config.componentId);
  if (node.type === "event")
    for (const component of project.pages.flatMap((page) => page.components))
      if (Object.values(component.events).includes(flow.id)) componentIds.add(component.id);
  const sourceIds = new Set<string>();
  if (node.config.sourceId) sourceIds.add(node.config.sourceId);
  const linkedSource = project.dataSources.find((source) => sourceIds.has(source.id));
  if (linkedSource)
    for (const component of project.pages.flatMap((page) => page.components))
      if (component.binding?.sourceId === linkedSource.id) componentIds.add(component.id);
  const errors: string[] = [];
  if (["event", "readInput", "refresh"].includes(node.type) && !node.config.componentId)
    errors.push("Choose the component used by this node.");
  if (["insert", "query", "update", "delete"].includes(node.type) && !node.config.sourceId)
    errors.push("Choose the data source used by this node.");
  if (node.type === "validate" && !node.config.message)
    errors.push("Scrivi il messaggio mostrato quando la validazione fallisce.");
  if (node.type === "module" && !node.config.moduleId)
    errors.push("Choose or create the protected module run by this node.");
  if (node.type === "runFlow" && (!node.config.flowId || node.config.flowId === flow.id || !project.flows.some((item) => item.id === node.config.flowId)))
    errors.push("Choose another existing flow to reuse.");
  if (node.type === "http" && !node.config.url)
    errors.push("Inserisci l'indirizzo HTTP o HTTPS del servizio.");
  const nativeIssue = nativeNodeIssue(node);
  if (nativeIssue) errors.push(nativeIssue);
  if (node.type === "requestPermission" && !node.config.permission)
    errors.push("Choose the permission to request.");
  if (node.type === "platformCondition" && !node.config.platform)
    errors.push("Choose a platform for this condition.");
  const nodeById = (id: string) => flow.nodes.find((item) => item.id === id);
  return {
    nodeId,
    nodeLabel: node.label,
    components: project.pages
      .flatMap((page) => page.components)
      .filter((component) => componentIds.has(component.id))
      .map(({ id, name, type }) => ({ id, name, type })),
    dataSources: project.dataSources
      .filter((source) => sourceIds.has(source.id))
      .map(({ id, name, provider }) => ({ id, name, provider })),
    incoming: flow.edges
      .filter((edge) => edge.target === node.id)
      .flatMap((edge) => {
        const source = nodeById(edge.source);
        return source ? [{ id: source.id, label: source.label, path: edge.path }] : [];
      }),
    outgoing: flow.edges
      .filter((edge) => edge.source === node.id)
      .flatMap((edge) => {
        const target = nodeById(edge.target);
        return target ? [{ id: target.id, label: target.label, path: edge.path }] : [];
      }),
    generatedFiles: generatedFiles(project, "flow"),
    errors,
  };
}

export function inspectDataSourceProgram(
  project: Project,
  sourceId: string,
): DataSourceProgramView {
  const source = project.dataSources.find((item) => item.id === sourceId);
  if (!source) throw new Error("Source not found in the graph");
  const warnings: string[] = [];
  if (source.provider === "rest" && !source.environmentKey)
    warnings.push("Declare the variable name that will contain the API credential.");
  if (source.provider !== "indexeddb" && !source.endpoint)
    warnings.push("Configura l'indirizzo del servizio dati.");
  return {
    sourceId,
    name: source.name,
    provider: source.provider,
    collection: source.collection,
    fields: Object.entries(source.schema).map(([name, type]) => ({ name, type })),
    capabilities: source.capabilities,
    components: project.pages.flatMap((page) =>
      page.components
        .filter((component) => component.binding?.sourceId === source.id)
        .map(({ id, name, type }) => ({ id, name, type, pageId: page.id, pageName: page.name })),
    ),
    flows: project.flows.flatMap((flow) => {
      const nodes = flow.nodes.filter((node) => node.config.sourceId === source.id);
      return nodes.length ? [{ id: flow.id, name: flow.name, nodes: nodes.map((node) => node.label) }] : [];
    }),
    generatedFiles: generatedFiles(project, "data"),
    warnings,
  };
}

function generatedFiles(project: Project, origin: "component" | "flow" | "data") {
  const files = ["project.kyro.json", "project.frontend-editor.json", "src/main.ts"];
  if (origin === "component") files.push("src/style.css");
  if (origin !== "component" && project.dataSources.some((source) => source.provider === "generated"))
    files.push("server/index.mjs");
  if (origin === "flow")
    files.push(...project.codeModules.map((module) => `src/extensions/module-${module.id.replace(/[^a-z0-9-]/gi, "").slice(0, 36)}.ts`));
  return files;
}
