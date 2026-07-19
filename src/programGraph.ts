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

const containsAny = (value: string, words: string[]) =>
  words.some((word) => value.toLocaleLowerCase().includes(word));

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
  const meaning = [
    component.intent.role,
    component.intent.action,
    component.intent.entity,
    component.intent.expectedResult,
  ].join(" ");
  const dataVisual = ["list", "table", "chart", "calendar"].includes(component.type);
  const interactive = ["button", "form", "upload"].includes(component.type);

  if (interactive && Object.keys(component.events).length === 0)
    issues.push({
      id: "interaction",
      kind: "interaction",
      title: "Azione non ancora collegata",
      explanation: "L'elemento può essere premuto, ma non avvia ancora alcun flow.",
      target: "flow",
    });
  if ((dataVisual || component.intent.entity) && !component.binding)
    issues.push({
      id: "data-binding",
      kind: "data",
      title: "Dati non collegati",
      explanation: project.dataSources.length
        ? "Scegli una sorgente esistente oppure creane una nuova e collega questo elemento."
        : "Per mostrare dati serve una sorgente. Puoi salvarli sul dispositivo, collegare un servizio o generare un backend.",
      target: "data",
    });
  if (component.type === "upload" && project.dataSources.every((source) => source.provider !== "generated"))
    issues.push({
      id: "storage",
      kind: "storage",
      title: "Spazio file da scegliere",
      explanation: "Il caricamento richiede uno storage o un backend: i file non devono essere simulati nel solo browser.",
      target: "codex",
      plan: {
        requirements: ["Scegliere dove conservare i file", "Definire dimensione, formati e permessi", "Tenere eventuali chiavi soltanto nel backend"],
        alternatives: ["File piccoli nel progetto locale", "Backend incluso e self-hosted", "Servizio storage esterno già usato dal team"],
        costNote: "La soluzione locale non ha costi di servizio; uno storage esterno può applicare costi per spazio e traffico.",
        confirmationRequired: true,
      },
    });
  if (containsAny(meaning, ["login", "accesso", "autentic"]) && project.appConfig.authentication.mode === "none")
    issues.push({
      id: "authentication",
      kind: "authentication",
      title: "Accesso utenti non configurato",
      explanation: "Scegli un accesso gestito oppure collega il provider di identità già usato dal progetto.",
      target: "settings",
      plan: {
        requirements: ["Scegliere email/password oppure identità esterna", "Definire ruoli e pagine protette", "Configurare dominio e callback per un servizio esterno"],
        alternatives: ["Accesso incluso nel backend generato", "Provider OIDC esistente", "Nessun account: dati soltanto locali"],
        costNote: "Il backend incluso è self-hosted; un provider esterno può avere soglie gratuite e costi per utente.",
        confirmationRequired: true,
      },
    });
  if (containsAny(meaning, ["pagamento", "payment", "checkout"]))
    issues.push({
      id: "payment-provider",
      kind: "backend",
      title: "Provider di pagamento necessario",
      explanation: "Pagamenti e segreti richiedono un servizio esterno e operazioni sicure lato server.",
      target: "codex",
      plan: {
        requirements: ["Account presso il provider scelto", "Chiave pubblica nel client e segreto soltanto nel backend", "Webhook HTTPS per confermare l'esito"],
        alternatives: ["Link di pagamento ospitato: percorso più semplice", "Checkout incorporato con backend generato", "Modalità demo senza addebiti reali"],
        costNote: "Frontend Editor non addebita costi, ma il provider può applicare commissioni e richiedere verifica dell'identità.",
        confirmationRequired: true,
      },
    });
  if (
    containsAny(meaning, ["notifica", "notification"]) &&
    project.exportConfig.target === "android" &&
    !project.exportConfig.android?.permissions.includes("POST_NOTIFICATIONS")
  )
    issues.push({
      id: "notification-permission",
      kind: "native",
      title: "Permesso Android mancante",
      explanation: "Le notifiche Android richiedono il permesso POST_NOTIFICATIONS e una richiesta comprensibile all'utente.",
      target: "settings",
      plan: {
        requirements: ["Dichiarare il permesso Android", "Spiegare all'utente perché serve", "Scegliere notifiche locali oppure push"],
        alternatives: ["Notifiche locali sul dispositivo", "Push tramite servizio esterno", "Avvisi interni all'app senza permesso"],
        costNote: "Le notifiche locali non richiedono un servizio; il push può richiedere account e infrastruttura esterna.",
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
        title: `Stato ${state} non rappresentato`,
        explanation: `L'intento richiede lo stato ${state}, ma nella pagina non esiste ancora un elemento visuale adatto.`,
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
    errors.push("Scegli il componente usato da questo nodo.");
  if (["insert", "query", "update", "delete"].includes(node.type) && !node.config.sourceId)
    errors.push("Scegli la sorgente dati usata da questo nodo.");
  if (node.type === "validate" && !node.config.message)
    errors.push("Scrivi il messaggio mostrato quando la validazione fallisce.");
  if (node.type === "module" && !node.config.moduleId)
    errors.push("Scegli o crea il modulo protetto eseguito da questo nodo.");
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
  if (!source) throw new Error("Sorgente non trovata nel grafo");
  const warnings: string[] = [];
  if (source.provider === "rest" && !source.environmentKey)
    warnings.push("Dichiara il nome della variabile che conterrà la credenziale API.");
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
