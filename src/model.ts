import { z } from "zod";

export const BREAKPOINTS = ["desktop", "tablet", "mobile"] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

const styleSchema = z.object({
  width: z.string().default("100%"),
  height: z.string().default("auto"),
  minWidth: z.string().default("0px"),
  maxWidth: z.string().default("none"),
  minHeight: z.string().default("44px"),
  maxHeight: z.string().default("none"),
  color: z.string().default("#172033"),
  background: z.string().default("#ffffff"),
  backgroundImage: z.string().default("none"),
  backgroundSize: z.string().default("cover"),
  backgroundPosition: z.string().default("center"),
  opacity: z.string().default("1"),
  borderWidth: z.string().default("0px"),
  borderStyle: z
    .enum(["none", "solid", "dashed", "dotted", "double"])
    .default("none"),
  borderColor: z.string().default("#d8dce6"),
  borderRadius: z.string().default("10px"),
  borderTopLeftRadius: z.string().default("10px"),
  borderTopRightRadius: z.string().default("10px"),
  borderBottomRightRadius: z.string().default("10px"),
  borderBottomLeftRadius: z.string().default("10px"),
  padding: z.string().default("12px"),
  paddingTop: z.string().default("12px"),
  paddingRight: z.string().default("12px"),
  paddingBottom: z.string().default("12px"),
  paddingLeft: z.string().default("12px"),
  fontSize: z.string().default("16px"),
  fontFamily: z.string().default("Inter, system-ui, sans-serif"),
  fontWeight: z.string().default("400"),
  lineHeight: z.string().default("1.5"),
  textAlign: z.enum(["left", "center", "right", "justify"]).default("left"),
  marginLeft: z.string().default("0px"),
  marginTop: z.string().default("0px"),
  marginRight: z.string().default("0px"),
  marginBottom: z.string().default("0px"),
  boxShadow: z.string().default("none"),
  display: z.enum(["block", "none", "flex", "grid"]).default("block"),
  flexDirection: z
    .enum(["row", "column", "row-reverse", "column-reverse"])
    .default("column"),
  flexWrap: z.enum(["nowrap", "wrap"]).default("nowrap"),
  alignItems: z
    .enum(["stretch", "flex-start", "center", "flex-end", "baseline"])
    .default("stretch"),
  justifyContent: z
    .enum([
      "flex-start",
      "center",
      "flex-end",
      "space-between",
      "space-around",
      "space-evenly",
    ])
    .default("flex-start"),
  gap: z.string().default("12px"),
  gridTemplateColumns: z.string().default("1fr"),
  position: z
    .enum(["static", "relative", "absolute", "sticky", "fixed"])
    .default("static"),
  top: z.string().default("auto"),
  right: z.string().default("auto"),
  bottom: z.string().default("auto"),
  left: z.string().default("auto"),
  zIndex: z.string().default("auto"),
  overflow: z
    .enum(["visible", "hidden", "auto", "scroll", "clip"])
    .default("visible"),
  aspectRatio: z.string().default("auto"),
  cursor: z
    .enum(["auto", "default", "pointer", "text", "move", "not-allowed", "grab"])
    .default("auto"),
  filter: z.string().default("none"),
  backdropFilter: z.string().default("none"),
  transform: z.string().default("none"),
  transformOrigin: z.string().default("center"),
  transition: z.string().default("all 180ms ease"),
  animation: z.string().default("none"),
});

export const componentTypes = [
  "container",
  "stack",
  "grid",
  "spacer",
  "text",
  "title",
  "link",
  "image",
  "icon",
  "button",
  "input",
  "textarea",
  "select",
  "checkbox",
  "radio",
  "form",
  "card",
  "list",
  "table",
  "navbar",
  "tabs",
  "modal",
  "loader",
  "empty",
  "alert",
  "toast",
  "header",
  "sidebar",
  "hero",
  "footer",
  "section",
  "carousel",
  "gallery",
  "menu",
  "breadcrumb",
  "accordion",
  "drawer",
  "tooltip",
  "pagination",
  "upload",
  "signature",
  "avatar",
  "badge",
  "progress",
  "skeleton",
  "chart",
  "calendar",
  "map",
  "audio",
  "video",
  "reusable",
] as const;
export const containerTypes = [
  "container",
  "stack",
  "grid",
  "form",
  "card",
  "navbar",
  "tabs",
  "modal",
  "header",
  "sidebar",
  "hero",
  "footer",
  "section",
  "carousel",
  "gallery",
  "menu",
  "accordion",
  "drawer",
  "reusable",
] as const;

