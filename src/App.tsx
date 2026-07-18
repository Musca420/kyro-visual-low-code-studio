import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  deleteProject,
  deleteProjectRecord,
  getProject,
  insertProjectRecord,
  insertRecord,
  listPlugins,
  listExports,
  listProjectVersions,
  listProjects,
  queryRecords,
  saveProject,
  saveExport,
  updateProjectRecord,
  type LocalRecord,
  type ExportRecord,
  type ProjectVersion,
} from "./db";
import { runFlow, type FlowLog } from "./flow";
import { runCodeModule } from "./codeModules";
import {
  BREAKPOINTS,
  componentTypes,
  createProject,
  makeComponent,
  parseProject,
  serializeProject,
  type Breakpoint,
  type EditorComponent,
  type Flow,
  type PluginContribution,
  type PluginManifest,
  type Project,
} from "./model";
import { PluginManager } from "./PluginManager";
import { PreviewFrame } from "./PreviewFrame";
import {
  createTemplateProject,
  templateCatalog,
  type TemplateId,
} from "./templates";
import { CodexPanel, type CodexContext } from "./CodexPanel";
import { applyEditorOperation } from "./editorOperations";
import { captureElement, type CaptureResult } from "./capture";
import {
  canContain,
  componentPath,
  componentTree,
  descendantIds,
  type ComponentBranch,
} from "./hierarchy";
import { VisualProperties } from "./VisualProperties";
import { visualGradients, visualPalettes } from "./visualPresets";
import { importExistingFolder, readFolderFiles } from "./folderImport";
import { TerminalPanel } from "./TerminalPanel";
import { createBackup, restoreBackup, serializeBackup } from "./backup";
import {
  inspectComponentProgram,
  inspectFlowNodeProgram,
  inspectDataSourceProgram,
  type ComponentProgramView,
  type CapabilityIssue,
  type FlowNodeProgramView,
  type DataSourceProgramView,
} from "./programGraph";

type WorkspaceTab =
  "design" | "flow" | "data" | "preview" | "plugins" | "terminal" | "settings";
const FlowEditor = lazy(() => import("./FlowEditor"));
const ProjectSettings = lazy(() =>
  import("./ProjectSettings").then((module) => ({
    default: module.ProjectSettings,
  })),
);

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<Project>();
  const [loading, setLoading] = useState(true);
  const [uiTheme, setUiTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("frontend-editor-theme") === "light" ? "light" : "dark"),
  );
  useEffect(() => {
    document.documentElement.dataset.theme = uiTheme;
    localStorage.setItem("frontend-editor-theme", uiTheme);
  }, [uiTheme]);
  const refresh = useCallback(() => listProjects().then(setProjects), []);
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);
  return (
    <HelpOverlay>
      {active ? (
        <Editor
          initial={active}
          uiTheme={uiTheme}
          onToggleTheme={() => setUiTheme((value) => value === "dark" ? "light" : "dark")}
          onClose={() => {
            setActive(undefined);
            void refresh();
          }}
        />
      ) : (
        <Dashboard
          uiTheme={uiTheme}
          onToggleTheme={() => setUiTheme((value) => value === "dark" ? "light" : "dark")}
          loading={loading}
          projects={projects}
          onOpen={async (id) => {
            const project = await getProject(id);
            if (project) setActive(project);
          }}
          onRefresh={refresh}
        />
      )}
    </HelpOverlay>
  );
}