export const componentSchema = z.object({
  id: z.string().min(1),
  type: z.enum(componentTypes),
  name: z.string().min(1),
  parentId: z.string().min(1).optional(),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  styles: z.object({
    desktop: styleSchema,
    tablet: styleSchema.partial(),
    mobile: styleSchema.partial(),
  }),
  states: z
    .object({
      hover: z.record(z.string(), z.string()),
      focus: z.record(z.string(), z.string()),
      active: z.record(z.string(), z.string()),
      disabled: z.record(z.string(), z.string()),
    })
    .default({ hover: {}, focus: {}, active: {}, disabled: {} }),
  events: z.record(z.string(), z.string()),
  binding: z
    .object({
      sourceId: z.string(),
      state: z.enum(["data", "loading", "empty", "error"]),
    })
    .optional(),
  accessibility: z.object({ label: z.string(), role: z.string().optional() }),
  intent: z
    .object({
      role: z.string().default(""),
      action: z.string().default(""),
      entity: z.string().default(""),
      expectedResult: z.string().default(""),
      requiredStates: z
        .array(z.enum(["loading", "success", "error"]))
        .default([]),
      permissions: z.array(z.string()).default([]),
      capabilityIds: z.array(z.string()).optional(),
    })
    .default({
      role: "",
      action: "",
      entity: "",
      expectedResult: "",
      requiredStates: [],
      permissions: [],
    }),
});

export type EditorComponent = z.infer<typeof componentSchema>;

export const reusableComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  components: z.array(componentSchema).min(1),
  exposedProperties: z.array(z.object({
    componentId: z.string().min(1),
    property: z.literal("label"),
    label: z.string().min(1),
  })).default([]),
});

export type ReusableComponent = z.infer<typeof reusableComponentSchema>;

export const flowNodeTypes = [
  "event",
  "readInput",
  "validate",
  "condition",
  "switch",
  "loop",
  "getState",
  "setState",
  "resetState",
  "delay",
  "debounce",
  "format",
  "map",
  "http",
  "file",
  "requireRole",
  "signOut",
  "insert",
  "query",
  "update",
  "delete",
  "filter",
  "sort",
  "kpi",
  "refresh",
  "navigate",
  "openModal",
  "updateUI",
  "notify",
  "localNotification",
  "requestPermission",
  "nativeAction",
  "platformCondition",
  "runFlow",
  "module",
  "log",
] as const;
const nodeTypeSchema = z.enum(flowNodeTypes);

const nodeSchema = z.object({
  id: z.string(),
  type: nodeTypeSchema,
  label: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.string(), z.string()),
});

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  path: z.string().min(1).default("success"),
});

export const pluginContributionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("component"),
    id: z.string().regex(/^[a-z][a-z0-9.-]+$/),
    label: z.string().min(1),
    componentType: z.enum(componentTypes),
    props: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .default({}),
    styles: styleSchema.partial().default({}),
  }),
  z.object({
    kind: z.literal("node"),
    id: z.string().regex(/^[a-z][a-z0-9.-]+$/),
    label: z.string().min(1),
    nodeType: nodeTypeSchema,
    config: z.record(z.string(), z.string()).default({}),
  }),
  z.object({
    kind: z.literal("provider"),
    id: z.string().regex(/^[a-z][a-z0-9.-]+$/),
    label: z.string().min(1),
    endpoint: z.string().url(),
  }),
  z.object({
    kind: z.literal("theme"),
    id: z.string().regex(/^[a-z][a-z0-9.-]+$/),
    label: z.string().min(1),
    tokens: z.record(z.string(), z.string()),
  }),
]);

export type PluginContribution = z.infer<typeof pluginContributionSchema>;

export const pluginManifestSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9.-]+$/),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  author: z.string().min(1),
  compatibility: z.literal("1.x"),
  dependencies: z.array(z.string()).default([]),
  permissions: z
    .array(z.enum(["components", "flows", "data", "themes"]))
    .default([]),
  contributions: z
    .array(z.union([z.string(), pluginContributionSchema]))
    .default([]),
  configuration: z.record(z.string(), z.string()).default({}),
}).superRefine((manifest, context) => {
  const permissionFor = {
    component: "components",
    node: "flows",
    provider: "data",
    theme: "themes",
  } as const;
  manifest.contributions.forEach((contribution, index) => {
    if (typeof contribution === "string") return;
    const permission = permissionFor[contribution.kind];
    if (!manifest.permissions.includes(permission))
      context.addIssue({
        code: "custom",
        path: ["contributions", index],
        message: `Il contributo ${contribution.id} richiede il permesso ${permission}`,
      });
  });
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export const projectSchema = z.object({
  formatVersion: z.literal(1),
  id: z.string(),
  name: z.string().min(1),
  revision: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  pages: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      path: z.string(),
      components: z.array(componentSchema),
    }),
  ),
  reusableComponents: z.array(reusableComponentSchema).default([]),
  flows: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      nodes: z.array(nodeSchema),
      edges: z.array(edgeSchema),
    }),
  ),
  flowRuns: z.array(z.object({
    id: z.string(),
    flowId: z.string(),
    startedAt: z.string().datetime(),
    durationMs: z.number().nonnegative(),
    logs: z.array(z.object({
      nodeId: z.string(),
      level: z.enum(["info", "error"]),
      message: z.string(),
      durationMs: z.number().nonnegative(),
    })),
  })).max(20).default([]),
  state: z.record(z.string(), z.unknown()),
  dataSources: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      provider: z.enum(["indexeddb", "rest", "generated"]),
      collection: z.string(),
      schema: z.record(z.string(), z.enum(["string", "number", "boolean", "datetime"])),
      schemaVersion: z.number().int().positive().default(1).optional(),
      migrations: z.array(z.object({
        version: z.number().int().positive(),
        createdAt: z.string().datetime(),
        previousSchema: z.record(z.string(), z.enum(["string", "number", "boolean", "datetime"])),
        nextSchema: z.record(z.string(), z.enum(["string", "number", "boolean", "datetime"])),
      })).default([]).optional(),
      relations: z.array(z.object({
        id: z.string(),
        field: z.string(),
        targetSourceId: z.string(),
        targetField: z.string(),
        kind: z.enum(["one", "many"]),
      })).default([]).optional(),
      capabilities: z.array(
        z.enum(["get", "query", "insert", "update", "delete", "subscribe"]),
      ),
      secretStrategy: z.enum(["none", "environment"]),
      endpoint: z.string().url().optional(),
      environmentKey: z
        .string()
        .regex(/^[A-Z][A-Z0-9_]*$/)
        .optional(),
    }),
  ),
  theme: z.object({ tokens: z.record(z.string(), z.string()) }),
  animations: z.array(
    z.object({ id: z.string(), name: z.string(), css: z.string() }),
  ),
  assets: z.array(
    z.object({ id: z.string(), name: z.string(), url: z.string() }),
  ),
  codeModules: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      description: z.string().default(""),
      inputType: z.enum(["unknown", "string", "number", "record", "list"]),
      outputType: z.enum(["unknown", "string", "number", "record", "list"]),
      operation: z.enum(["trim", "uppercase", "lowercase", "template", "pick", "count"]),
      config: z.record(z.string(), z.string()).default({}),
      tests: z.array(z.object({ id: z.string(), input: z.string(), expected: z.string() })).default([]),
    }),
  ).default([]),
  appConfig: z
    .object({
      authentication: z.object({
        mode: z.enum(["none", "generated", "oidc"]),
        roles: z
          .array(z.string().trim().min(1).max(48).regex(/^[a-z][a-z0-9_-]*$/))
          .max(24),
        issuer: z.string().url().optional(),
        clientId: z.string().optional(),
      }),
      realtime: z.object({
        mode: z.enum(["none", "sse"]),
        url: z.string().url().optional(),
      }),
      offline: z.boolean(),
      themeMode: z.enum(["light", "dark", "system"]).optional(),
      supportedThemes: z.array(z.enum(["light", "dark"])).optional(),
      safeArea: z.boolean().optional(),
      mobileBottomNavigation: z.object({
        enabled: z.boolean(),
        items: z.array(z.object({ label: z.string(), path: z.string().startsWith("/") })),
      }).optional(),
      environmentVariables: z.array(
        z.object({
          name: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
          description: z.string(),
          required: z.boolean(),
        }),
      ),
    })
    .default({
      authentication: {
        mode: "none",
        roles: ["admin", "editor", "viewer"],
      },
      realtime: { mode: "none" },
      offline: false,
      environmentVariables: [],
    }),
  importedSource: z
    .object({
      originName: z.string().min(1),
      detected: z.string().min(1),
      importedAt: z.string().datetime(),
      exactModel: z.boolean(),
      warnings: z.array(z.string()),
      files: z
        .array(
          z.object({
            path: z.string().regex(/^(?![\\/])(?!.*\.\.)(?!.*[<>:|?*]).+$/),
            content: z.string(),
          }),
        )
        .max(250),
    })
    .optional(),
  plugins: z.array(
    z.object({ id: z.string(), version: z.string(), enabled: z.boolean() }),
  ),
  dependencies: z.record(z.string(), z.string()),
  extensionApprovals: z.array(z.object({
    packageName: z.string().regex(/^@[a-z0-9-]+\/[a-z0-9-]+$/),
    version: z.string().regex(/^[~^]?\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/),
    reason: z.string().min(1),
    license: z.string().min(1).default("MIT"),
    risk: z.enum(["low", "medium", "high"]).default("medium"),
    rollback: z.string().min(1).default("Revoke approval and rebuild the export"),
    platforms: z.array(z.enum(["web", "android", "ios"])).min(1).default(["android", "ios"]),
    approvedAt: z.string().datetime(),
  })).default([]),
  exportConfig: z.object({
    target: z.enum(["web", "pwa", "android"]).default("web"),
    capacitor: z.boolean().default(false),
    android: z
      .object({
        packageId: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
        appName: z.string().min(1),
        orientation: z.enum(["any", "portrait", "landscape"]),
        themeColor: z.string(),
        versionName: z.string(),
        versionCode: z.number().int().positive(),
        permissions: z.array(z.string()),
        statusBarStyle: z.enum(["light", "dark"]),
        keyboardResize: z.boolean(),
        backButton: z.boolean(),
      })
      .optional(),
  }),
});