function Dashboard({
  uiTheme,
  onToggleTheme,
  loading,
  projects,
  onOpen,
  onRefresh,
}: {
  uiTheme: "light" | "dark";
  onToggleTheme: () => void;
  loading: boolean;
  projects: Project[];
  onOpen: (id: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const desktopImportStarted = useRef(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [target, setTarget] = useState<"web" | "pwa" | "android">("web");
  const [themeColor, setThemeColor] = useState("#6d5dfc");
  const [templateQuery, setTemplateQuery] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [importResult, setImportResult] = useState("");
  const [updateStatus, setUpdateStatus] = useState<DesktopUpdateStatus>();
  const importRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const desktop = window.frontendEditorDesktop;
    if (!desktop) return;
    void desktop.getUpdateStatus().then(setUpdateStatus);
    return desktop.onUpdateStatus(setUpdateStatus);
  }, []);
  useEffect(() => {
    const desktop = window.frontendEditorDesktop;
    if (!desktop || loading || desktopImportStarted.current) return;
    desktopImportStarted.current = true;
    void desktop.readWorkspace().then(async (workspace) => {
      if (!workspace) return;
      const storageKey = `frontend-editor-desktop:${workspace.root}`;
      const existingId = localStorage.getItem(storageKey);
      const existing = existingId ? await getProject(existingId) : undefined;
      if (existing) {
        onOpen(existing.id);
        return;
      }
      setImportResult(`Importo ${workspace.name} dalla cartella aperta con la CLI…`);
      const project = importExistingFolder(workspace.name, workspace.files);
      await saveProject(project);
      localStorage.setItem(storageKey, project.id);
      await onRefresh();
      setImportResult(`${workspace.name} è pronto sul canvas visuale.`);
      onOpen(project.id);
    }).catch((problem) => {
      setError(`Apertura desktop non riuscita: ${problem instanceof Error ? problem.message : String(problem)}`);
      desktopImportStarted.current = false;
    });
  }, [loading, onOpen, onRefresh]);
  const create = async (template: "blank" | "todo" | TemplateId = "blank") => {
    if (!name.trim()) return setError("Inserisci un nome per il progetto");
    let project =
      template === "blank" || template === "todo"
        ? createProject(name)
        : createTemplateProject(template, name);
    if (template === "todo") project = addVerticalTemplate(project);
    const packageName = `com.frontendeditor.${
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 24) || "app"
    }`;
    project = {
      ...project,
      theme: { tokens: { ...project.theme.tokens, primary: themeColor } },
      exportConfig:
        target === "android"
          ? {
              target,
              capacitor: true,
              android: {
                packageId: packageName,
                appName: name.trim(),
                orientation: "any",
                themeColor,
                versionName: "1.0.0",
                versionCode: 1,
                permissions: [],
                statusBarStyle: "dark",
                keyboardResize: true,
                backButton: true,
              },
            }
          : { target, capacitor: false },
    };
    await saveProject(project);
    setName("");
    setError("");
    await onRefresh();
    onOpen(project.id);
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const project = parseProject(JSON.parse(await file.text()));
      await saveProject(project);
      await onRefresh();
      setError("");
    } catch (problem) {
      setError(
        `Import non riuscito: ${problem instanceof Error ? problem.message : String(problem)}`,
      );
    }
  };
  const importFolder = async (input?: FileList | null) => {
    if (!input?.length) return;
    try {
      setError("");
      setImportResult("Analizzo pagine, componenti e configurazione…");
      const originName =
        input[0].webkitRelativePath.split("/")[0] || "Progetto importato";
      const files = await readFolderFiles(input);
      const project = importExistingFolder(originName, files);
      await saveProject(project);
      await onRefresh();
      setImportResult(
        `${project.importedSource?.detected}: ${project.pages.length} pagine e ${project.pages.reduce((sum, page) => sum + page.components.length, 0)} componenti pronti. ${project.importedSource?.exactModel ? "Modello visuale ripristinato integralmente." : "I file originali sono preservati nell’export."}`,
      );
      onOpen(project.id);
    } catch (problem) {
      setImportResult("");
      setError(
        `Import cartella non riuscito: ${problem instanceof Error ? problem.message : String(problem)}`,
      );
    } finally {
      if (folderRef.current) folderRef.current.value = "";
    }
  };
  const duplicate = async (project: Project) => {
    const now = new Date().toISOString();
    await saveProject({
      ...project,
      id: crypto.randomUUID(),
      name: `${project.name} copia`,
      createdAt: now,
      updatedAt: now,
    });
    await onRefresh();
  };
  const downloadBackup = async () => {
    try {
      const value = serializeBackup(await createBackup());
      const url = URL.createObjectURL(new Blob([value], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `frontend-editor-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setImportResult("Backup completo creato: progetti, dati, plugin, preferenze e conversazioni Codex.");
    } catch (problem) {
      setError(`Backup non riuscito: ${problem instanceof Error ? problem.message : String(problem)}`);
    }
  };
  const restoreBackupFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 12_000_000) throw new Error("Il backup supera il limite di 12 MB.");
      const result = await restoreBackup(JSON.parse(await file.text()));
      await onRefresh();
      setError("");
      setImportResult(`Ripristino completato: ${result.projects} progetti, ${result.records} record e ${result.plugins} plugin.`);
    } catch (problem) {
      setError(`Ripristino non riuscito: ${problem instanceof Error ? problem.message : String(problem)}`);
    } finally {
      if (backupRef.current) backupRef.current.value = "";
    }
  };
  const visibleProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(projectQuery.trim().toLowerCase()),
  );
  return (
    <main className="dashboard">
      <ThemeToggle theme={uiTheme} onToggle={onToggleTheme} />
      {updateStatus && updateStatus.state !== "disabled" && (
        <p
          className={`desktop-update-status ${updateStatus.state}`}
          role={updateStatus.state === "rejected" ? "alert" : "status"}
        >
          {updateStatus.state === "available" ? "Aggiornamento sicuro disponibile" : "Aggiornamento rifiutato"}: {updateStatus.message}
        </p>
      )}
      <header className="hero">
        <div className="brand-mark">FE</div>
        <p className="eyebrow">Visual low-code studio</p>
        <h1>
          Trasforma un’idea in un’app
          <br />
          <span>che funziona davvero.</span>
        </h1>
        <p>
          Crea interfaccia, dati e comportamento nello stesso spazio. Il
          progetto resta tuo, esportabile e leggibile.
        </p>
      </header>
      <section className="create-card" aria-labelledby="create-title">
        <div>
          <p className="eyebrow">Nuovo progetto</p>
          <h2 id="create-title">Da dove vuoi iniziare?</h2>
        </div>
        <fieldset className="target-picker">
          <legend>1. Dove vuoi usarlo?</legend>
          {(
            [
              [
                "web",
                "Sito Web",
                "Si apre nel browser e si pubblica su qualsiasi hosting.",
              ],
              [
                "pwa",
                "PWA installabile",
                "Si installa dal browser e conserva una base offline.",
              ],
              [
                "android",
                "Applicazione Android",
                "Genera configurazione Capacitor e progetto Android guidato.",
              ],
            ] as const
          ).map(([value, label, help]) => (
            <label
              data-help={help}
              key={value}
              className={target === value ? "active" : ""}
            >
              <input
                type="radio"
                name="target"
                value={value}
                checked={target === value}
                onChange={() => setTarget(value)}
              />
              <strong>{label}</strong>
              <small>{help}</small>
            </label>
          ))}
        </fieldset>
        <label className="theme-choice">
          2. Colore principale
          <span className="color-field">
            <input
              aria-label="Colore tema"
              type="color"
              value={themeColor}
              onChange={(event) => setThemeColor(event.target.value)}
            />
            <output>{themeColor}</output>
          </span>
        </label>
        <label>
          3. Nome progetto
          <input
            aria-label="Nome progetto"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void create("blank");
            }}
            placeholder="La mia applicazione"
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="template-heading">
          <p className="template-step">4. Scegli un punto di partenza</p>
          <label className="template-search">
            <span className="visually-hidden">Cerca template</span>
            <input
              type="search"
              placeholder="Cerca template…"
              value={templateQuery}
              onChange={(event) => setTemplateQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="template-grid">
          <button className="template" onClick={() => create("blank")}>
            <span>＋</span>
            <strong>Progetto vuoto</strong>
            <small>Parti da una tela pulita</small>
          </button>
          <button className="template" onClick={() => create("todo")}>
            <span>✓</span>
            <strong>Lista attività</strong>
            <small>Vertical slice già configurato</small>
          </button>
          {templateCatalog
            .filter((template) =>
              `${template.name} ${template.description} ${template.tags}`
                .toLowerCase()
                .includes(templateQuery.toLowerCase()),
            )
            .map((template) => (
              <button
                className="template featured"
                key={template.id}
                onClick={() => create(template.id)}
              >
                <span>{template.icon}</span>
                <strong>{template.name}</strong>
                <small>{template.description}</small>
              </button>
            ))}
        </div>
        <input
          ref={importRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          aria-label="File progetto da importare"
          onChange={(event) => void importFile(event.target.files?.[0])}
        />
        <button
          className="text-button"
          onClick={() => importRef.current?.click()}
        >
          Importa un progetto JSON
        </button>
        <input
          ref={(node) => {
            folderRef.current = node;
            node?.setAttribute("webkitdirectory", "");
          }}
          className="visually-hidden"
          type="file"
          multiple
          aria-label="Cartella progetto da importare"
          onChange={(event) => void importFolder(event.target.files)}
        />
        <button
          className="folder-import-button"
          onClick={() => folderRef.current?.click()}
        >
          <strong>Importa una cartella Web o app</strong>
          <span>
            Riprendi HTML/CSS, React, Vue, Svelte o Capacitor. Dipendenze e
            build generate vengono ignorate automaticamente.
          </span>
        </button>
        {importResult && (
          <p className="import-result" role="status">
            {importResult}
          </p>
        )}
      </section>
      <section className="recent" aria-labelledby="recent-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Salvati su questo dispositivo</p>
            <h2 id="recent-title">Progetti recenti</h2>
          </div>
          <div className="backup-actions">
            <label>
              <span className="visually-hidden">Cerca nei progetti recenti</span>
              <input
                type="search"
                placeholder="Cerca progetti…"
                value={projectQuery}
                onChange={(event) => setProjectQuery(event.target.value)}
              />
            </label>
            <button className="secondary" onClick={() => void downloadBackup()}>Crea backup</button>
            <button className="secondary" onClick={() => backupRef.current?.click()}>Ripristina backup</button>
            <input
              ref={backupRef}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              aria-label="File backup da ripristinare"
              onChange={(event) => void restoreBackupFile(event.target.files?.[0])}
            />
          </div>
        </div>
        {loading ? (
          <p>Caricamento…</p>
        ) : projects.length === 0 ? (
          <div className="empty-panel">
            <strong>Nessun progetto ancora</strong>
            <span>Assegna un nome e scegli un punto di partenza.</span>
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="empty-panel" role="status">
            <strong>Nessun progetto trovato</strong>
            <span>Prova un nome diverso oppure cancella la ricerca.</span>
          </div>
        ) : (
          <div className="project-grid">
            {visibleProjects.map((project) => (
              <article className="project-card" key={project.id}>
                <button
                  className="project-open"
                  onClick={() => onOpen(project.id)}
                >
                  <span className="project-thumb">
                    {project.pages[0]?.components.length ?? 0}
                    <small>componenti</small>
                  </span>
                  <strong>{project.name}</strong>
                  <small>
                    Formato v{project.formatVersion} · {project.pages.length}{" "}
                    pagine
                  </small>
                </button>
                <div className="project-actions">
                  <button onClick={() => duplicate(project)}>Duplica</button>
                  <button
                    className="danger"
                    onClick={async () => {
                      if (
                        confirm(`Eliminare definitivamente “${project.name}”?`)
                      ) {
                        await deleteProject(project.id);
                        await onRefresh();
                      }
                    }}
                  >
                    Elimina
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Editor({
  initial,
  onClose,
  uiTheme,
  onToggleTheme,
}: {
  initial: Project;
  onClose: () => void;
  uiTheme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const [project, setProject] = useState(initial);
  const [installedPlugins, setInstalledPlugins] = useState<PluginManifest[]>([]);
  const [pageId, setPageId] = useState(initial.pages[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>();
  const [tab, setTab] = useState<WorkspaceTab>("design");
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");
  const [interactive, setInteractive] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [history, setHistory] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportRecord[]>([]);
  const [saveState, setSaveState] = useState("Salvato");
  const [logs, setLogs] = useState<FlowLog[]>([]);
  const [pausedFlow, setPausedFlow] = useState<{ nodeId: string; value: unknown }>();
  const [sourceName, setSourceName] = useState("Attività locali");
  const [collection, setCollection] = useState("items");
  const [schemaFields, setSchemaFields] = useState<Array<{ id: string; name: string; type: "string" | "number" | "boolean" | "datetime" }>>(() =>
    (initial.state.experience === "dashboard"
      ? [["id", "string"], ["name", "string"], ["description", "string"], ["status", "string"], ["priority", "string"], ["dueDate", "datetime"], ["date", "datetime"]]
      : [["id", "string"], ["text", "string"], ["date", "datetime"]]
    ).map(([name, type]) => ({ id: crypto.randomUUID(), name, type: type as "string" | "datetime" })),
  );
  const [sourceProvider, setSourceProvider] = useState<
    "indexeddb" | "rest" | "generated"
  >("indexeddb");
  const [sourceEndpoint, setSourceEndpoint] = useState(
    "http://127.0.0.1:8787/records",
  );
  const [feedback, setFeedback] = useState("");
  const [generatedFile, setGeneratedFile] = useState<{ path: string; content: string }>();
  const [flowId, setFlowId] = useState(initial.flows[0]?.id ?? "");
  const [selectedFlowNodeId, setSelectedFlowNodeId] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState(initial.dataSources[0]?.id ?? "");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    component: EditorComponent;
    bounds: CodexContext["bounds"];
  }>();
  const [codexRequest, setCodexRequest] = useState<{
    context: CodexContext;
    prompt: string;
  }>();
  const [captureCommand, setCaptureCommand] = useState<{
    id: string;
    tool: "capture_canvas" | "capture_preview";
  }>();
  const processingCommands = useRef(new Set<string>());
  const runtimeState = useRef<Record<string, unknown>>({ ...initial.state });
  const resumeFlow = useRef<(() => void) | undefined>(undefined);
  const assetInput = useRef<HTMLInputElement>(null);
  const refreshPlugins = useCallback(
    () => listPlugins().then(setInstalledPlugins),
    [],
  );
  useEffect(() => {
    void refreshPlugins();
  }, [refreshPlugins]);
  useEffect(() => {
    void Promise.all([
      listProjectVersions(project.id),
      listExports(project.id),
    ]).then(([savedVersions, savedExports]) => {
      setVersions(savedVersions);
      setExportHistory(savedExports);
    });
  }, [project.id]);
  const currentPage = project.pages.find((page) => page.id === pageId);
  const activeComponent = currentPage?.components.find(
    (component) => component.id === selected[0],
  );
  const selectedComponents = currentPage?.components.filter((component) =>
    selected.includes(component.id),
  ) ?? [];
  const enabledPluginIds = new Set(
    project.plugins.filter((plugin) => plugin.enabled).map((plugin) => plugin.id),
  );
  const pluginContributions = installedPlugins
    .filter((plugin) => enabledPluginIds.has(plugin.id))
    .flatMap((plugin) =>
      plugin.contributions.filter(
        (contribution): contribution is PluginContribution =>
          typeof contribution !== "string",
      ),
    );
  const pluginComponents = pluginContributions.filter(
    (contribution): contribution is Extract<
      PluginContribution,
      { kind: "component" }
    > =>
      contribution.kind === "component" &&
      `${contribution.label} ${contribution.id}`
        .toLowerCase()
        .includes(paletteQuery.toLowerCase()),
  );
  const pluginNodes = pluginContributions.filter(
    (contribution): contribution is Extract<PluginContribution, { kind: "node" }> =>
      contribution.kind === "node",
  );
  const pluginProviders = pluginContributions.filter(
    (contribution): contribution is Extract<PluginContribution, { kind: "provider" }> =>
      contribution.kind === "provider",
  );
  const activeProgram =
    currentPage && activeComponent
      ? inspectComponentProgram(project, currentPage.id, activeComponent.id)
      : undefined;
  const branches = currentPage ? componentTree(currentPage.components) : [];
  const flow =
    project.flows.find((item) => item.id === flowId) ?? project.flows[0];
  const selectedFlowNode =
    flow && selectedFlowNodeId && flow.nodes.some((node) => node.id === selectedFlowNodeId)
      ? inspectFlowNodeProgram(project, flow.id, selectedFlowNodeId)
      : undefined;
  const selectedSource = project.dataSources.some((source) => source.id === selectedSourceId)
    ? inspectDataSourceProgram(project, selectedSourceId)
    : undefined;

  useEffect(() => {
    const components = currentPage?.components ?? [];
    const layouts = Object.fromEntries(
      components.map((component) => {
        const element = document.querySelector<HTMLElement>(
            `[data-component-id="${component.id}"]`,
          ),
          box = element?.getBoundingClientRect();
        return [
          component.id,
          box
            ? { x: box.x, y: box.y, width: box.width, height: box.height }
            : null,
        ];
      }),
    );
    const state = {
      projectId: project.id,
      pageId: currentPage?.id ?? "no-page",
      revision: project.revision,
      selectedComponentIds: selected,
      viewport: breakpoint,
      previewState: tab === "preview" ? "open" : "closed",
      componentTree: componentTree(components).map(serializeBranch),
      layouts,
      flows: project.flows,
      dataSources: project.dataSources,
      capabilities: selected.flatMap((componentId) =>
        components.some((component) => component.id === componentId)
          ? inspectComponentProgram(
              project,
              currentPage?.id ?? "no-page",
              componentId,
            ).issues
          : [],
      ),
      validationErrors: [],
      consoleErrors: [],
    };
    void fetch("/api/live/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state),
    }).catch(() => undefined);
  }, [project, currentPage, selected, breakpoint, tab]);

  const askCodex = (action: string) => {
    if (!contextMenu || !currentPage) return;
    const component = contextMenu.component;
    const context: CodexContext = {
      projectId: project.id,
      pageId: currentPage.id,
      revision: project.revision,
      componentId: component.id,
      componentName: component.name,
      componentType: component.type,
      treePath: [
        currentPage.name,
        ...componentPath(currentPage.components, component.id).map(
          (item) => item.name,
        ),
      ],
      bounds: contextMenu.bounds,
      properties: component.props,
      styles: component.styles,
      events: component.events,
      intent: component.intent,
      binding: component.binding,
      dataSources: project.dataSources,
      flows: project.flows.filter((item) =>
        Object.values(component.events).includes(item.id),
      ),
      nearbyComponents: currentPage.components
        .filter((item) => item.id !== component.id)
        .slice(0, 8)
        .map(({ id, name, type }) => ({ id, name, type })),
      generatedFiles: [
        "src/main.ts",
        "src/style.css",
        "project.frontend-editor.json",
      ],
      errors: [],
      capabilities: inspectComponentProgram(project, currentPage.id, component.id).issues,
    };
    const prompts: Record<string, string> = {
      "Chiedi a Codex": "",
      "Crea comportamento": `Crea un nuovo comportamento per “${component.name}”.`,
      "Modifica comportamento": `Modifica il comportamento esistente di “${component.name}”.`,
      "Collega dati": `Collega “${component.name}” ai dati necessari. Se manca una sorgente, proponi opzioni semplici prima di crearla.`,
      "Correggi problema": `Individua e correggi il problema di “${component.name}”.`,
      "Migliora componente": `Migliora usabilità, responsive design e accessibilità di “${component.name}”.`,
      "Spiega elemento": `Spiega in parole semplici cos’è “${component.name}”, cosa fa e come posso modificarlo.`,
    };
    setCodexRequest({ context, prompt: prompts[action] });
    setContextMenu(undefined);
  };

  const change = useCallback(
    (next: Project | ((value: Project) => Project), track = true) => {
      setProject((previous) => {
        const candidate = typeof next === "function" ? next(previous) : next;
        const value = {
          ...candidate,
          revision: previous.revision + 1,
          updatedAt: new Date().toISOString(),
        };
        if (track) {
          setHistory((items) => [...items.slice(-49), previous]);
          setFuture([]);
        }
        return value;
      });
      setSaveState("Modifiche non salvate");
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void saveProject(project)
        .then(async () => {
          setSaveState("Salvato automaticamente");
          setVersions(await listProjectVersions(project.id));
        })
        .catch((error) =>
          setSaveState(
            `Errore salvataggio: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
    }, 450);
    return () => clearTimeout(timer);
  }, [project]);

  const undo = useCallback(() => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [project, ...items]);
    setHistory((items) => items.slice(0, -1));
    setProject({
      ...previous,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
    });
    setSaveState("Modifiche non salvate");
  }, [history, project]);
  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, project]);
    setFuture((items) => items.slice(1));
    setProject({
      ...next,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
    });
    setSaveState("Modifiche non salvate");
  }, [future, project]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });

  const finishBridgeCommand = useCallback(
    async (id: string, result?: CaptureResult, error?: unknown) => {
      await fetch(`/api/live/commands/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          error
            ? {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              }
            : { ok: true, result },
        ),
      });
      processingCommands.current.delete(id);
      setCaptureCommand((current) =>
        current?.id === id ? undefined : current,
      );
    },
    [],
  );

  useEffect(() => {
    if (captureCommand?.tool !== "capture_canvas" || tab !== "design") return;
    const timer = setTimeout(() => {
      const canvas = document.querySelector<HTMLElement>(".design-canvas");
      if (!canvas)
        return void finishBridgeCommand(
          captureCommand.id,
          undefined,
          new Error("Canvas non disponibile"),
        );
      void captureElement(canvas)
        .then((result) => finishBridgeCommand(captureCommand.id, result))
        .catch((error) =>
          finishBridgeCommand(captureCommand.id, undefined, error),
        );
    }, 100);
    return () => clearTimeout(timer);
  }, [captureCommand, tab, finishBridgeCommand]);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const commands = (await fetch(
          `/api/live/commands?projectId=${project.id}`,
        ).then((response) => response.json())) as {
          id: string;
          tool: string;
          args: Record<string, unknown>;
        }[];
        for (const command of commands) {
          if (processingCommands.current.has(command.id)) continue;
          processingCommands.current.add(command.id);
          try {
            if (
              command.tool === "capture_canvas" ||
              command.tool === "capture_preview"
            ) {
              setCaptureCommand({ id: command.id, tool: command.tool });
              setTab(command.tool === "capture_canvas" ? "design" : "preview");
              continue;
            }
            if (command.tool === "undo_last_transaction") undo();
            else if (command.tool === "open_preview") setTab("preview");
            else
              change((value) =>
                applyEditorOperation(value, pageId, {
                  type: command.tool,
                  args: command.args,
                }),
              );
            await fetch(`/api/live/commands/${command.id}`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ok: true }),
            });
            processingCommands.current.delete(command.id);
            setFeedback(
              `Modifica Codex applicata · transazione ${command.id.slice(0, 8)}`,
            );
          } catch (error) {
            await finishBridgeCommand(command.id, undefined, error);
          }
        }
      } catch {
        /* Il bridge non esiste nella build statica. */
      }
    }, 600);
    return () => clearInterval(timer);
  }, [project.id, pageId, change, undo, finishBridgeCommand]);

  const patchPage = (
    update: (components: EditorComponent[]) => EditorComponent[],
  ) =>
    change((value) => ({
      ...value,
      pages: value.pages.map((page) =>
        page.id === pageId
          ? { ...page, components: update(page.components) }
          : page,
      ),
    }));
  const addComponent = (type: EditorComponent["type"], parentId?: string) => {
    if (!currentPage) return setFeedback("Crea prima una pagina");
    const component = makeComponent(type);
    if (parentId) component.parentId = parentId;
    patchPage((components) => [...components, component]);
    setSelected([component.id]);
  };
  const addPluginComponent = (
    contribution: Extract<PluginContribution, { kind: "component" }>,
  ) => {
    if (!currentPage) return setFeedback("Crea prima una pagina");
    const component = makeComponent(contribution.componentType);
    component.name = contribution.label;
    component.props = { ...component.props, ...contribution.props };
    component.styles.desktop = {
      ...component.styles.desktop,
      ...contribution.styles,
    };
    component.accessibility.label = contribution.label;
    patchPage((components) => [...components, component]);
    setSelected([component.id]);
    setFeedback(`Componente plugin aggiunto: ${contribution.label}`);
  };
  const updateComponent = (
    update: (component: EditorComponent) => EditorComponent,
  ) =>
    patchPage((components) =>
      components.map((component) =>
        selected.includes(component.id) ? update(component) : component,
      ),
    );
  const componentStyle = (component: EditorComponent) => ({
    ...component.styles.desktop,
    ...(breakpoint === "desktop" ? {} : component.styles[breakpoint]),
  });
  const applyDirectStyle = (
    componentId: string,
    values: Partial<EditorComponent["styles"]["desktop"]>,
  ) => {
    const source = currentPage?.components.find(
      (component) => component.id === componentId,
    );
    if (!source) return;
    const moving = "left" in values || "top" in values;
    const sourceStyle = componentStyle(source);
    const deltaX = moving
      ? (Number.parseFloat(values.left ?? sourceStyle.left) || 0) -
        (Number.parseFloat(sourceStyle.left) || 0)
      : 0;
    const deltaY = moving
      ? (Number.parseFloat(values.top ?? sourceStyle.top) || 0) -
        (Number.parseFloat(sourceStyle.top) || 0)
      : 0;
    patchPage((components) =>
      components.map((component) => {
        const moveTogether =
          moving &&
          selected.includes(componentId) &&
          selected.includes(component.id) &&
          component.parentId === source.parentId;
        if (component.id !== componentId && !moveTogether) return component;
        const current = componentStyle(component);
        const next =
          component.id === componentId
            ? values
            : {
                position:
                  current.position === "absolute"
                    ? ("absolute" as const)
                    : ("relative" as const),
                left: `${(Number.parseFloat(current.left) || 0) + deltaX}px`,
                top: `${(Number.parseFloat(current.top) || 0) + deltaY}px`,
              };
        return {
          ...component,
          styles: {
            ...component.styles,
            [breakpoint]: {
              ...component.styles[breakpoint],
              ...next,
            },
          },
        };
      }),
    );
  };
  const arrangeSelection = (
    action:
      | "left"
      | "center"
      | "right"
      | "top"
      | "middle"
      | "bottom"
      | "distribute-x"
      | "distribute-y",
  ) => {
    const entries = selectedComponents
      .map((component) => ({
        component,
        box: document
          .querySelector<HTMLElement>(`[data-component-id="${component.id}"]`)
          ?.getBoundingClientRect(),
      }))
      .filter(
        (entry): entry is { component: EditorComponent; box: DOMRect } =>
          Boolean(entry.box),
      );
    if (entries.length < 2) return;
    if (new Set(entries.map(({ component }) => component.parentId ?? "root")).size > 1) {
      setFeedback("Seleziona elementi dello stesso gruppo per allinearli insieme");
      return;
    }
    const left = Math.min(...entries.map(({ box }) => box.left));
    const right = Math.max(...entries.map(({ box }) => box.right));
    const top = Math.min(...entries.map(({ box }) => box.top));
    const bottom = Math.max(...entries.map(({ box }) => box.bottom));
    const targets = new Map<string, { x?: number; y?: number }>();
    entries.forEach(({ component, box }) => {
      if (action === "left") targets.set(component.id, { x: left });
      if (action === "center")
        targets.set(component.id, { x: (left + right - box.width) / 2 });
      if (action === "right") targets.set(component.id, { x: right - box.width });
      if (action === "top") targets.set(component.id, { y: top });
      if (action === "middle")
        targets.set(component.id, { y: (top + bottom - box.height) / 2 });
      if (action === "bottom") targets.set(component.id, { y: bottom - box.height });
    });
    if (action === "distribute-x" && entries.length >= 3) {
      const ordered = [...entries].sort((a, b) => a.box.left - b.box.left);
      const gap =
        (right - left - ordered.reduce((sum, entry) => sum + entry.box.width, 0)) /
        (ordered.length - 1);
      let cursor = left;
      ordered.forEach(({ component, box }) => {
        targets.set(component.id, { x: cursor });
        cursor += box.width + gap;
      });
    }
    if (action === "distribute-y" && entries.length >= 3) {
      const ordered = [...entries].sort((a, b) => a.box.top - b.box.top);
      const gap =
        (bottom - top - ordered.reduce((sum, entry) => sum + entry.box.height, 0)) /
        (ordered.length - 1);
      let cursor = top;
      ordered.forEach(({ component, box }) => {
        targets.set(component.id, { y: cursor });
        cursor += box.height + gap;
      });
    }
    if (!targets.size) return;
    const canvasBox = document
      .querySelector<HTMLElement>(".design-canvas")
      ?.getBoundingClientRect();
    patchPage((components) =>
      components.map((component) => {
        const target = targets.get(component.id);
        const entry = entries.find((item) => item.component.id === component.id);
        if (!target || !entry) return component;
        const current = componentStyle(component);
        const snap = (value: number) => Math.round(value / 8) * 8;
        if (!component.parentId && canvasBox) {
          return {
            ...component,
            styles: {
              ...component.styles,
              [breakpoint]: {
                ...component.styles[breakpoint],
                position: "absolute",
                left: `${snap(((target.x ?? entry.box.left) - canvasBox.left) / zoom)}px`,
                top: `${snap(((target.y ?? entry.box.top) - canvasBox.top) / zoom)}px`,
                marginLeft: "0px",
                marginTop: "0px",
              },
            },
          };
        }
        return {
          ...component,
          styles: {
            ...component.styles,
            [breakpoint]: {
              ...component.styles[breakpoint],
              ...(target.x === undefined
                ? {}
                : {
                    position: "relative" as const,
                    left: `${snap((Number.parseFloat(current.left) || 0) + (target.x - entry.box.left) / zoom)}px`,
                  }),
              ...(target.y === undefined
                ? {}
                : {
                    position: "relative" as const,
                    top: `${snap((Number.parseFloat(current.top) || 0) + (target.y - entry.box.top) / zoom)}px`,
                  }),
            },
          },
        };
      }),
    );
  };
  const startMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    event.preventDefault();
    const canvas = event.currentTarget;
    const canvasBox = canvas.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY };
    let current = start;
    setSelected([]);
    const draw = (pointer: PointerEvent) => {
      current = { x: pointer.clientX, y: pointer.clientY };
      setMarquee({
        x: (Math.min(start.x, current.x) - canvasBox.left) / zoom,
        y: (Math.min(start.y, current.y) - canvasBox.top) / zoom,
        width: Math.abs(current.x - start.x) / zoom,
        height: Math.abs(current.y - start.y) / zoom,
      });
    };
    const finish = () => {
      window.removeEventListener("pointermove", draw);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      const bounds = {
        left: Math.min(start.x, current.x),
        right: Math.max(start.x, current.x),
        top: Math.min(start.y, current.y),
        bottom: Math.max(start.y, current.y),
      };
      if (bounds.right - bounds.left >= 4 && bounds.bottom - bounds.top >= 4) {
        const ids = [...canvas.querySelectorAll<HTMLElement>("[data-component-id]")]
          .filter((element) => {
            const box = element.getBoundingClientRect();
            const center = {
              x: box.left + box.width / 2,
              y: box.top + box.height / 2,
            };
            return (
              center.x >= bounds.left &&
              center.x <= bounds.right &&
              center.y >= bounds.top &&
              center.y <= bounds.bottom
            );
          })
          .map((element) => element.dataset.componentId!)
          .filter(Boolean);
        setSelected(ids);
      }
      setMarquee(undefined);
    };
    window.addEventListener("pointermove", draw);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };
  const removeSelected = () => {
    change((value) => {
      const page = value.pages.find((item) => item.id === pageId);
      const removedComponents = new Set(selected);
      if (page)
        selected.forEach((id) =>
          descendantIds(page.components, id).forEach((childId) =>
            removedComponents.add(childId),
          ),
        );
      const removedFlows = new Set(
        value.flows
          .filter((item) =>
            item.nodes.some(
              (node) =>
                node.config.componentId &&
                removedComponents.has(node.config.componentId),
            ),
          )
          .map((item) => item.id),
      );
      return {
        ...value,
        flows: value.flows.filter((item) => !removedFlows.has(item.id)),
        pages: value.pages.map((page) => ({
          ...page,
          components: page.components
            .filter((component) => !removedComponents.has(component.id))
            .map((component) => ({
              ...component,
              events: Object.fromEntries(
                Object.entries(component.events).filter(
                  ([, flowId]) => !removedFlows.has(flowId),
                ),
              ),
            })),
        })),
      };
    });
    setSelected([]);
  };
  const addPage = () => {
    const page = {
      id: crypto.randomUUID(),
      name: `Pagina ${project.pages.length + 1}`,
      path: project.pages.length ? `/pagina-${project.pages.length + 1}` : "/",
      components: [],
    };
    change({ ...project, pages: [...project.pages, page] });
    setPageId(page.id);
    setSelected([]);
  };
  const addAssets = async (files: FileList | null) => {
    if (!files?.length) return;
    const accepted = [...files].filter(
      (file) =>
        file.size <= 2_000_000 && /^(image|audio|video)\//.test(file.type),
    );
    if (accepted.length !== files.length)
      setFeedback(
        "Alcuni file sono stati ignorati: usa immagini, audio o video fino a 2 MB",
      );
    const assets = await Promise.all(
      accepted.map(async (file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        url: await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }),
      })),
    );
    if (assets.length) {
      change({ ...project, assets: [...project.assets, ...assets] });
      setFeedback(
        `${assets.length} asset ${assets.length === 1 ? "caricato" : "caricati"} e salvato nel progetto`,
      );
    }
    if (assetInput.current) assetInput.current.value = "";
  };
  const createSource = () => {
    if (!sourceName.trim() || !collection.trim())
      return setFeedback("Nome e collezione sono obbligatori");
    if (
      project.dataSources.some(
        (source) => source.collection === collection.trim(),
      )
    )
      return setFeedback("Esiste già una sorgente per questa collezione");
    if (sourceProvider !== "indexeddb") {
      try {
        new URL(sourceEndpoint);
      } catch {
        return setFeedback(
          "Inserisci un indirizzo API completo, per esempio https://api.esempio.it/progetti",
        );
      }
    }
    const normalizedFields = schemaFields.map((field) => ({ ...field, name: field.name.trim() }));
    if (normalizedFields.some((field) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(field.name)))
      return setFeedback("Ogni campo deve iniziare con una lettera e contenere solo lettere, numeri o underscore");
    if (new Set(normalizedFields.map((field) => field.name)).size !== normalizedFields.length)
      return setFeedback("I nomi dei campi devono essere unici");
    if (!normalizedFields.some((field) => field.name === "id"))
      return setFeedback("Lo schema deve contenere il campo id");
    const schema = Object.fromEntries(normalizedFields.map((field) => [field.name, field.type]));
    const id = crypto.randomUUID();
    change({
      ...project,
      dataSources: [
        ...project.dataSources,
        {
          id,
          name: sourceName.trim(),
          provider: sourceProvider,
          collection: collection.trim(),
          schema,
          capabilities: [
            "get",
            "query",
            "insert",
            "update",
            "delete",
            "subscribe",
          ],
          secretStrategy: sourceProvider === "rest" ? "environment" : "none",
          ...(sourceProvider === "indexeddb"
            ? {}
            : { endpoint: sourceEndpoint }),
          ...(sourceProvider === "rest" ? { environmentKey: "API_TOKEN" } : {}),
        },
      ],
    });
    setSelectedSourceId(id);
    setFeedback(
      sourceProvider === "indexeddb"
        ? "Sorgente IndexedDB creata e schema validato"
        : sourceProvider === "generated"
          ? "Backend locale configurato: verrà incluso nell’export"
          : "API REST collegata. Il token resta in una variabile d’ambiente, non nel progetto",
    );
  };
  const createFlow = () => {
    if (project.state.experience === "landing") {
      const flows = landingFlows(project);
      change({ ...project, flows: flows.flows, pages: flows.pages });
      setFlowId(flows.flows[0].id);
      setFeedback(
        flows.flows.length === 2
          ? "Due flow collegati: navigazione alle feature e notifica"
          : "Tre flow collegati: navigazione, notifica e richiesta contatto persistente",
      );
      return;
    }
    if (project.state.experience === "dashboard") {
      if (!project.dataSources[0])
        return setFeedback("Crea prima la sorgente locale dei progetti");
      const flows = dashboardFlows(project);
      change({ ...project, flows: flows.flows, pages: flows.pages });
      setFlowId(flows.flows[0].id);
      setFeedback(
        "Flow CRUD, caricamento, ricerca, filtro, ordinamento e KPI collegati",
      );
      return;
    }
    const input = currentPage?.components.find(
      (component) => component.type === "input",
    );
    const button = currentPage?.components.find(
      (component) => component.type === "button",
    );
    const list = currentPage?.components.find(
      (component) => component.type === "list",
    );
    const source = project.dataSources[0];
    if (!input || !button || !list || !source)
      return setFeedback("Servono input, pulsante, lista e sorgente locale");
    const ids = Array.from({ length: 6 }, () => crypto.randomUUID());
    const newFlow: Flow = {
      id: crypto.randomUUID(),
      name: "Aggiungi attività",
      nodes: [
        {
          id: ids[0],
          type: "event",
          label: "Click pulsante",
          position: { x: 0, y: 80 },
          config: { componentId: button.id },
        },
        {
          id: ids[1],
          type: "readInput",
          label: "Leggi input",
          position: { x: 190, y: 80 },
          config: { componentId: input.id },
        },
        {
          id: ids[2],
          type: "validate",
          label: "Non vuoto",
          position: { x: 380, y: 80 },
          config: { message: "Scrivi un’attività prima di aggiungerla" },
        },
        {
          id: ids[3],
          type: "insert",
          label: "Inserisci record",
          position: { x: 570, y: 40 },
          config: { sourceId: source.id },
        },
        {
          id: ids[4],
          type: "refresh",
          label: "Aggiorna lista",
          position: { x: 760, y: 40 },
          config: { componentId: list.id },
        },
        {
          id: ids[5],
          type: "notify",
          label: "Mostra errore",
          position: { x: 570, y: 180 },
          config: { level: "error" },
        },
      ],
      edges: [
        {
          id: crypto.randomUUID(),
          source: ids[0],
          target: ids[1],
          path: "success",
        },
        {
          id: crypto.randomUUID(),
          source: ids[1],
          target: ids[2],
          path: "success",
        },
        {
          id: crypto.randomUUID(),
          source: ids[2],
          target: ids[3],
          path: "success",
        },
        {
          id: crypto.randomUUID(),
          source: ids[2],
          target: ids[5],
          path: "error",
        },
        {
          id: crypto.randomUUID(),
          source: ids[3],
          target: ids[4],
          path: "success",
        },
        {
          id: crypto.randomUUID(),
          source: ids[3],
          target: ids[5],
          path: "error",
        },
      ],
    };
    change({
      ...project,
      flows: [newFlow],
      pages: project.pages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              components: page.components.map((component) =>
                component.id === button.id
                  ? {
                      ...component,
                      events: { ...component.events, click: newFlow.id },
                    }
                  : component.id === list.id
                    ? {
                        ...component,
                        binding: { sourceId: source.id, state: "data" },
                      }
                    : component,
              ),
            }
          : page,
      ),
    });
    setFlowId(newFlow.id);
    setFeedback("Flow collegato al click e lista collegata alla sorgente");
  };
  const addPluginNode = (
    contribution: Extract<PluginContribution, { kind: "node" }>,
  ) => {
    if (!flow) return setFeedback("Crea prima un flow, poi aggiungi il nodo plugin");
    const id = crypto.randomUUID();
    change({
      ...project,
      flows: project.flows.map((item) =>
        item.id === flow.id
          ? {
              ...item,
              nodes: [
                ...item.nodes,
                {
                  id,
                  type: contribution.nodeType,
                  label: contribution.label,
                  position: {
                    x: 120 + (item.nodes.length % 4) * 190,
                    y: 260 + Math.floor(item.nodes.length / 4) * 120,
                  },
                  config: contribution.config,
                },
              ],
            }
          : item,
      ),
    });
    setSelectedFlowNodeId(id);
    setFeedback(`Nodo plugin aggiunto in isolamento: ${contribution.label}`);
  };

  const refreshRecords = useCallback(async (): Promise<LocalRecord[]> => {
    const source = project.dataSources[0];
    if (!source) return [];
    if (source.provider === "indexeddb" || source.provider === "generated")
      return queryRecords(source.id);
    const response = await fetch(source.endpoint!);
    if (!response.ok)
      throw new Error(`API non disponibile (${response.status})`);
    const value = await response.json();
    if (!Array.isArray(value))
      throw new Error("L’API deve restituire un elenco JSON");
    return value.map((record, index) => ({
      id: String(record.id ?? index),
      sourceId: source.id,
      text: String(record.name ?? record.text ?? record.title ?? "Elemento"),
      description: record.description ? String(record.description) : undefined,
      status: record.status,
      priority: record.priority,
      dueDate: record.dueDate,
      date: String(record.date ?? new Date().toISOString()),
    }));
  }, [project.dataSources]);
  const addRecord = useCallback(
    async (input: string) => {
      const activeFlow =
        project.flows.find((flow) =>
          flow.nodes.some((node) => node.type === "insert"),
        ) ?? project.flows[0];
      const source = project.dataSources[0];
      if (!activeFlow || !source)
        throw new Error("Configura prima sorgente e flow");
      if (source.provider === "rest") {
        const response = await fetch(source.endpoint!, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: input }),
        });
        if (!response.ok)
          throw new Error(`Salvataggio API non riuscito (${response.status})`);
        await refreshRecords();
        return;
      }
      setLogs([]);
      const result = await runFlow(activeFlow, {
        input,
        insert: (text, sourceId) => insertRecord(sourceId || source.id, text),
        query: (sourceId) => queryRecords(sourceId || source.id),
        refresh: async () => {
          await queryRecords(source.id);
        },
        runModule: (moduleId, value) => {
          const module = project.codeModules.find((item) => item.id === moduleId);
          if (!module) throw new Error("Modulo avanzato non trovato");
          return runCodeModule(module, value);
        },
        getState: (key) => runtimeState.current[key],
        setState: (key, value) => { runtimeState.current[key] = value; },
        resetState: (key) => { delete runtimeState.current[key]; },
        request: async (url, method, body) => {
          const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body });
          if (!response.ok) throw new Error(`API non disponibile (${response.status})`);
          return response.status === 204 ? undefined : response.headers.get("content-type")?.includes("json") ? response.json() : response.text();
        },
        onLog: (log) => setLogs((current) => [...current, log]),
        onBreakpoint: (nodeId, value) => new Promise<void>((resolve) => {
          setPausedFlow({ nodeId, value });
          resumeFlow.current = () => { setPausedFlow(undefined); resumeFlow.current = undefined; resolve(); };
        }),
      });
      setLogs(result);
      const error = result.find((entry) => entry.level === "error");
      if (error) throw new Error(error.message);
    },
    [project.flows, project.dataSources, project.codeModules, refreshRecords],
  );

  const runPreviewFlow = useCallback(async (flowId: string, input: unknown) => {
    const activeFlow = project.flows.find((item) => item.id === flowId);
    const source = project.dataSources[0];
    if (!activeFlow) throw new Error("Flow non trovato");
    let notification: string | undefined, level: string | undefined, navigate: string | undefined, modalId: string | undefined, ui: { componentId: string; operation: string; value: string } | undefined;
    setLogs([]);
    const result = await runFlow(activeFlow, {
      input,
      insert: (value, sourceId) => insertRecord(sourceId || source?.id || "", value),
      query: (sourceId) => queryRecords(sourceId || source?.id || ""),
      update: async (value, sourceId) => {
        if (!value || typeof value !== "object") throw new Error("Il record da modificare non è valido");
        const record = value as Record<string, unknown>;
        return updateProjectRecord(sourceId || source?.id || "", String(record.id || ""), record);
      },
      delete: async (value, sourceId) => {
        const id = typeof value === "object" && value ? String((value as Record<string, unknown>).id || "") : String(value || "");
        await deleteProjectRecord(sourceId || source?.id || "", id);
      },
      refresh: async () => { if (source) await refreshRecords(); },
      navigate: (path) => { navigate = path; },
      openModal: (componentId) => { modalId = componentId; },
      updateUI: (componentId, operation, value) => { ui = { componentId, operation, value }; },
      notify: (message, kind) => { notification = message; level = kind; },
      runModule: (moduleId, value) => {
        const module = project.codeModules.find((item) => item.id === moduleId);
        if (!module) throw new Error("Modulo avanzato non trovato");
        return runCodeModule(module, value);
      },
      getState: (key) => runtimeState.current[key],
      setState: (key, value) => { runtimeState.current[key] = value; },
      resetState: (key) => { delete runtimeState.current[key]; },
      request: async (url, method, body) => {
        const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body });
        if (!response.ok) throw new Error(`API non disponibile (${response.status})`);
        return response.status === 204 ? undefined : response.headers.get("content-type")?.includes("json") ? response.json() : response.text();
      },
      onLog: (log) => setLogs((current) => [...current, log]),
      onBreakpoint: (nodeId, value) => new Promise<void>((resolve) => {
        setPausedFlow({ nodeId, value });
        resumeFlow.current = () => { setPausedFlow(undefined); resumeFlow.current = undefined; resolve(); };
      }),
    });
    setLogs(result);
    const failure = result.find((entry) => entry.level === "error");
    if (failure) throw new Error(failure.message);
    return { notification, level, navigate, modalId, ui };
  }, [project.flows, project.dataSources, project.codeModules, refreshRecords]);

  const dashboardAction = useCallback(
    async (action: string, payload?: Record<string, string>) => {
      const source = project.dataSources[0];
      if (!source) throw new Error("Configura prima la sorgente locale");
      if (source.provider === "rest") {
        const endpoint =
          action === "create"
            ? source.endpoint!
            : `${source.endpoint!}/${encodeURIComponent(String(payload?.id ?? ""))}`;
        const response = await fetch(endpoint, {
          method:
            action === "create"
              ? "POST"
              : action === "update"
                ? "PUT"
                : "DELETE",
          headers: { "content-type": "application/json" },
          body: action === "delete" ? undefined : JSON.stringify(payload),
        });
        if (!response.ok)
          throw new Error(`Operazione API non riuscita (${response.status})`);
        return refreshRecords();
      }
      if (action === "create") await insertProjectRecord(source.id, payload);
      if (action === "update")
        await updateProjectRecord(
          source.id,
          String(payload?.id ?? ""),
          payload,
        );
      if (action === "delete")
        await deleteProjectRecord(source.id, String(payload?.id ?? ""));
      return queryRecords(source.id);
    },
    [project.dataSources, refreshRecords],
  );

  const archiveExport = async (blob: Blob, fileName: string, target: string) => {
    await saveExport({
      id: crypto.randomUUID(),
      projectId: project.id,
      fileName,
      target,
      createdAt: new Date().toISOString(),
      blob,
    });
    setExportHistory(await listExports(project.id));
  };
  const exportProject = async () => {
    const blob = new Blob([serializeProject(project)], {
      type: "application/json",
    });
    const fileName = `${project.name}.frontend-editor.json`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
    await archiveExport(blob, fileName, "project");
  };
  const openGeneratedFile = async (path: string) => {
    try {
      const content = path === "project.frontend-editor.json"
        ? serializeProject(project)
        : path.endsWith("/")
          ? `Cartella generata durante la build: ${path}`
          : (await import("./generator")).generateFiles(project)[path];
      if (!content) throw new Error(`Il file ${path} non è prodotto da questa configurazione`);
      setGeneratedFile({ path, content });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    }
  };
  const downloadStoredExport = (record: ExportRecord) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(record.blob);
    link.download = record.fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const reorder = (component: EditorComponent, direction: number) => {
    if (!currentPage) return;
    const siblings = currentPage.components.filter(
      (item) => item.parentId === component.parentId,
    );
    const index =
      siblings.findIndex((item) => item.id === component.id) + direction;
    if (index >= 0 && index < siblings.length)
      change((value) =>
        applyEditorOperation(value, pageId, {
          type: "reorder_component",
          args: { componentId: component.id, index },
        }),
      );
  };
  const reparent = (componentId: string, parentId?: string) =>
    change((value) =>
      applyEditorOperation(value, pageId, {
        type: "move_component",
        args: { componentId, parentId: parentId || null },
      }),
    );
  const wrap = (componentId: string) =>
    change((value) =>
      applyEditorOperation(value, pageId, {
        type: "wrap_component",
        args: { componentId, componentType: "stack", name: "Gruppo" },
      }),
    );

  const commands = [
    ...([
      ["Apri Design", "componenti canvas", () => setTab("design")],
      ["Apri Flow", "interazioni nodi", () => setTab("flow")],
      ["Apri Dati", "database sorgenti", () => setTab("data")],
      ["Apri Preview", "prova anteprima", () => setTab("preview")],
      ["Apri Pubblica", "export web pwa android", () => setTab("settings")],
      ["Aggiungi pagina", "nuova schermata", addPage],
      ["Annulla ultima modifica", "undo cronologia", undo],
      ["Ripristina modifica", "redo cronologia", redo],
    ] as Array<[string, string, () => void]>),
    ...componentTypes.map(
      (type) =>
        [
          `Aggiungi ${type}`,
          `componente elemento ${type}`,
          () => addComponent(type),
        ] as [string, string, () => void],
    ),
  ].filter(([label, keywords]) =>
    `${label} ${keywords}`.toLowerCase().includes(commandQuery.toLowerCase()),
  );

  return (
    <div className="app-shell" data-project-id={project.id}>
      {commandOpen && (
        <div
          className="command-backdrop"
          role="presentation"
          onMouseDown={() => setCommandOpen(false)}
        >
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Comandi rapidi"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <label>
              <span className="visually-hidden">Cerca un comando</span>
              <input
                autoFocus
                type="search"
                placeholder="Cosa vuoi fare?"
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setCommandOpen(false);
                }}
              />
            </label>
            <p>Comandi rapidi · Ctrl+K</p>
            <div className="command-results">
              {commands.slice(0, 12).map(([label, keywords, action]) => (
                <button
                  key={label}
                  onClick={() => {
                    action();
                    setCommandOpen(false);
                    setCommandQuery("");
                  }}
                >
                  <strong>{label}</strong>
                  <small>{keywords}</small>
                </button>
              ))}
              {!commands.length && (
                <span>
                  Nessun comando trovato. Prova “preview”, “pagina” o il nome di
                  un componente.
                </span>
              )}
            </div>
          </section>
        </div>
      )}
      <header className="topbar">
        <button
          className="brand-button"
          onClick={onClose}
          aria-label="Chiudi progetto e torna alla dashboard"
        >
          <span>FE</span>
        </button>
        <div className="project-title">
          <input
            aria-label="Nome progetto"
            value={project.name}
            onChange={(event) =>
              change({ ...project, name: event.target.value })
            }
          />
          <span>{saveState}</span>
        </div>
        <div className="top-actions">
          <ThemeToggle theme={uiTheme} onToggle={onToggleTheme} />
          <button
            className="icon-button"
            onClick={undo}
            disabled={!history.length}
            aria-label="Annulla"
          >
            ↶
          </button>
          <button
            className="icon-button"
            onClick={redo}
            disabled={!future.length}
            aria-label="Ripristina"
          >
            ↷
          </button>
          <button
            className="icon-button"
            data-help="Cerca azioni e componenti. Scorciatoia Ctrl+K."
            onClick={() => setCommandOpen(true)}
            aria-label="Apri comandi rapidi"
          >
            ⌘
          </button>
          <details className="history-menu">
            <summary>Versioni {versions.length}</summary>
            <div>
              {versions.slice(0, 8).map((version) => (
                <button
                  key={version.id}
                  className="secondary"
                  onClick={() => {
                    change(version.project);
                    setFeedback(`Ripristinata revisione ${version.revision}`);
                  }}
                >
                  Revisione {version.revision}
                  <small>{new Date(version.createdAt).toLocaleString("it")}</small>
                </button>
              ))}
            </div>
          </details>
          <details className="history-menu">
            <summary>Export {exportHistory.length}</summary>
            <div>
              {exportHistory.length === 0 ? (
                <span>Nessun export archiviato</span>
              ) : exportHistory.slice(0, 8).map((record) => (
                <button
                  key={record.id}
                  className="secondary"
                  onClick={() => downloadStoredExport(record)}
                >
                  {record.fileName}
                  <small>{new Date(record.createdAt).toLocaleString("it")}</small>
                </button>
              ))}
            </div>
          </details>
          <button className="secondary" onClick={exportProject}>
            Esporta JSON
          </button>
          <button
            onClick={() =>
              void import("./generator")
                .then(({ downloadGeneratedApp }) =>
                  downloadGeneratedApp(project),
                )
                .then(async ({ blob, fileName }) => {
                  await archiveExport(blob, fileName, project.exportConfig.target);
                  setFeedback("App TypeScript esportata come ZIP e archiviata");
                })
                .catch((error) =>
                  setFeedback(
                    error instanceof Error ? error.message : String(error),
                  ),
                )
            }
          >
            Esporta app
          </button>
        </div>
      </header>
      <nav className="workspace-tabs" aria-label="Aree di lavoro">
        {(
          [
            [
              "design",
              "Design",
              "Disegna pagine e componenti senza scrivere codice.",
            ],
            [
              "flow",
              "Flow",
              "Definisci cosa accade quando l’utente interagisce.",
            ],
            ["data", "Dati", "Crea e collega archivi locali per i contenuti."],
            [
              "preview",
              "Preview",
              "Prova l’app esattamente come la userà una persona.",
            ],
            ["plugins", "Plugin", "Aggiungi capacità controllate all’editor."],
            [
              "terminal",
              "Terminale",
              "Esegui comandi avanzati nella cartella locale del progetto.",
            ],
            [
              "settings",
              "Pubblica",
              "Scegli Web, PWA o Android e configura il risultato senza terminale.",
            ],
          ] as [WorkspaceTab, string, string][]
        ).map(([value, label, help]) => (
          <button
            key={value}
            data-help={help}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {label}
            {value === "flow" && project.flows.length > 0 && (
              <span className="badge">{project.flows.length}</span>
            )}
          </button>
        ))}
      </nav>
      <GuideBar project={project} tab={tab} onOpen={setTab} />
      {project.importedSource && (
        <details className="import-source-banner">
          <summary>
            Sorgente importata · {project.importedSource.detected} ·{" "}
            {project.importedSource.files.length} file preservati
          </summary>
          <p>
            {project.importedSource.exactModel
              ? "Il modello Frontend Editor è stato ripristinato integralmente: puoi continuare da canvas, flow, dati e pubblicazione."
              : "Gli elementi riconosciuti sono modificabili sul canvas. Il codice non ancora convertito resta nella cartella original-project dell’export."}
          </p>
          {project.importedSource.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </details>
      )}
      {feedback && (
        <div className="global-feedback" role="status">
          {feedback}
          <button aria-label="Chiudi messaggio" onClick={() => setFeedback("")}>
            ×
          </button>
        </div>
      )}
      {tab === "design" && (
        <div className="editor-grid">
          <aside className="left-panel">
            <PanelTitle eyebrow="Struttura" title="Pagine" />
            <div className="page-list">
              {project.pages.map((page) => (
                <button
                  data-help={`Apri la pagina ${page.name} per modificarla.`}
                  className={page.id === pageId ? "active" : ""}
                  key={page.id}
                  onClick={() => {
                    setPageId(page.id);
                    setSelected([]);
                  }}
                >
                  <span>▱</span>
                  {page.name}
                  <small>{page.path}</small>
                </button>
              ))}
              <button
                data-help="Crea una nuova schermata vuota nel progetto."
                className="dashed"
                onClick={addPage}
              >
                ＋ Aggiungi pagina
              </button>
            </div>
            <PanelTitle eyebrow="Elementi" title="Palette" />
            <label className="palette-search">
              <span className="visually-hidden">Cerca componenti</span>
              <input
                type="search"
                placeholder="Cerca componenti…"
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
              />
            </label>
            <div className="palette">
              {componentTypes
                .filter((type) =>
                  `${type} ${componentHelp[type]} ${componentAliases[type] ?? ""}`
                    .toLowerCase()
                    .includes(paletteQuery.toLowerCase()),
                )
                .map((type) => (
                  <button
                    data-help={componentHelp[type]}
                    key={type}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "application/frontend-component",
                        type,
                      )
                    }
                    onClick={() => addComponent(type)}
                  >
                    <span>{icon(type)}</span>
                    {componentNames[type] ?? type}
                  </button>
                ))}
              {pluginComponents.map((contribution) => (
                <button
                  key={`plugin-${contribution.id}`}
                  data-help={`Componente isolato fornito dal plugin: ${contribution.label}`}
                  onClick={() => addPluginComponent(contribution)}
                >
                  <span>PL</span>
                  {contribution.label}
                </button>
              ))}
              {!pluginComponents.length && !componentTypes.some((type) =>
                `${type} ${componentHelp[type]} ${componentAliases[type] ?? ""}`
                  .toLowerCase()
                  .includes(paletteQuery.toLowerCase()),
              ) && (
                <p className="palette-empty">
                  Nessun componente. Prova “form”, “card” o “grafico”.
                </p>
              )}
            </div>
          </aside>
          <section className="canvas-area">
            <div className="canvas-toolbar">
              <div className="segmented" aria-label="Breakpoint">
                {BREAKPOINTS.map((value) => (
                  <button
                    key={value}
                    className={breakpoint === value ? "active" : ""}
                    onClick={() => setBreakpoint(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
              {activeComponent && canContain(activeComponent) && (
                <div className="canvas-layout-tools" aria-label="Colonne del contenitore">
                  <span>Colonne</span>
                  {[1, 2, 3].map((count) => (
                    <button
                      key={count}
                      aria-label={`${count === 1 ? "Una" : count === 2 ? "Due" : "Tre"} ${count === 1 ? "colonna" : "colonne"}`}
                      onClick={() =>
                        updateComponent((component) => ({
                          ...component,
                          styles: {
                            ...component.styles,
                            [breakpoint]: {
                              ...component.styles[breakpoint],
                              display: "grid",
                              gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
                              gap: "16px",
                            },
                          },
                        }))
                      }
                    >
                      {count}
                    </button>
                  ))}
                </div>
              )}
              {selected.length > 1 && (
                <div
                  className="canvas-arrange-tools"
                  aria-label={`Disponi ${selected.length} elementi selezionati`}
                >
                  <span>{selected.length} selezionati</span>
                  <button aria-label="Allinea a sinistra" onClick={() => arrangeSelection("left")}>&#8676;</button>
                  <button aria-label="Allinea al centro" onClick={() => arrangeSelection("center")}>&#8596;</button>
                  <button aria-label="Allinea a destra" onClick={() => arrangeSelection("right")}>&#8678;</button>
                  <button aria-label="Allinea in alto" onClick={() => arrangeSelection("top")}>&#8613;</button>
                  <button aria-label="Allinea al centro verticale" onClick={() => arrangeSelection("middle")}>&#8597;</button>
                  <button aria-label="Allinea in basso" onClick={() => arrangeSelection("bottom")}>&#8615;</button>
                  <button aria-label="Distribuisci orizzontalmente" onClick={() => arrangeSelection("distribute-x")}>&#8943;</button>
                  <button aria-label="Distribuisci verticalmente" onClick={() => arrangeSelection("distribute-y")}>&#8942;</button>
                </div>
              )}
              <div className="zoom">
                <button
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  aria-label="Riduci zoom"
                >
                  −
                </button>
                <output>{Math.round(zoom * 100)}%</output>
                <button
                  onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
                  aria-label="Aumenta zoom"
                >
                  ＋
                </button>
              </div>
            </div>
            <div className="canvas-scroll">
              <div
                className={`design-canvas canvas-${breakpoint}`}
                style={{
                  transform: `scale(${zoom})`,
                  background: project.theme.tokens.pageBackground ?? "#ffffff",
                  backgroundImage: project.theme.tokens.pageBackgroundImage ?? "none",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                onPointerDown={startMarquee}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const type = event.dataTransfer.getData(
                    "application/frontend-component",
                  ) as EditorComponent["type"];
                  if (componentTypes.includes(type)) addComponent(type);
                }}
              >
                {currentPage && (
                  <style>{canvasStateCss(currentPage.components)}</style>
                )}
                {!currentPage ? (
                  <div className="canvas-empty">
                    <strong>Crea la prima pagina</strong>
                    <button onClick={addPage}>Aggiungi pagina</button>
                  </div>
                ) : currentPage.components.length === 0 ? (
                  <div className="canvas-empty">
                    <strong>Trascina qui un componente</strong>
                    <span>oppure fai clic su un elemento nella palette</span>
                  </div>
                ) : (
                  branches.map((branch) => (
                    <DesignBranch
                      key={branch.component.id}
                      branch={branch}
                      breakpoint={breakpoint}
                      selected={selected}
                      onSelect={(id, multi) =>
                        setSelected((items) =>
                          multi
                            ? items.includes(id)
                              ? items.filter((item) => item !== id)
                              : [...items, id]
                            : [id],
                        )
                      }
                      onContextMenu={(component, bounds, point) => {
                        setSelected([component.id]);
                        setContextMenu({ component, bounds, ...point });
                      }}
                      onMove={reorder}
                      onAdd={addComponent}
                      zoom={zoom}
                      onDirectStyle={applyDirectStyle}
                    />
                  ))
                )}
                {marquee && (
                  <span
                    className="selection-marquee"
                    aria-hidden="true"
                    style={marquee}
                  />
                )}
              </div>
            </div>
          </section>
          <aside className="right-panel">
            <PanelTitle
              eyebrow="Ispezione"
              title={
                selected.length > 1
                  ? `${selected.length} elementi`
                  : (activeComponent?.name ?? "Proprietà")
              }
            />
            {activeComponent ? (
              <>
                {activeProgram && (
                  <ProgramConnections
                    view={activeProgram}
                    onOpenFile={openGeneratedFile}
                    onResolve={(issue) => {
                      if (issue.target !== "codex") return setTab(issue.target);
                      const element = document.querySelector<HTMLElement>(
                        `[data-component-id="${activeComponent.id}"]`,
                      );
                      const bounds = element?.getBoundingClientRect() ?? {
                        x: 24,
                        y: 120,
                        width: 0,
                        height: 0,
                      };
                      setContextMenu({
                        component: activeComponent,
                        bounds: {
                          x: bounds.x,
                          y: bounds.y,
                          width: bounds.width,
                          height: bounds.height,
                        },
                        x: Math.min(bounds.x + bounds.width, window.innerWidth - 250),
                        y: Math.min(bounds.y, window.innerHeight - 330),
                      });
                    }}
                  />
                )}
                <Properties
                  component={activeComponent}
                  components={currentPage!.components}
                  assets={project.assets}
                  breakpoint={breakpoint}
                  onUpdate={updateComponent}
                  onReparent={(parentId) =>
                    reparent(activeComponent.id, parentId)
                  }
                  onWrap={() => wrap(activeComponent.id)}
                  onDuplicate={() => {
                    const copies = selected
                      .map((id) =>
                        currentPage!.components.find((item) => item.id === id),
                      )
                      .filter(Boolean)
                      .map((item) => ({
                        ...item!,
                        id: crypto.randomUUID(),
                        name: `${item!.name} copia`,
                      }));
                    patchPage((items) => [...items, ...copies]);
                    setSelected(copies.map((item) => item.id));
                  }}
                  onDelete={removeSelected}
                />
              </>
            ) : currentPage ? (
              <PageAppearance
                tokens={project.theme.tokens}
                assets={project.assets}
                onChange={(values) =>
                  change({
                    ...project,
                    theme: { tokens: { ...project.theme.tokens, ...values } },
                  })
                }
              />
            ) : (
              <div className="empty-panel compact"><strong>Nessuna pagina</strong></div>
            )}
            <PanelTitle eyebrow="Gerarchia" title="Livelli" />
            <ol className="layers" role="tree">
              {branches.map((branch) => (
                <LayerBranch
                  key={branch.component.id}
                  branch={branch}
                  level={1}
                  selected={selected}
                  onSelect={(id) => setSelected([id])}
                />
              ))}
            </ol>
          </aside>
        </div>
      )}
      {tab === "flow" && (
        <main className="wide-workspace">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Comportamento</p>
              <h1>Flow editor</h1>
              <p>
                Collega eventi e operazioni. I percorsi success ed error sono
                distinti e validati.
              </p>
              {project.flows.length > 0 && (
                <label>
                  Flow attivo
                  <select
                    aria-label="Flow attivo"
                    value={flow?.id}
                    onChange={(event) => {
                      setFlowId(event.target.value);
                      setSelectedFlowNodeId("");
                    }}
                  >
                    {project.flows.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <button onClick={createFlow}>
              {project.state.experience === "landing"
                ? "Crea interazioni landing"
                : project.state.experience === "dashboard"
                  ? "Crea flow dashboard"
                  : "Crea flow dati"}
            </button>
          </div>
          {pluginNodes.length > 0 && (
            <div className="plugin-contribution-bar" aria-label="Nodi forniti dai plugin">
              <span>Plugin</span>
              {pluginNodes.map((contribution) => (
                <button
                  key={contribution.id}
                  className="secondary"
                  onClick={() => addPluginNode(contribution)}
                >
                  + {contribution.label}
                </button>
              ))}
            </div>
          )}
          <Suspense
            fallback={
              <div className="flow-canvas">Caricamento editor flow…</div>
            }
          >
            <FlowEditor
              flow={flow}
              components={project.pages.flatMap((page) => page.components)}
              sources={project.dataSources}
              modules={project.codeModules}
              selectedNodeId={selectedFlowNodeId}
              onNodeSelect={setSelectedFlowNodeId}
              onModulesChange={(codeModules) => change({ ...project, codeModules })}
              onCreateModule={(module, nodeId) => change({
                ...project,
                codeModules: [...project.codeModules, module],
                flows: project.flows.map((item) => item.id === flow?.id ? {
                  ...item,
                  nodes: item.nodes.map((node) => node.id === nodeId ? { ...node, config: { ...node.config, moduleId: module.id } } : node),
                } : item),
              })}
              onChange={(updated) =>
                change((() => {
                  const triggers = updated.nodes.filter((node) => node.type === "event" && ["click", "change", "submit"].includes(node.config.trigger ?? "click") && node.config.componentId);
                  return {
                    ...project,
                    flows: project.flows.map((item) => item.id === updated.id ? updated : item),
                    pages: project.pages.map((page) => ({
                      ...page,
                      components: page.components.map((component) => {
                        const events = Object.fromEntries(Object.entries(component.events).filter(([, flowId]) => flowId !== updated.id));
                        for (const node of triggers) if (node.config.componentId === component.id) events[node.config.trigger ?? "click"] = updated.id;
                        return { ...component, events };
                      }),
                    })),
                  };
                })())
              }
            />
          </Suspense>
          {selectedFlowNode && (
            <FlowNodeConnections
              view={selectedFlowNode}
              onOpenFile={openGeneratedFile}
              onOpenComponent={(componentId) => {
                const owner = project.pages.find((page) =>
                  page.components.some((component) => component.id === componentId),
                );
                if (!owner) return;
                setPageId(owner.id);
                setSelected([componentId]);
                setTab("design");
              }}
              onOpenData={() => setTab("data")}
            />
          )}
          <LogConsole logs={logs} paused={pausedFlow} onResume={() => resumeFlow.current?.()} onSelect={setSelectedFlowNodeId} />
        </main>
      )}
      {tab === "data" && (
        <main className="wide-workspace">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Dati reali, senza scelte oscure</p>
              <h1>Dati & integrazioni</h1>
              <p>
                Scegli dove devono vivere i dati. Frontend Editor configura il
                collegamento e non salva mai password o token nel progetto.
              </p>
            </div>
          </div>
          <section className="data-layout">
            <form
              className="settings-card"
              onSubmit={(event) => {
                event.preventDefault();
                createSource();
              }}
            >
              <h2>Nuova sorgente</h2>
              <fieldset className="provider-choice">
                <legend>Dove vuoi salvare i dati?</legend>
                {(
                  [
                    [
                      "indexeddb",
                      "Su questo dispositivo",
                      "Ideale per prototipi, uso personale e modalità offline. Non richiede account.",
                    ],
                    [
                      "rest",
                      "Servizio già esistente",
                      "Collega un indirizzo API REST. Eventuali credenziali restano nelle variabili d’ambiente.",
                    ],
                    [
                      "generated",
                      "Genera anche il backend",
                      "L’export includerà un piccolo server Node con archivio persistente e API CRUD.",
                    ],
                  ] as const
                ).map(([value, label, help]) => (
                  <label
                    key={value}
                    className={sourceProvider === value ? "active" : ""}
                  >
                    <input
                      type="radio"
                      name="source-provider"
                      checked={sourceProvider === value}
                      onChange={() => {
                        setSourceProvider(value);
                        if (value === "generated")
                          setSourceEndpoint("http://127.0.0.1:8787/records");
                      }}
                    />
                    <strong>{label}</strong>
                    <small>{help}</small>
                  </label>
                ))}
              </fieldset>
              {pluginProviders.length > 0 && (
                <div className="plugin-provider-presets" aria-label="Provider forniti dai plugin">
                  <strong>Provider plugin isolati</strong>
                  {pluginProviders.map((contribution) => (
                    <button
                      type="button"
                      className="secondary"
                      key={contribution.id}
                      onClick={() => {
                        setSourceProvider("rest");
                        setSourceEndpoint(contribution.endpoint);
                        setSourceName(contribution.label);
                        setFeedback(`Preset provider caricato: ${contribution.label}`);
                      }}
                    >
                      Usa {contribution.label}
                    </button>
                  ))}
                </div>
              )}
              <label>
                Nome
                <input
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                />
              </label>
              <label>
                Collezione
                <input
                  value={collection}
                  onChange={(event) => setCollection(event.target.value)}
                />
              </label>
              {sourceProvider !== "indexeddb" && (
                <label>
                  Indirizzo API
                  <input
                    type="url"
                    value={sourceEndpoint}
                    onChange={(event) => setSourceEndpoint(event.target.value)}
                    placeholder="https://api.esempio.it/progetti"
                  />
                  <small>
                    {sourceProvider === "generated"
                      ? "È l’indirizzo predefinito del backend incluso nell’export."
                      : "Non inserire token nell’indirizzo. Verranno richiesti all’avvio come variabile API_TOKEN."}
                  </small>
                </label>
              )}
              <fieldset>
                <legend>Campi dei record</legend>
                <p className="property-help">Definisci le informazioni che vuoi salvare. Il campo <code>id</code> identifica ogni record.</p>
                {schemaFields.map((field) => (
                  <div className="schema-row" key={field.id}>
                    <input aria-label="Nome campo" value={field.name} disabled={field.name === "id"} onChange={(event) => setSchemaFields((fields) => fields.map((item) => item.id === field.id ? { ...item, name: event.target.value } : item))} />
                    <select aria-label={`Tipo campo ${field.name || "senza nome"}`} value={field.type} onChange={(event) => setSchemaFields((fields) => fields.map((item) => item.id === field.id ? { ...item, type: event.target.value as typeof field.type } : item))}>
                      <option value="string">Testo</option><option value="number">Numero</option><option value="boolean">Sì / no</option><option value="datetime">Data e ora</option>
                    </select>
                    <button type="button" className="secondary" disabled={field.name === "id"} aria-label={`Elimina campo ${field.name}`} onClick={() => setSchemaFields((fields) => fields.filter((item) => item.id !== field.id))}>Elimina</button>
                  </div>
                ))}
                <button type="button" className="secondary" onClick={() => setSchemaFields((fields) => [...fields, { id: crypto.randomUUID(), name: `campo${fields.length}`, type: "string" }])}>+ Aggiungi campo</button>
              </fieldset>
              <button type="submit">
                {sourceProvider === "indexeddb"
                  ? "Crea sorgente IndexedDB"
                  : sourceProvider === "generated"
                    ? "Configura backend generato"
                    : "Collega API REST"}
              </button>
            </form>
            <section>
              <h2>Sorgenti configurate</h2>
              {project.dataSources.length === 0 ? (
                <div className="empty-panel">
                  <strong>Nessuna sorgente</strong>
                  <span>Crea il database locale per collegare la lista.</span>
                </div>
              ) : (
                project.dataSources.map((source) => (
                  <button
                    type="button"
                    className={`source-card ${selectedSourceId === source.id ? "selected" : ""}`}
                    aria-pressed={selectedSourceId === source.id}
                    key={source.id}
                    onClick={() => setSelectedSourceId(source.id)}
                  >
                    <span className="provider-icon">
                      {source.provider === "indexeddb"
                        ? "DB"
                        : source.provider === "rest"
                          ? "API"
                          : "BE"}
                    </span>
                    <div>
                      <strong>{source.name}</strong>
                      <span>
                        {source.provider} / {source.collection}
                      </span>
                      <small>
                        {Object.entries(source.schema)
                          .map(([key, value]) => `${key}:${value}`)
                          .join(" · ")}
                      </small>
                    </div>
                    <span className="valid-chip">Valida</span>
                  </button>
                ))
              )}
              {selectedSource && (
                <DataSourceConnections
                  view={selectedSource}
                  onOpenFile={openGeneratedFile}
                  onOpenComponent={(page, component) => {
                    setPageId(page);
                    setSelected([component]);
                    setTab("design");
                  }}
                  onOpenFlow={(id) => {
                    setFlowId(id);
                    setSelectedFlowNodeId("");
                    setTab("flow");
                  }}
                />
              )}
              <div className="asset-manager">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">File del progetto</p>
                    <h2>Asset</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => assetInput.current?.click()}
                  >
                    Carica file
                  </button>
                </div>
                <input
                  ref={assetInput}
                  className="visually-hidden"
                  aria-label="Scegli asset"
                  type="file"
                  accept="image/*,audio/*,video/*"
                  multiple
                  onChange={(event) => void addAssets(event.target.files)}
                />
                {project.assets.length === 0 ? (
                  <div className="empty-panel compact">
                    <strong>Nessun asset</strong>
                    <span>Carica immagini, audio o video fino a 2 MB.</span>
                  </div>
                ) : (
                  <div className="asset-grid">
                    {project.assets.map((asset) => (
                      <article key={asset.id}>
                        <img src={asset.url} alt="" />
                        <span title={asset.name}>{asset.name}</span>
                        <button
                          type="button"
                          aria-label={`Elimina ${asset.name}`}
                          onClick={() =>
                            change({
                              ...project,
                              assets: project.assets.filter(
                                (item) => item.id !== asset.id,
                              ),
                            })
                          }
                        >
                          ×
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </section>
        </main>
      )}
      {tab === "preview" && (
        <main className="preview-workspace">
          <div className="preview-toolbar">
            <div className="segmented">
              {BREAKPOINTS.map((value) => (
                <button
                  key={value}
                  className={breakpoint === value ? "active" : ""}
                  onClick={() => setBreakpoint(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={interactive}
                onChange={(event) => setInteractive(event.target.checked)}
              />
              Modalità interattiva
            </label>
          </div>
          {currentPage ? (
            <PreviewFrame
              project={project}
              pageId={currentPage.id}
              breakpoint={breakpoint}
              interactive={interactive}
              onAdd={addRecord}
              onRunFlow={runPreviewFlow}
              onRefresh={refreshRecords}
              onDashboardAction={dashboardAction}
              captureRequest={
                captureCommand?.tool === "capture_preview"
                  ? captureCommand.id
                  : undefined
              }
              onCapture={(result) =>
                captureCommand &&
                void finishBridgeCommand(captureCommand.id, result)
              }
              onCaptureError={(error) =>
                captureCommand &&
                void finishBridgeCommand(captureCommand.id, undefined, error)
              }
            />
          ) : (
            <div className="empty-panel">
              <strong>Nessuna pagina</strong>
              <span>Crea una pagina per aprire la preview.</span>
            </div>
          )}
          <LogConsole logs={logs} paused={pausedFlow} onResume={() => resumeFlow.current?.()} onSelect={(nodeId) => { setSelectedFlowNodeId(nodeId); setTab("flow"); }} />
        </main>
      )}
      {tab === "settings" && (
        <Suspense
          fallback={
            <main className="wide-workspace">Caricamento pubblicazione…</main>
          }
        >
          <ProjectSettings
            project={project}
            onChange={(next) => change(next)}
          />
        </Suspense>
      )}
      {tab === "plugins" && (
        <main className="wide-workspace">
          <PluginManager
            project={project}
            onChange={change}
            onCatalogChange={refreshPlugins}
          />
        </main>
      )}
      {tab === "terminal" && <TerminalPanel projectId={project.id} />}
      {contextMenu && (
        <div
          className="component-menu"
          role="menu"
          aria-label={`Azioni per ${contextMenu.component.name}`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {[
            "Chiedi a Codex",
            "Crea comportamento",
            "Modifica comportamento",
            "Collega dati",
            "Correggi problema",
            "Migliora componente",
            "Spiega elemento",
          ].map((action) => (
            <button
              role="menuitem"
              key={action}
              onClick={() => askCodex(action)}
            >
              {action === "Chiedi a Codex" ? "⌘" : "›"}
              <span>{action}</span>
            </button>
          ))}
          <button
            role="menuitem"
            className="menu-cancel"
            onClick={() => setContextMenu(undefined)}
          >
            Chiudi menu
          </button>
        </div>
      )}
      {generatedFile && (
        <div className="generated-file-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setGeneratedFile(undefined)}>
          <section role="dialog" aria-modal="true" aria-labelledby="generated-file-title">
            <header><div><p className="eyebrow">Derivato dal grafo</p><h2 id="generated-file-title">{generatedFile.path}</h2></div><button type="button" className="secondary" aria-label="Chiudi file generato" onClick={() => setGeneratedFile(undefined)}>×</button></header>
            <pre><code>{generatedFile.content}</code></pre>
          </section>
        </div>
      )}
      <CodexPanel
        open={Boolean(codexRequest)}
        context={codexRequest?.context}
        suggestedPrompt={codexRequest?.prompt ?? ""}
        captureEvidence={async () => {
          const canvas = document.querySelector<HTMLElement>(".design-canvas");
          if (!canvas) throw new Error("Canvas non disponibile per la prova visuale");
          return captureElement(canvas);
        }}
        onClose={() => setCodexRequest(undefined)}
      />
    </div>
  );
}

function PanelTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="panel-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: "light" | "dark"; onToggle: () => void }) {
  return (
    <button
      className="theme-toggle secondary"
      aria-label={theme === "dark" ? "Usa tema chiaro" : "Usa tema scuro"}
      aria-pressed={theme === "dark"}
      onClick={onToggle}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "◐"}</span>
      <span>{theme === "dark" ? "Chiaro" : "Scuro"}</span>
    </button>
  );
}

function PageAppearance({
  tokens,
  assets,
  onChange,
}: {
  tokens: Project["theme"]["tokens"];
  assets: Project["assets"];
  onChange: (values: Record<string, string>) => void;
}) {
  const background = tokens.pageBackground ?? "#ffffff";
  const image = tokens.pageBackgroundImage ?? "none";
  return (
    <section className="page-appearance" aria-label="Aspetto pagina">
      <div><strong>Sfondo della pagina</strong><small>Vale per canvas, preview ed export.</small></div>
      <div className="palette-swatches" aria-label="Palette pagina">
        {visualPalettes.map((palette) => (
          <button aria-label={`Sfondo pagina ${palette.name}`} key={palette.name} style={{ background: palette.background, color: palette.color }} onClick={() => onChange({ pageBackground: palette.background })}>Aa</button>
        ))}
      </div>
      <label>
        Colore pagina
        <span className="color-field">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(background) ? background : "#ffffff"} onChange={(event) => onChange({ pageBackground: event.target.value })} />
          <input aria-label="Colore pagina valore" value={background} onChange={(event) => onChange({ pageBackground: event.target.value })} />
        </span>
      </label>
      <label>
        Gradiente pagina
        <select value={visualGradients.some(([, value]) => value === image) ? image : "none"} onChange={(event) => onChange({ pageBackgroundImage: event.target.value })}>
          <option value="none">Nessuno</option>
          {visualGradients.map(([name, value]) => <option key={name} value={value}>{name}</option>)}
        </select>
      </label>
      {assets.length > 0 && (
        <label>
          Immagine pagina
          <select value={image.startsWith("url(") ? image : "none"} onChange={(event) => onChange({ pageBackgroundImage: event.target.value })}>
            <option value="none">Nessuna</option>
            {assets.map((asset) => <option key={asset.id} value={`url(${JSON.stringify(asset.url)})`}>{asset.name}</option>)}
          </select>
        </label>
      )}
      <p className="property-help">Seleziona un elemento sul canvas per modificarne colori, testo ed effetti.</p>
    </section>
  );
}

function ProgramConnections({
  view,
  onResolve,
  onOpenFile,
}: {
  view: ComponentProgramView;
  onResolve: (issue: CapabilityIssue) => void;
  onOpenFile: (path: string) => void;
}) {
  return (
    <details className="program-connections" open>
      <summary>Programma collegato</summary>
      <div className="connection-summary">
        <span><strong>{view.events.length}</strong> eventi</span>
        <span><strong>{view.dependentFlows.length}</strong> flow</span>
        <span><strong>{view.dataSources.length}</strong> dati</span>
      </div>
      {view.events.map((event) => (
        <p key={`${event.event}-${event.flowId}`}>
          <code>{event.event}</code> → {event.flowName}
        </p>
      ))}
      {view.dataSources.map((source) => (
        <p key={source.id}>
          <code>{source.provider}</code> → {source.name}
        </p>
      ))}
      {view.issues.length ? (
        <div className="capability-issues" aria-label="Capacità mancanti">
          {view.issues.map((issue) => (
            <article key={issue.id}>
              <strong>{issue.title}</strong>
              <span>{issue.explanation}</span>
              <button className="secondary" onClick={() => onResolve(issue)}>
                {issue.target === "data"
                  ? "Configura archivio"
                  : issue.target === "flow"
                    ? "Configura interazione"
                    : issue.target === "settings"
                      ? "Configura pubblicazione"
                      : "Chiedi a Codex"}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <span className="capability-ready">Capacità collegate</span>
      )}
      <details>
        <summary>File generati</summary>
        {view.generatedFiles.map((file) => <button type="button" className="generated-file-link" key={file} onClick={() => onOpenFile(file)}>{file}</button>)}
      </details>
    </details>
  );
}

function FlowNodeConnections({
  view,
  onOpenComponent,
  onOpenData,
  onOpenFile,
}: {
  view: FlowNodeProgramView;
  onOpenComponent: (componentId: string) => void;
  onOpenData: () => void;
  onOpenFile: (path: string) => void;
}) {
  return (
    <section className="flow-node-connections" aria-label="Dipendenze del nodo">
      <div>
        <p className="eyebrow">Grafo unificato</p>
        <h2>{view.nodeLabel}</h2>
        <span>
          {view.incoming.length} ingressi · {view.outgoing.length} uscite · {view.components.length} elementi · {view.dataSources.length} dati
        </span>
      </div>
      <div className="flow-dependency-list">
        {view.components.map((component) => (
          <button className="secondary" key={component.id} onClick={() => onOpenComponent(component.id)}>
            Apri {component.name} <small>{component.type}</small>
          </button>
        ))}
        {view.dataSources.map((source) => (
          <button className="secondary" key={source.id} onClick={onOpenData}>
            Apri {source.name} <small>{source.provider}</small>
          </button>
        ))}
        {view.errors.map((error) => <span className="requirement-warning" key={error}>{error}</span>)}
      </div>
      <details>
        <summary>Impatto nel codice generato</summary>
        {view.generatedFiles.map((file) => <button type="button" className="generated-file-link" key={file} onClick={() => onOpenFile(file)}>{file}</button>)}
      </details>
    </section>
  );
}

function DataSourceConnections({
  view,
  onOpenComponent,
  onOpenFlow,
  onOpenFile,
}: {
  view: DataSourceProgramView;
  onOpenComponent: (pageId: string, componentId: string) => void;
  onOpenFlow: (flowId: string) => void;
  onOpenFile: (path: string) => void;
}) {
  const provider = view.provider === "indexeddb" ? "Sul dispositivo" : view.provider === "generated" ? "Backend incluso" : "Servizio esterno";
  const capabilityNames: Record<string, string> = {
    get: "legge un record",
    query: "carica elenchi",
    insert: "crea",
    update: "modifica",
    delete: "elimina",
    subscribe: "aggiorna in tempo reale",
  };
  return (
    <section className="data-source-connections" aria-label="Impatto sorgente dati">
      <div>
        <p className="eyebrow">Grafo unificato</p>
        <h3>{view.name}</h3>
        <span>{provider} · archivio {view.collection}</span>
      </div>
      <div className="data-impact-counts">
        <span><strong>{view.components.length}</strong> elementi</span>
        <span><strong>{view.flows.length}</strong> flow</span>
        <span><strong>{view.fields.length}</strong> campi</span>
      </div>
      <div className="capability-chips">
        {view.capabilities.map((item) => <span key={item}>{capabilityNames[item] ?? item}</span>)}
      </div>
      {view.components.map((component) => (
        <button className="secondary" key={component.id} onClick={() => onOpenComponent(component.pageId, component.id)}>
          Apri {component.name} <small>{component.pageName}</small>
        </button>
      ))}
      {view.flows.map((flow) => (
        <button className="secondary" key={flow.id} onClick={() => onOpenFlow(flow.id)}>
          Apri flow {flow.name} <small>{flow.nodes.join(" · ")}</small>
        </button>
      ))}
      {!view.components.length && !view.flows.length && <p className="property-help">Questa sorgente è pronta ma non è ancora collegata a elementi o flow.</p>}
      {view.warnings.map((warning) => <span className="requirement-warning" key={warning}>{warning}</span>)}
      <details>
        <summary>Campi e file generati</summary>
        <p>{view.fields.map((field) => `${field.name}: ${field.type}`).join(" · ")}</p>
        {view.generatedFiles.map((file) => <button type="button" className="generated-file-link" key={file} onClick={() => onOpenFile(file)}>{file}</button>)}
      </details>
    </section>
  );
}

const componentHelp = Object.fromEntries(
  componentTypes.map((type) => [
    type,
    `Aggiungi ${type} alla pagina. Puoi trascinarlo sul canvas oppure fare clic.`,
  ]),
) as Record<EditorComponent["type"], string>;
const componentAliases: Partial<Record<EditorComponent["type"], string>> = {
  grid: "colonne griglia layout",
  stack: "fila colonna gruppo layout",
  container: "sezione contenitore gruppo",
  chart: "grafico statistiche dati",
  sidebar: "barra laterale menu laterale",
  navbar: "navigazione intestazione",
  form: "modulo campi inserimento",
  input: "campo testo",
  select: "scelta tendina filtro",
  upload: "caricamento file allegato",
  image: "immagine foto visuale",
  loader: "caricamento attesa",
  progress: "avanzamento progresso",
  toast: "notifica messaggio",
  modal: "finestra dialogo",
  table: "tabella elenco dati",
  card: "scheda riquadro",
  carousel: "carosello scorrimento",
  accordion: "fisarmonica domande",
};
const componentNames: Partial<Record<EditorComponent["type"], string>> = {
  container: "Sezione",
  stack: "Fila / colonna",
  grid: "Colonne",
};

function GuideBar({
  project,
  tab,
  onOpen,
}: {
  project: Project;
  tab: WorkspaceTab;
  onOpen: (tab: WorkspaceTab) => void;
}) {
  const components = project.pages.reduce(
    (count, page) => count + page.components.length,
    0,
  );
  const steps: {
    done: boolean;
    tab: WorkspaceTab;
    label: string;
    help: string;
  }[] = [
    {
      done: project.pages.length > 0,
      tab: "design",
      label: "Crea una pagina",
      help: "Una pagina è una schermata della tua applicazione.",
    },
    {
      done: components > 0,
      tab: "design",
      label: "Aggiungi elementi",
      help: "Usa la palette per costruire visivamente la schermata.",
    },
    {
      done:
        project.dataSources.length > 0 ||
        project.state.experience === "landing",
      tab: "data",
      label: "Collega i dati",
      help: "Serve solo se la pagina deve salvare o mostrare contenuti dinamici.",
    },
    {
      done: project.flows.length > 0,
      tab: "flow",
      label: "Crea comportamenti",
      help: "Un flow collega un gesto, come un clic, al risultato desiderato.",
    },
    {
      done: false,
      tab: "preview",
      label: "Prova il risultato",
      help: "Apri la preview e usa la pagina come farebbe un visitatore.",
    },
  ];
  const next = steps.find((step) => !step.done) ?? steps.at(-1)!;
  return (
    <aside className="guide-strip" aria-label="Percorso guidato">
      <span className="guide-kicker">Prossimo passo</span>
      <strong>{next.label}</strong>
      <span>{next.help}</span>
      <button
        data-help={`Vai in ${next.tab} per: ${next.label}.`}
        onClick={() => onOpen(next.tab)}
      >
        {tab === next.tab ? "Sei qui" : "Portami lì"}{" "}
        <span aria-hidden="true">→</span>
      </button>
      <details>
        <summary data-help="Mostra tutti i passi e quelli già completati.">
          Percorso
        </summary>
        <ol>
          {steps.map((step) => (
            <li
              className={step.done ? "done" : step === next ? "current" : ""}
              key={step.label}
            >
              <button onClick={() => onOpen(step.tab)}>
                {step.done ? "✓" : "○"} {step.label}
              </button>
            </li>
          ))}
        </ol>
      </details>
    </aside>
  );
}

function HelpOverlay({ children }: { children: React.ReactNode }) {
  const [help, setHelp] = useState<{ text: string; x: number; y: number }>();
  const pressed = useRef(false);
  const show = (target: EventTarget | null, x?: number, y?: number) => {
    const element =
      target instanceof Element
        ? target.closest<HTMLElement>(
            "[data-help],button,input,select,textarea,label,summary",
          )
        : null;
    if (!element) return setHelp(undefined);
    const text =
      element.dataset.help ||
      element.getAttribute("aria-label") ||
      (element instanceof HTMLInputElement ? element.placeholder : "") ||
      element.textContent?.trim();
    if (text)
      setHelp({
        text:
          element.dataset.help ||
          `${text}: passa qui per usare questo controllo.`,
        x: x ?? element.getBoundingClientRect().left,
        y: y ?? element.getBoundingClientRect().bottom,
      });
  };
  return (
    <div
      className="help-surface"
      onPointerDownCapture={() => {
        pressed.current = true;
        setHelp(undefined);
      }}
      onPointerUpCapture={() => {
        pressed.current = false;
      }}
      onPointerCancelCapture={() => {
        pressed.current = false;
      }}
      onPointerOver={(event) =>
        !pressed.current && show(event.target, event.clientX, event.clientY)
      }
      onPointerMove={(event) =>
        !pressed.current && show(event.target, event.clientX, event.clientY)
      }
      onPointerLeave={() => setHelp(undefined)}
      onFocusCapture={(event) => show(event.target)}
      onBlurCapture={() => setHelp(undefined)}
    >
      {children}
      {help && (
        <div
          className="help-tooltip"
          role="tooltip"
          style={{ left: help.x, top: help.y }}
        >
          {help.text}
        </div>
      )}
    </div>
  );
}

type LiveComponentBranch = EditorComponent & {
  children: LiveComponentBranch[];
};

const serializeBranch = ({
  component,
  children,
}: ComponentBranch): LiveComponentBranch => ({
  ...component,
  children: children.map(serializeBranch),
});

function canvasStateCss(components: EditorComponent[]) {
  const declarations = (value: Record<string, unknown>) =>
    Object.entries(value)
      .map(
        ([key, item]) =>
          `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${String(item).replace(/[{};]/g, "")}!important`,
      )
      .join(";");
  return components
    .map((component) => {
      const target = `.canvas-component[data-component-id="${component.id}"]`;
      return `${target}:hover{${declarations(component.states.hover)}}${target}:focus-visible,${target}:focus-within{${declarations(component.states.focus)}}${target}:active{${declarations(component.states.active)}}${target}[aria-disabled="true"]{${declarations(component.states.disabled)}}`;
    })
    .join("\n");
}

function DesignBranch({
  branch,
  breakpoint,
  selected,
  onSelect,
  onMove,
  onContextMenu,
  onAdd,
  zoom,
  onDirectStyle,
}: {
  branch: ComponentBranch;
  breakpoint: Breakpoint;
  selected: string[];
  onSelect: (id: string, multi: boolean) => void;
  onMove: (component: EditorComponent, direction: number) => void;
  onContextMenu: (
    component: EditorComponent,
    bounds: CodexContext["bounds"],
    point: { x: number; y: number },
  ) => void;
  onAdd: (type: EditorComponent["type"], parentId?: string) => void;
  zoom: number;
  onDirectStyle: (
    componentId: string,
    values: Partial<EditorComponent["styles"]["desktop"]>,
  ) => void;
}) {
  const { component, children } = branch;
  return (
    <DesignComponent
      component={component}
      breakpoint={breakpoint}
      selected={selected.includes(component.id)}
      onSelect={(multi) => onSelect(component.id, multi)}
      onMove={(direction) => onMove(component, direction)}
      onContextMenu={(bounds, point) => onContextMenu(component, bounds, point)}
      onDrop={
        canContain(component) ? (type) => onAdd(type, component.id) : undefined
      }
      zoom={zoom}
      onDirectStyle={(values) => onDirectStyle(component.id, values)}
    >
      {children.length > 0
        ? children.map((child) => (
            <DesignBranch
              key={child.component.id}
              branch={child}
              breakpoint={breakpoint}
              selected={selected}
              onSelect={onSelect}
              onMove={onMove}
              onContextMenu={onContextMenu}
              onAdd={onAdd}
              zoom={zoom}
              onDirectStyle={onDirectStyle}
            />
          ))
        : undefined}
    </DesignComponent>
  );
}

function LayerBranch({
  branch,
  level,
  selected,
  onSelect,
}: {
  branch: ComponentBranch;
  level: number;
  selected: string[];
  onSelect: (id: string) => void;
}) {
  return (
    <li
      role="treeitem"
      aria-level={level}
      aria-expanded={branch.children.length ? true : undefined}
    >
      <button
        style={{ paddingLeft: `${8 + (level - 1) * 16}px` }}
        className={selected.includes(branch.component.id) ? "active" : ""}
        onClick={() => onSelect(branch.component.id)}
      >
        <span>{icon(branch.component.type)}</span>
        {branch.component.name}
      </button>
      {branch.children.length > 0 && (
        <ol role="group">
          {branch.children.map((child) => (
            <LayerBranch
              key={child.component.id}
              branch={child}
              level={level + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

function designContent(component: EditorComponent) {
  const label = String(component.props.label || component.name);
  if (component.type === "input")
    return (
      <input tabIndex={-1} placeholder={String(component.props.placeholder)} />
    );
  if (component.type === "button")
    return (
      <button tabIndex={-1} disabled={component.props.disabled === true}>
        {label}
      </button>
    );
  if (component.type === "list")
    return (
      <ul>
        <li>Elemento dinamico</li>
        <li>Stato vuoto e loading collegati</li>
      </ul>
    );
  if (component.type === "title") return <h2>{label}</h2>;
  if (component.type === "image")
    return (
      <div role="img" aria-label={component.accessibility.label}>
        ▧ {label}
      </div>
    );
  if (component.type === "table")
    return (
      <table>
        <caption>{label}</caption>
        <tbody>
          <tr>
            <td>Elemento</td>
            <td>Attivo</td>
          </tr>
        </tbody>
      </table>
    );
  if (component.type === "chart")
    return (
      <figure>
        <svg viewBox="0 0 180 70" aria-label="Grafico">
          <rect x="8" y="34" width="28" height="30" />
          <rect x="48" y="18" width="28" height="46" />
          <rect x="88" y="27" width="28" height="37" />
          <rect x="128" y="8" width="28" height="56" />
        </svg>
        <figcaption>{label}</figcaption>
      </figure>
    );
  if (component.type === "progress")
    return <progress max="100" value={Number(component.props.value || 60)} />;
  if (component.type === "calendar") return <input tabIndex={-1} type="date" />;
  if (component.type === "upload") return <input tabIndex={-1} type="file" />;
  if (component.type === "avatar")
    return <span className="avatar">{label.slice(0, 2).toUpperCase()}</span>;
  if (component.type === "badge") return <span className="chip">{label}</span>;
  if (component.type === "accordion")
    return (
      <details open>
        <summary>{label}</summary>
        <p>{String(component.props.description || "Contenuto espandibile")}</p>
      </details>
    );
  if (canContain(component))
    return (
      <>
        <strong>{label}</strong>
        {component.props.description && (
          <p>{String(component.props.description)}</p>
        )}
      </>
    );
  return <div>{label}</div>;
}

function DesignComponent({
  component,
  breakpoint,
  selected,
  onSelect,
  onMove,
  onContextMenu,
  onDrop,
  zoom,
  onDirectStyle,
  children,
}: {
  component: EditorComponent;
  breakpoint: Breakpoint;
  selected: boolean;
  onSelect: (multi: boolean) => void;
  onMove: (direction: number) => void;
  onContextMenu: (
    bounds: CodexContext["bounds"],
    point: { x: number; y: number },
  ) => void;
  onDrop?: (type: EditorComponent["type"]) => void;
  zoom: number;
  onDirectStyle: (values: Partial<EditorComponent["styles"]["desktop"]>) => void;
  children?: React.ReactNode;
}) {
  const [directPreview, setDirectPreview] = useState<
    Partial<EditorComponent["styles"]["desktop"]>
  >({});
  const [directGuides, setDirectGuides] = useState<{
    x?: number;
    y?: number;
  }>({});
  const directManipulation = useRef(false);
  const style = {
    ...component.styles.desktop,
    ...(breakpoint === "desktop" ? {} : component.styles[breakpoint]),
    ...directPreview,
  };
  // The generated component applies its layout to its real children. In the
  // editor those children sit inside a drop-zone wrapper, so mirror the layout
  // there instead of arranging editor chrome (tag, label and handles).
  const childrenLayoutStyle = canContain(component)
    ? {
        display: style.display,
        flexDirection: style.flexDirection,
        flexWrap: style.flexWrap,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent,
        gridTemplateColumns: style.gridTemplateColumns,
        gap: style.gap,
      }
    : undefined;
  const canvasStyle = canContain(component)
    ? {
        ...style,
        display: "block",
        position: style.position === "static" ? "relative" : style.position,
      }
    : {
        ...style,
        position: style.position === "static" ? "relative" : style.position,
      };
  const content = designContent(component);
  const snap = (value: number) => Math.round(value / 8) * 8;
  const startMove = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    directManipulation.current = true;
    const start = { x: event.clientX, y: event.clientY };
    const movingElement = event.currentTarget.closest<HTMLElement>(
      "[data-component-id]",
    )!;
    const movingBox = movingElement.getBoundingClientRect();
    const candidates = [
      ...(movingElement.closest(".design-canvas")?.querySelectorAll<HTMLElement>(
        "[data-component-id]",
      ) ?? []),
    ]
      .filter(
        (element) =>
          element !== movingElement &&
          !element.classList.contains("selected") &&
          !movingElement.contains(element) &&
          !element.contains(movingElement),
      )
      .map((element) => element.getBoundingClientRect());
    const initial = {
      x: Number.parseFloat(style.left) || 0,
      y: Number.parseFloat(style.top) || 0,
    };
    let next = initial;
    const move = (pointer: PointerEvent) => {
      const delta = {
        x: pointer.clientX - start.x,
        y: pointer.clientY - start.y,
      };
      const proposed = {
        left: movingBox.left + delta.x,
        top: movingBox.top + delta.y,
      };
      const closest = (
        movingAnchors: number[],
        candidateAnchors: number[],
      ) => {
        let match: { correction: number; target: number; anchor: number } | undefined;
        movingAnchors.forEach((anchor) =>
          candidateAnchors.forEach((target) => {
            const correction = target - anchor;
            if (
              Math.abs(correction) <= 6 &&
              (!match || Math.abs(correction) < Math.abs(match.correction))
            )
              match = { correction, target, anchor };
          }),
        );
        return match;
      };
      const xMatch = closest(
        [proposed.left, proposed.left + movingBox.width / 2, proposed.left + movingBox.width],
        candidates.flatMap((box) => [box.left, box.left + box.width / 2, box.right]),
      );
      const yMatch = closest(
        [proposed.top, proposed.top + movingBox.height / 2, proposed.top + movingBox.height],
        candidates.flatMap((box) => [box.top, box.top + box.height / 2, box.bottom]),
      );
      next = {
        x: xMatch
          ? initial.x + (delta.x + xMatch.correction) / zoom
          : snap(initial.x + delta.x / zoom),
        y: yMatch
          ? initial.y + (delta.y + yMatch.correction) / zoom
          : snap(initial.y + delta.y / zoom),
      };
      setDirectGuides({
        x: xMatch
          ? (xMatch.target - (proposed.left + xMatch.correction)) / zoom
          : movingBox.width / zoom / 2,
        y: yMatch
          ? (yMatch.target - (proposed.top + yMatch.correction)) / zoom
          : movingBox.height / zoom / 2,
      });
      setDirectPreview({
        position: style.position === "absolute" ? "absolute" : "relative",
        left: `${next.x}px`,
        top: `${next.y}px`,
        transition: "none",
      });
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      setDirectPreview({});
      setDirectGuides({});
      onDirectStyle({
        position: style.position === "absolute" ? "absolute" : "relative",
        left: `${next.x}px`,
        top: `${next.y}px`,
      });
      window.setTimeout(() => {
        directManipulation.current = false;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };
  const startResize = (event: React.PointerEvent, axis: "x" | "y" | "both") => {
    event.preventDefault();
    event.stopPropagation();
    directManipulation.current = true;
    const box = event.currentTarget.parentElement!.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY };
    const initial = { width: box.width / zoom, height: box.height / zoom };
    let next = initial;
    const move = (pointer: PointerEvent) => {
      next = {
        width: axis === "y" ? initial.width : Math.max(32, snap(initial.width + (pointer.clientX - start.x) / zoom)),
        height: axis === "x" ? initial.height : Math.max(32, snap(initial.height + (pointer.clientY - start.y) / zoom)),
      };
      setDirectPreview({
        ...(axis === "y" ? {} : { width: `${next.width}px` }),
        ...(axis === "x" ? {} : { height: `${next.height}px` }),
        transition: "none",
      });
      setDirectGuides({
        x: next.width / 2,
        y: next.height / 2,
      });
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      setDirectPreview({});
      setDirectGuides({});
      onDirectStyle({
        ...(axis === "y" ? {} : { width: `${next.width}px` }),
        ...(axis === "x" ? {} : { height: `${next.height}px` }),
      });
      window.setTimeout(() => {
        directManipulation.current = false;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };
  return (
    <article
      className={`canvas-component ${selected ? "selected" : ""}`}
      data-component-id={component.id}
      title={String(component.props.tooltip || "") || undefined}
      aria-disabled={component.props.disabled === true || undefined}
      tabIndex={0}
      style={canvasStyle}
      onClick={(event) => {
        event.stopPropagation();
        if (directManipulation.current) return;
        onSelect(event.ctrlKey || event.metaKey);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const box = event.currentTarget.getBoundingClientRect();
        onContextMenu(
          { x: box.x, y: box.y, width: box.width, height: box.height },
          { x: event.clientX, y: event.clientY },
        );
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(event.ctrlKey || event.metaKey);
        }
      }}
      onDragOver={
        onDrop
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
            }
          : undefined
      }
      onDrop={
        onDrop
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              const type = event.dataTransfer.getData(
                "application/frontend-component",
              ) as EditorComponent["type"];
              if (componentTypes.includes(type)) onDrop(type);
            }
          : undefined
      }
      data-testid={`component-${component.type}`}
    >
      <span className="component-tag">{component.type}</span>
      {content}
      {canContain(component) && (
        <div
          className={`component-children ${children ? "has-children" : ""}`}
          style={childrenLayoutStyle}
        >
          <span className="drop-hint">
            {children ? component.name : "Trascina qui gli elementi"}
          </span>
          {children}
        </div>
      )}
      {selected && (
        <div className="component-tools">
          <button
            className="move-handle"
            aria-label="Trascina per spostare"
            onPointerDown={startMove}
            onClick={(event) => event.stopPropagation()}
          >
            ::
          </button>
          <button
            aria-label="Sposta indietro"
            onClick={(event) => {
              event.stopPropagation();
              onMove(-1);
            }}
          >
            ↑
          </button>
          <button
            aria-label="Sposta avanti"
            onClick={(event) => {
              event.stopPropagation();
              onMove(1);
            }}
          >
            ↓
          </button>
        </div>
      )}
      {selected && (
        <>
          <button
            className="resize-handle resize-east"
            aria-label="Ridimensionamento orizzontale"
            onPointerDown={(event) => startResize(event, "x")}
            onClick={(event) => event.stopPropagation()}
          />
          <button
            className="resize-handle resize-south"
            aria-label="Ridimensionamento verticale"
            onPointerDown={(event) => startResize(event, "y")}
            onClick={(event) => event.stopPropagation()}
          />
          <button
            className="resize-handle resize-corner"
            aria-label="Ridimensionamento libero"
            onPointerDown={(event) => startResize(event, "both")}
            onClick={(event) => event.stopPropagation()}
          />
          {Object.keys(directPreview).length > 0 && (
            <>
              <span
                className="alignment-guide guide-horizontal"
                style={{ top: directGuides.y }}
              />
              <span
                className="alignment-guide guide-vertical"
                style={{ left: directGuides.x }}
              />
            </>
          )}
        </>
      )}
    </article>
  );
}

function Properties({
  component,
  components,
  assets,
  breakpoint,
  onUpdate,
  onReparent,
  onWrap,
  onDuplicate,
  onDelete,
}: {
  component: EditorComponent;
  components: EditorComponent[];
  assets: Project["assets"];
  breakpoint: Breakpoint;
  onUpdate: (update: (component: EditorComponent) => EditorComponent) => void;
  onReparent: (parentId?: string) => void;
  onWrap: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  if ((component as { states?: unknown }).states)
    return (
      <VisualProperties
        component={component}
        components={components}
        assets={assets}
        breakpoint={breakpoint}
        onUpdate={onUpdate}
        onReparent={onReparent}
        onWrap={onWrap}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    );
  const style = {
    ...component.styles.desktop,
    ...(breakpoint === "desktop" ? {} : component.styles[breakpoint]),
  };
  const setStyle = (key: keyof typeof style, value: string) =>
    onUpdate((item) => ({
      ...item,
      styles: {
        ...item.styles,
        [breakpoint]: { ...item.styles[breakpoint], [key]: value },
      },
    }));
  const excluded = descendantIds(components, component.id);
  excluded.add(component.id);
  const containers = components.filter(
    (item) => canContain(item) && !excluded.has(item.id),
  );
  return (
    <div className="properties">
      <label>
        Nome
        <input
          value={component.name}
          onChange={(event) =>
            onUpdate((item) => ({ ...item, name: event.target.value }))
          }
        />
      </label>
      <label>
        Testo / etichetta
        <input
          value={String(component.props.label ?? "")}
          onChange={(event) =>
            onUpdate((item) => ({
              ...item,
              props: { ...item.props, label: event.target.value },
              accessibility: {
                ...item.accessibility,
                label: event.target.value,
              },
            }))
          }
        />
      </label>
      {component.type === "input" && (
        <label>
          Placeholder
          <input
            value={String(component.props.placeholder ?? "")}
            onChange={(event) =>
              onUpdate((item) => ({
                ...item,
                props: { ...item.props, placeholder: event.target.value },
              }))
            }
          />
        </label>
      )}
      <label data-help="Scegli il contenitore visuale che deve racchiudere questo elemento. Pagina lo riporta al livello principale.">
        Dentro
        <select
          value={component.parentId ?? ""}
          onChange={(event) => onReparent(event.target.value || undefined)}
        >
          <option value="">Pagina (livello principale)</option>
          {containers.map((item) => (
            <option key={item.id} value={item.id}>
              {componentPath(components, item.id)
                .map((part) => part.name)
                .join(" / ")}
            </option>
          ))}
        </select>
      </label>
      <div className="field-pair">
        <label>
          Larghezza
          <input
            value={style.width}
            onChange={(event) => setStyle("width", event.target.value)}
          />
        </label>
        <label>
          Altezza min.
          <input
            value={style.minHeight}
            onChange={(event) => setStyle("minHeight", event.target.value)}
          />
        </label>
      </div>
      <div className="field-pair">
        <label>
          Posizione X
          <input
            value={style.marginLeft}
            onChange={(event) => setStyle("marginLeft", event.target.value)}
          />
        </label>
        <label>
          Posizione Y
          <input
            value={style.marginTop}
            onChange={(event) => setStyle("marginTop", event.target.value)}
          />
        </label>
      </div>
      <div className="field-pair">
        <label>
          Testo
          <input
            type="color"
            value={style.color}
            onChange={(event) => setStyle("color", event.target.value)}
          />
        </label>
        <label>
          Sfondo
          <input
            type="color"
            value={style.background}
            onChange={(event) => setStyle("background", event.target.value)}
          />
        </label>
      </div>
      <label>
        Raggio bordi
        <input
          value={style.borderRadius}
          onChange={(event) => setStyle("borderRadius", event.target.value)}
        />
      </label>
      <label>
        Visibilità
        <select
          value={style.display}
          onChange={(event) => setStyle("display", event.target.value)}
        >
          <option value="block">Visibile</option>
          <option value="none">Nascosto</option>
        </select>
      </label>
      <div className="button-row">
        <button
          className="secondary"
          data-help="Crea un gruppo verticale attorno a questo elemento, utile per organizzare più elementi insieme."
          onClick={onWrap}
        >
          Raggruppa
        </button>
        <button className="secondary" onClick={onDuplicate}>
          Duplica
        </button>
        <button className="danger" onClick={onDelete}>
          Elimina
        </button>
      </div>
    </div>
  );
}

function LogConsole({ logs, paused, onResume, onSelect }: { logs: FlowLog[]; paused?: { nodeId: string; value: unknown }; onResume?: () => void; onSelect?: (nodeId: string) => void }) {
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const showStep = useCallback((index: number) => {
    const next = Math.max(0, Math.min(logs.length - 1, index));
    setCursor(next);
    if (logs[next]) onSelect?.(logs[next].nodeId);
  }, [logs, onSelect]);
  useEffect(() => {
    if (!playing || !logs.length) return;
    const timer = setInterval(() => setCursor((current) => {
      const next = current < 0 ? 0 : current + 1;
      if (next >= logs.length) { setPlaying(false); return logs.length - 1; }
      onSelect?.(logs[next].nodeId);
      return next;
    }), 650);
    return () => clearInterval(timer);
  }, [playing, logs, onSelect]);
  return (
    <section className="log-console" aria-labelledby="log-title">
      <div>
        <h2 id="log-title">Console flow</h2>
        <span>{logs.length ? `${logs.length} operazioni` : "In attesa"}</span>
      </div>
      {paused && <div className="flow-paused" role="status"><strong>In pausa sul nodo</strong><pre>{JSON.stringify(paused.value, null, 2)}</pre><button type="button" onClick={onResume}>Continua esecuzione</button></div>}
      {logs.length > 0 && <div className="log-replay" role="group" aria-label="Riproduzione flow"><button type="button" className="secondary" onClick={() => showStep(0)}>Dall’inizio</button><button type="button" className="secondary" aria-label="Passo precedente" disabled={cursor <= 0} onClick={() => showStep(cursor - 1)}>←</button><output>{cursor < 0 ? `— / ${logs.length}` : `${cursor + 1} / ${logs.length}`}</output><button type="button" className="secondary" aria-label="Passo successivo" disabled={cursor >= logs.length - 1} onClick={() => showStep(cursor + 1)}>→</button><button type="button" className="secondary" aria-pressed={playing} onClick={() => { setCursor(-1); setPlaying((value) => !value); }}>{playing ? "Ferma replay" : "Riproduci"}</button></div>}
      {logs.length === 0 ? (
        <p>
          Esegui il flow dalla preview per ispezionare input, output ed errori.
        </p>
      ) : (
        <ol>
          {logs.map((log, index) => (
            <li key={`${log.nodeId}-${index}`} className={`${log.level}${cursor === index ? " current" : ""}`}>
              <code>{log.level}</code>
              <button type="button" className="log-step" onClick={() => showStep(index)}>{log.message}{log.value !== undefined && <pre>{JSON.stringify(log.value, null, 2)}</pre>}</button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function icon(type: EditorComponent["type"]) {
  return (
    (
      {
        input: "⌨",
        button: "●",
        list: "≡",
        title: "T",
        text: "¶",
        container: "□",
        stack: "☰",
        grid: "▦",
        image: "▧",
        form: "▤",
        table: "▥",
        modal: "◫",
      } as Partial<Record<EditorComponent["type"], string>>
    )[type] ?? "◇"
  );
}

function addVerticalTemplate(project: Project): Project {
  const page = {
    id: crypto.randomUUID(),
    name: "Attività",
    path: "/",
    components: [
      makeComponent("title"),
      makeComponent("input"),
      makeComponent("button"),
      makeComponent("list"),
    ],
  };
  return { ...project, pages: [page] };
}

function landingFlows(project: Project): {
  flows: Flow[];
  pages: Project["pages"];
} {
  const components = project.pages.flatMap((page) => page.components);
  const primary = components.find(
    (component) => component.props.slot === "hero-primary",
  );
  const secondary = components.find(
    (component) => component.props.slot === "hero-secondary",
  );
  if (!primary || !secondary) throw new Error("Pulsanti landing mancanti");
  const build = (
    name: string,
    componentId: string,
    action: "navigate" | "notify",
    config: Record<string, string>,
  ): Flow => {
    const event = crypto.randomUUID(),
      target = crypto.randomUUID();
    return {
      id: crypto.randomUUID(),
      name,
      nodes: [
        {
          id: event,
          type: "event",
          label: `Click ${name}`,
          position: { x: 80, y: 100 },
          config: { componentId },
        },
        {
          id: target,
          type: action,
          label: action === "navigate" ? "Vai alle feature" : "Mostra notifica",
          position: { x: 330, y: 100 },
          config,
        },
      ],
      edges: [
        { id: crypto.randomUUID(), source: event, target, path: "success" },
      ],
    };
  };
  const flows = [
    build("Esplora feature", primary.id, "navigate", { target: "features" }),
    build("Demo interattiva", secondary.id, "notify", {
      message: "Interactive demo enabled",
    }),
  ];
  const contactName = components.find(
    (component) => component.props.slot === "contact-name",
  );
  const contactSubmit = components.find(
    (component) => component.props.slot === "contact-submit",
  );
  const contactList = components.find(
    (component) => component.props.slot === "contact-list",
  );
  const source = project.dataSources[0];
  if (contactName && contactSubmit && contactList && source) {
    const ids = Array.from({ length: 6 }, () => crypto.randomUUID());
    flows.push({
      id: crypto.randomUUID(),
      name: "Invia richiesta contatto",
      nodes: [
        {
          id: ids[0],
          type: "event",
          label: "Invia form",
          position: { x: 0, y: 100 },
          config: { componentId: contactSubmit.id },
        },
        {
          id: ids[1],
          type: "readInput",
          label: "Leggi contatto",
          position: { x: 180, y: 100 },
          config: { componentId: contactName.id },
        },
        {
          id: ids[2],
          type: "validate",
          label: "Valida richiesta",
          position: { x: 360, y: 100 },
          config: { message: "Completa i campi obbligatori" },
        },
        {
          id: ids[3],
          type: "insert",
          label: "Salva richiesta",
          position: { x: 540, y: 60 },
          config: { sourceId: source.id },
        },
        {
          id: ids[4],
          type: "refresh",
          label: "Aggiorna richieste",
          position: { x: 720, y: 60 },
          config: { componentId: contactList.id },
        },
        {
          id: ids[5],
          type: "notify",
          label: "Mostra errore",
          position: { x: 540, y: 190 },
          config: { level: "error" },
        },
      ],
      edges: [
        {
          id: crypto.randomUUID(),
          source: ids[0],
          target: ids[1],
          path: "success",
        },
        {
          id: crypto.randomUUID(),
          source: ids[1],
          target: ids[2],
          path: "success",
        },
        {
          id: crypto.randomUUID(),
          source: ids[2],
          target: ids[3],
          path: "success",
        },
        {
          id: crypto.randomUUID(),
          source: ids[2],
          target: ids[5],
          path: "error",
        },
        {
          id: crypto.randomUUID(),
          source: ids[3],
          target: ids[4],
          path: "success",
        },
        {
          id: crypto.randomUUID(),
          source: ids[3],
          target: ids[5],
          path: "error",
        },
      ],
    });
  }
  return {
    flows,
    pages: project.pages.map((page) => ({
      ...page,
      components: page.components.map((component) =>
        component.id === primary.id
          ? { ...component, events: { click: flows[0].id } }
          : component.id === secondary.id
            ? { ...component, events: { click: flows[1].id } }
            : component.id === contactSubmit?.id && flows[2]
              ? { ...component, events: { click: flows[2].id } }
              : component,
      ),
    })),
  };
}

function dashboardFlows(project: Project): {
  flows: Flow[];
  pages: Project["pages"];
} {
  const source = project.dataSources[0];
  if (!source) throw new Error("Sorgente dashboard mancante");
  const components = project.pages[0]?.components ?? [];
  const bySlot = (slot: string) =>
    components.find((component) => component.props.slot === slot);
  const make = (
    name: string,
    eventComponent: EditorComponent | undefined,
    action: Flow["nodes"][number]["type"],
    withValidation = false,
  ): Flow => {
    if (!eventComponent)
      throw new Error(`Componente dashboard mancante per ${name}`);
    const event = crypto.randomUUID(),
      validate = crypto.randomUUID(),
      operation = crypto.randomUUID(),
      kpi = crypto.randomUUID(),
      refresh = crypto.randomUUID(),
      success = crypto.randomUUID(),
      error = crypto.randomUUID();
    const nodes: Flow["nodes"] = [
      {
        id: event,
        type: "event",
        label: name,
        position: { x: 0, y: 90 },
        config: { componentId: eventComponent.id },
      },
    ];
    if (withValidation)
      nodes.push({
        id: validate,
        type: "validate",
        label: "Valida campi",
        position: { x: 180, y: 90 },
        config: { message: "Controlla i campi obbligatori" },
      });
    nodes.push({
      id: operation,
      type: action,
      label: action === "query" ? "Carica progetti" : `${name} record`,
      position: { x: withValidation ? 360 : 180, y: 70 },
      config: { sourceId: source.id },
    });
    if (["insert", "update", "delete", "query"].includes(action)) {
      nodes.push(
        {
          id: kpi,
          type: "kpi",
          label: "Aggiorna KPI",
          position: { x: withValidation ? 550 : 370, y: 50 },
          config: {},
        },
        {
          id: refresh,
          type: "refresh",
          label: "Aggiorna tabella",
          position: { x: withValidation ? 730 : 550, y: 50 },
          config: {},
        },
        {
          id: success,
          type: "notify",
          label: "Toast successo",
          position: { x: withValidation ? 910 : 730, y: 50 },
          config: { level: "success" },
        },
        {
          id: error,
          type: "notify",
          label: "Toast errore",
          position: { x: withValidation ? 550 : 370, y: 180 },
          config: { level: "error" },
        },
      );
    }
    const edges: Flow["edges"] = [];
    const first = withValidation ? validate : operation;
    edges.push({
      id: crypto.randomUUID(),
      source: event,
      target: first,
      path: "success",
    });
    if (withValidation) {
      edges.push(
        {
          id: crypto.randomUUID(),
          source: validate,
          target: operation,
          path: "success",
        },
        {
          id: crypto.randomUUID(),
          source: validate,
          target: error,
          path: "error",
        },
      );
    }
    if (["insert", "update", "delete", "query"].includes(action))
      edges.push(
        {
          id: crypto.randomUUID(),
          source: operation,
          target: kpi,
          path: "success",
        },
        {
          id: crypto.randomUUID(),
          source: operation,
          target: error,
          path: "error",
        },
        {
          id: crypto.randomUUID(),
          source: kpi,
          target: refresh,
          path: "success",
        },
        {
          id: crypto.randomUUID(),
          source: refresh,
          target: success,
          path: "success",
        },
      );
    return { id: crypto.randomUUID(), name, nodes, edges };
  };
  const flows = [
    make("Carica progetti", bySlot("projects-table"), "query"),
    make("Crea progetto", bySlot("create"), "insert", true),
    make("Aggiorna progetto", bySlot("project-form"), "update", true),
    make("Elimina progetto", bySlot("detail-modal"), "delete"),
    make("Cerca progetti", bySlot("search"), "filter"),
    make("Filtra stato", bySlot("filter"), "filter"),
    make("Ordina progetti", bySlot("sort"), "sort"),
  ];
  const eventMap = new Map<string, string>([
    ["projects-table", flows[0].id],
    ["create", flows[1].id],
    ["project-form", flows[2].id],
    ["detail-modal", flows[3].id],
    ["search", flows[4].id],
    ["filter", flows[5].id],
    ["sort", flows[6].id],
  ]);
  return {
    flows,
    pages: project.pages.map((page) => ({
      ...page,
      components: page.components.map((component) => ({
        ...component,
        events: eventMap.has(String(component.props.slot))
          ? { change: eventMap.get(String(component.props.slot))! }
          : component.events,
        ...(component.props.slot === "projects-table"
          ? { binding: { sourceId: source.id, state: "data" as const } }
          : {}),
      })),
    })),
  };
}