export type Project = z.infer<typeof projectSchema>;
export type Flow = Project["flows"][number];
export type FlowNode = Flow["nodes"][number];

const baseStyle = {
  width: "100%",
  minHeight: "44px",
  color: "#172033",
  background: "#ffffff",
  borderRadius: "10px",
  padding: "12px",
  fontSize: "16px",
  display: "block" as const,
  marginLeft: "0px",
  marginTop: "0px",
  boxShadow: "none",
};

export function makeComponent(type: EditorComponent["type"]): EditorComponent {
  const label: Partial<Record<EditorComponent["type"], string>> = {
    input: "New task",
    button: "Add",
    list: "Tasks",
    title: "Title",
    text: "Testo",
    signature: "Signature",
  };
  const layout =
    type === "grid"
      ? { display: "grid" as const, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px" }
      : ["container", "stack"].includes(type)
        ? { display: "flex" as const, flexDirection: "column" as const, gap: "12px" }
        : {};
  return componentSchema.parse({
    id: crypto.randomUUID(),
    type,
    name: `${type[0].toUpperCase()}${type.slice(1)}`,
    props: {
      label: label[type] ?? type,
      placeholder: type === "input" ? "Type something…" : "",
    },
    styles: { desktop: { ...baseStyle, ...layout }, tablet: {}, mobile: { fontSize: "15px" } },
    events: {},
    accessibility: { label: label[type] ?? type },
  });
}

export function createProject(name: string): Project {
  const now = new Date().toISOString();
  return projectSchema.parse({
    formatVersion: 1,
    id: crypto.randomUUID(),
    name: name.trim(),
    revision: 0,
    createdAt: now,
    updatedAt: now,
    pages: [],
    reusableComponents: [],
    flows: [],
    flowRuns: [],
    state: {},
    dataSources: [],
    theme: { tokens: { primary: "#6d5dfc", surface: "#ffffff" } },
    animations: [],
    assets: [],
    codeModules: [],
    appConfig: {
      authentication: {
        mode: "none",
        roles: ["admin", "editor", "viewer"],
      },
      realtime: { mode: "none" },
      offline: false,
      environmentVariables: [],
    },
    plugins: [],
    dependencies: {},
    exportConfig: { target: "web", capacitor: false },
  });
}

export function parseProject(input: unknown): Project {
  input = migrateProject(input);
  if (
    typeof input === "object" &&
    input &&
    "formatVersion" in input &&
    (input as { formatVersion: unknown }).formatVersion !== 1
  ) {
    throw new Error(
      `Versione progetto non supportata: ${String((input as { formatVersion: unknown }).formatVersion)}`,
    );
  }
  const result = projectSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n"),
    );
  validateReferences(result.data);
  return result.data;
}

function migrateProject(input: unknown): unknown {
  if (
    !input ||
    typeof input !== "object" ||
    (input as { formatVersion?: unknown }).formatVersion !== 0
  )
    return input;
  const legacy = input as Record<string, unknown>;
  return {
    ...legacy,
    formatVersion: 1,
    state: legacy.state ?? {},
    flowRuns: legacy.flowRuns ?? [],
    reusableComponents: legacy.reusableComponents ?? [],
    dataSources: legacy.dataSources ?? [],
    theme: legacy.theme ?? { tokens: {} },
    animations: legacy.animations ?? [],
    assets: legacy.assets ?? [],
    codeModules: legacy.codeModules ?? [],
    appConfig: legacy.appConfig ?? {
      authentication: {
        mode: "none",
        roles: ["admin", "editor", "viewer"],
      },
      realtime: { mode: "none" },
      offline: false,
      environmentVariables: [],
    },
    plugins: legacy.plugins ?? [],
    dependencies: legacy.dependencies ?? {},
    exportConfig: legacy.exportConfig ?? { target: "web", capacitor: false },
  };
}

export function validateReferences(project: Project) {
  const componentIds = new Set(
    project.pages.flatMap((page) =>
      page.components.map((component) => component.id),
    ),
  );
  const flowIds = new Set(project.flows.map((flow) => flow.id));
  const sourceIds = new Set(project.dataSources.map((source) => source.id));
  const moduleIds = new Set(project.codeModules.map((module) => module.id));
  for (const definition of project.reusableComponents) {
    const definitionIds = new Set(definition.components.map((component) => component.id));
    if (definitionIds.size !== definition.components.length)
      throw new Error(`ID duplicato nel blocco riutilizzabile ${definition.name}`);
    for (const component of definition.components)
      if (component.parentId && !definitionIds.has(component.parentId))
        throw new Error(`Contenitore mancante nel blocco riutilizzabile ${definition.name}`);
    for (const exposed of definition.exposedProperties)
      if (!definitionIds.has(exposed.componentId))
        throw new Error(`Exposed property without a component in block ${definition.name}`);
  }
  for (const page of project.pages) {
    const pageIds = new Set(page.components.map((component) => component.id));
    if (pageIds.size !== page.components.length)
      throw new Error(`Duplicate component ID on page ${page.id}`);
    for (const component of page.components) {
      if (component.parentId && !pageIds.has(component.parentId))
        throw new Error(
          `Missing container ${component.parentId} in ${component.id}`,
        );
      if (component.parentId === component.id)
        throw new Error(
          `A component cannot contain itself: ${component.id}`,
        );
      const visited = new Set([component.id]);
      let parentId = component.parentId;
      while (parentId) {
        if (visited.has(parentId))
          throw new Error(`Cyclic hierarchy in ${component.id}`);
        visited.add(parentId);
        parentId = page.components.find(
          (item) => item.id === parentId,
        )?.parentId;
      }
      for (const flowId of Object.values(component.events))
        if (!flowIds.has(flowId))
          throw new Error(`Missing flow ${flowId} in ${component.id}`);
      if (component.binding && !sourceIds.has(component.binding.sourceId))
        throw new Error(`Missing source ${component.binding.sourceId}`);
    }
  }
  for (const flow of project.flows) {
    const nodes = new Set(flow.nodes.map((node) => node.id));
    for (const edge of flow.edges)
      if (!nodes.has(edge.source) || !nodes.has(edge.target))
        throw new Error(`Invalid connection ${edge.id}`);
    for (const node of flow.nodes)
      if (
        node.type === "readInput" &&
        !componentIds.has(node.config.componentId)
      )
        throw new Error(`Missing input ${node.config.componentId}`);
      else if (node.type === "module" && node.config.moduleId && !moduleIds.has(node.config.moduleId))
        throw new Error(`Missing module ${node.config.moduleId}`);
  }
  for (const source of project.dataSources)
    for (const relation of source.relations ?? []) {
      const target = project.dataSources.find((item) => item.id === relation.targetSourceId);
      if (!target) throw new Error(`Missing connected source ${relation.targetSourceId}`);
      if (!(relation.field in source.schema)) throw new Error(`Missing relation field ${source.name}.${relation.field}`);
      if (!(relation.targetField in target.schema)) throw new Error(`Missing relation field ${target.name}.${relation.targetField}`);
    }
}

export function serializeProject(project: Project) {
  return JSON.stringify(sortValue(parseProject(project)), null, 2);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortValue(item)]),
    );
  return value;
}
