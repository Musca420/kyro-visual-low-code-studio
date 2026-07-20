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
  deleteGenericRecord,
  getProject,
  insertProjectRecord,
  insertGenericRecord,
  insertRecord,
  listPlugins,
  listExports,
  listProjectVersions,
  listProjects,
  queryRecords,
  saveProject,
  saveExport,
  updateProjectRecord,
  updateGenericRecord,
  type LocalRecord,
  type ExportRecord,
  type ProjectVersion,
} from "./db";
import { runProjectFlow, type FlowLog } from "./flow";
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
import { ComponentActions } from "./ComponentActions";
import { isComponentEvent, type ActionEventDefinition } from "./actionCatalog";
import { runNativeWeb } from "./nativeCapabilities";
import { clampContextMenuPosition } from "./contextMenu";
import { visualGradients, visualPalettes } from "./visualPresets";
import { importExistingFolder, readFolderFiles } from "./folderImport";
import { TerminalPanel } from "./TerminalPanel";
import { createReusableComponent, instantiateReusableComponent } from "./reusableComponents";
import { createBackup, restoreBackup, serializeBackup } from "./backup";
import { gridColumns, gridFractions, resizeGridColumns } from "./gridLayout";
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
  const [brief, setBrief] = useState("");
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
    if (loading || desktopImportStarted.current) return;
    desktopImportStarted.current = true;
    const readWorkspace = desktop
      ? desktop.readWorkspace()
      : fetch("/api/workspace").then((response) => {
          if (!response.ok) throw new Error(`Workspace unavailable (${response.status})`);
          return response.json() as Promise<DesktopWorkspace | null>;
        });
    void readWorkspace.then(async (workspace) => {
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
      setImportResult(`${workspace.name} is ready on the visual canvas.`);
      onOpen(project.id);
    }).catch((problem) => {
      setError(`Apertura desktop non riuscita: ${problem instanceof Error ? problem.message : String(problem)}`);
      desktopImportStarted.current = false;
    });
  }, [loading, onOpen, onRefresh]);
  const create = async (template: "blank" | "todo" | TemplateId = "blank") => {
    if (!name.trim()) return setError("Enter a project name");
    let project =
      template === "blank" || template === "todo"
        ? createProject(name)
        : createTemplateProject(template, name);
    if (template === "todo") project = addVerticalTemplate(project);
    const packageName = `studio.kyro.${
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 24) || "app"
    }`;
    project = {
      ...project,
      state: {
        ...project.state,
        projectBrief: {
          objective: brief.trim() || `Create ${name.trim()}`,
          audience: "End user",
          platform: target,
        },
      },
      theme: { tokens: { ...project.theme.tokens, primary: themeColor } },
      appConfig: { ...project.appConfig, offline: target !== "web" },
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
    setBrief("");
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
      setImportResult("Backup completo creato: progetti, data sources, plugin, preferenze e conversazioni Codex.");
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
        <div className="brand-mark">K</div>
        <p className="eyebrow">Kyro · Visual Low-Code Studio</p>
        <h1>
          Turn an idea into an app
          <br />
          <span>that truly works.</span>
        </h1>
        <p>
          Design the interface, data, and behavior in one place. Your project
          stays open, readable, and ready to export.
        </p>
      </header>
      <section className="create-card" aria-labelledby="create-title">
        <div>
          <p className="eyebrow">New project</p>
          <h2 id="create-title">Where would you like to start?</h2>
        </div>
        <fieldset className="target-picker">
          <legend>1. Where will it run?</legend>
          {(
            [
              [
                "web",
                "Website",
                "Runs in a browser and can be hosted anywhere.",
              ],
              [
                "pwa",
                "Installable PWA",
                "Installs from the browser and includes offline support.",
              ],
              [
                "android",
                "Android app",
                "Generates a guided Capacitor and Android project.",
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
          2. Primary color
          <span className="color-field">
            <input
              aria-label="Theme color"
              type="color"
              value={themeColor}
              onChange={(event) => setThemeColor(event.target.value)}
            />
            <output>{themeColor}</output>
          </span>
        </label>
        <label>
          3. Project name
          <input
            aria-label="Project name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void create("blank");
            }}
            placeholder="My application"
          />
        </label>
        <label>
          4. What should it help people do?
          <textarea
            aria-label="Project goal"
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            placeholder="Example: organize tasks, appointments, and daily habits, even offline"
          />
          <small>Codex uses this goal as stable context on every page.</small>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="template-heading">
          <p className="template-step">5. Choose a starting point</p>
          <label className="template-search">
            <span className="visually-hidden">Search templates</span>
            <input
              type="search"
              placeholder="Search templates…"
              value={templateQuery}
              onChange={(event) => setTemplateQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="template-grid">
          <button className="template" onClick={() => create("blank")}>
            <span>＋</span>
            <strong>Blank project</strong>
            <small>Start with a clean canvas</small>
          </button>
          <button className="template" onClick={() => create("todo")}>
            <span>✓</span>
            <strong>Task list</strong>
            <small>A working vertical slice</small>
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
          aria-label="Project file to import"
          onChange={(event) => void importFile(event.target.files?.[0])}
        />
        <button
          className="text-button"
          onClick={() => importRef.current?.click()}
        >
          Import a JSON project
        </button>
        <input
          ref={(node) => {
            folderRef.current = node;
            node?.setAttribute("webkitdirectory", "");
          }}
          className="visually-hidden"
          type="file"
          multiple
          aria-label="Project folder to import"
          onChange={(event) => void importFolder(event.target.files)}
        />
        <button
          className="folder-import-button"
          onClick={() => folderRef.current?.click()}
        >
          <strong>Import a website or app folder</strong>
          <span>
            Continue from HTML/CSS, React, Vue, Svelte, or Capacitor. Generated
            dependencies and build folders are ignored automatically.
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
            <p className="eyebrow">Saved on this device</p>
            <h2 id="recent-title">Recent projects</h2>
          </div>
          <div className="backup-actions">
            <label>
              <span className="visually-hidden">Search recent projects</span>
              <input
                type="search"
                placeholder="Search projects…"
                value={projectQuery}
                onChange={(event) => setProjectQuery(event.target.value)}
              />
            </label>
            <button className="secondary" onClick={() => void downloadBackup()}>Create backup</button>
            <button className="secondary" onClick={() => backupRef.current?.click()}>Restore backup</button>
            <input
              ref={backupRef}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              aria-label="Backup file to restore"
              onChange={(event) => void restoreBackupFile(event.target.files?.[0])}
            />
          </div>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : projects.length === 0 ? (
          <div className="empty-panel">
            <strong>No projects yet</strong>
            <span>Name your project and choose a starting point.</span>
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="empty-panel" role="status">
            <strong>No projects found</strong>
            <span>Try another name or clear the search.</span>
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
                    <small>components</small>
                  </span>
                  <strong>{project.name}</strong>
                  <small>
                    Format v{project.formatVersion} · {project.pages.length}{" "}
                    pages
                  </small>
                </button>
                <div className="project-actions">
                  <button onClick={() => duplicate(project)}>Duplicate</button>
                  <button
                    className="danger"
                    onClick={async () => {
                      if (
                        confirm(`Delete “${project.name}” permanently?`)
                      ) {
                        await deleteProject(project.id);
                        await onRefresh();
                      }
                    }}
                  >
                    Delete
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
  const [inspectorMode, setInspectorMode] = useState<"design" | "actions">("design");
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(
    initial.exportConfig.target === "android" ? "mobile" : "desktop",
  );
  const [interactive, setInteractive] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => Math.min(420, Math.max(190, Number(localStorage.getItem("frontend-editor-left-panel")) || 240)));
  const [rightPanelWidth, setRightPanelWidth] = useState(() => Math.min(480, Math.max(230, Number(localStorage.getItem("frontend-editor-right-panel")) || 300)));
  const [canvasDropActive, setCanvasDropActive] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [reusableName, setReusableName] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [history, setHistory] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportRecord[]>([]);
  const [saveState, setSaveState] = useState("Saved");
  const [logs, setLogs] = useState<FlowLog[]>([]);
  const [pausedFlow, setPausedFlow] = useState<{ nodeId: string; value: unknown }>();
  const [sourceName, setSourceName] = useState("Local tasks");
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
  const [pageDraft, setPageDraft] = useState<{ name: string; path: string }>();
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 4_000);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  const [generatedFile, setGeneratedFile] = useState<{ path: string; content: string }>();
  const [flowId, setFlowId] = useState(initial.flows[0]?.id ?? "");
  const [selectedFlowNodeId, setSelectedFlowNodeId] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState(initial.dataSources[0]?.id ?? "");
  const [sourceDraftFields, setSourceDraftFields] = useState<Array<{ id: string; name: string; type: "string" | "number" | "boolean" | "datetime" }>>(() =>
    Object.entries(initial.dataSources[0]?.schema ?? {}).map(([name, type]) => ({ id: crypto.randomUUID(), name, type })),
  );
  const [relationField, setRelationField] = useState("");
  const [relationTarget, setRelationTarget] = useState("");
  const [relationTargetField, setRelationTargetField] = useState("id");
  const [relationKind, setRelationKind] = useState<"one" | "many">("one");
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
  const projectRef = useRef(project);
  const runtimeState = useRef<Record<string, unknown>>({ ...initial.state });
  const resumeFlow = useRef<(() => void) | undefined>(undefined);
  const assetInput = useRef<HTMLInputElement>(null);
  const refreshPlugins = useCallback(
    () => listPlugins().then(setInstalledPlugins),
    [],
  );
  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  useEffect(() => {
    void refreshPlugins();
  }, [refreshPlugins]);
  useEffect(() => {
    localStorage.setItem("frontend-editor-left-panel", String(leftPanelWidth));
    localStorage.setItem("frontend-editor-right-panel", String(rightPanelWidth));
  }, [leftPanelWidth, rightPanelWidth]);
  const setPanelWidth = (side: "left" | "right", value: number) => {
    const next = Math.round(Math.min(side === "left" ? 420 : 480, Math.max(side === "left" ? 190 : 230, value)));
    if (side === "left") setLeftPanelWidth(next);
    else setRightPanelWidth(next);
  };
  const startPanelResize = (side: "left" | "right", event: import("react").PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = side === "left" ? leftPanelWidth : rightPanelWidth;
    const move = (pointer: PointerEvent) => setPanelWidth(side, startWidth + (pointer.clientX - startX) * (side === "left" ? 1 : -1));
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };
  const resizePanelWithKeyboard = (side: "left" | "right", event: import("react").KeyboardEvent<HTMLButtonElement>) => {
    const current = side === "left" ? leftPanelWidth : rightPanelWidth;
    if (event.key === "Home") setPanelWidth(side, side === "left" ? 190 : 230);
    else if (event.key === "End") setPanelWidth(side, side === "left" ? 420 : 480);
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const direction = event.key === "ArrowRight" ? 1 : -1;
      setPanelWidth(side, current + direction * 8 * (side === "left" ? 1 : -1));
    } else return;
    event.preventDefault();
  };
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
  const selectedSourceDefinition = project.dataSources.find((source) => source.id === selectedSourceId);
  const focusedFlowId = useRef("");

  useEffect(() => {
    if (tab !== "flow" || !flow) {
      focusedFlowId.current = "";
      return;
    }
    if (focusedFlowId.current === flow.id) return;
    focusedFlowId.current = flow.id;
    const configuredIds = new Set(
      flow.nodes.map((node) => node.config.componentId).filter(Boolean),
    );
    const owner = project.pages
      .map((page) => ({
        page,
        component: page.components.find(
          (component) =>
            Object.values(component.events).includes(flow.id) ||
            configuredIds.has(component.id),
        ),
      }))
      .find((entry) => entry.component);
    if (!owner) return;
    if (owner.page.id !== pageId) setPageId(owner.page.id);
    setSelected([owner.component!.id]);
  }, [flow, pageId, project.pages, selected, tab]);

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

  const askCodex = (action: string, direct?: { component: EditorComponent; bounds: CodexContext["bounds"]; prompt?: string }) => {
    const source = direct ?? contextMenu;
    if (!source || !currentPage) return;
    const component = source.component;
    const context: CodexContext = {
      projectId: project.id,
      projectName: project.name,
      projectBrief: project.state.projectBrief ?? {
        objective: `Creare ${project.name}`,
        audience: "Utente finale",
        platform: project.exportConfig.target,
      },
      pageId: currentPage.id,
      revision: project.revision,
      viewport: breakpoint,
      componentId: component.id,
      componentName: component.name,
      componentType: component.type,
      treePath: [
        currentPage.name,
        ...componentPath(currentPage.components, component.id).map(
          (item) => item.name,
        ),
      ],
      bounds: source.bounds,
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
      pageComponents: currentPage.components.map(({ id, name, type, parentId, events, binding }) => ({
        id,
        name,
        type,
        ...(parentId ? { parentId } : {}),
        events: Object.keys(events),
        bound: Boolean(binding),
      })),
      pages: project.pages.map(({ id, name, path }) => ({ id, name, path })),
      flowIndex: project.flows.map(({ id, name, nodes }) => ({ id, name, nodeCount: nodes.length })),
      appConfig: project.appConfig,
      exportTarget: project.exportConfig.target,
      themeTokens: project.theme.tokens,
      generatedFiles: [
        "src/main.ts",
        "src/style.css",
        "project.kyro.json",
      ],
      errors: [],
      capabilities: inspectComponentProgram(project, currentPage.id, component.id).issues,
      availableActions: [
        "inspect_project", "inspect_page", "inspect_component", "select_component",
        "add_page", "update_page", "remove_page", "add_component", "move_component",
        "resize_component", "reorder_component", "wrap_component", "remove_component",
        "set_component_property", "set_responsive_style", "set_component_state_style",
        "set_component_accessibility", "set_component_intent", "set_component_event",
        "add_flow", "update_flow", "remove_flow", "add_flow_node", "connect_nodes",
        "create_data_source", "update_data_source", "remove_data_source", "bind_component_data",
        "set_theme_token", "set_app_config", "set_export_config", "apply_editor_transaction",
        "approve_dependency", "revoke_dependency",
        "undo_transaction", "capture_preview", "read_runtime_logs", "run_preview",
        "generate_backend", "export_web", "export_android", "build_android",
      ],
      installedSkills: [
        "kyro-live-context", "kyro-actions", "kyro-native", "kyro-extensions",
        "frontend-editor-live", "frontend-editor-design", "frontend-editor-flow",
        "frontend-editor-data", "frontend-editor-app", "frontend-editor-test",
        "frontend-editor-publish",
      ],
    };
    const prompts: Record<string, string> = {
      "Ask Codex": "",
      "Create behavior": `Create a new behavior for “${component.name}”.`,
      "Edit behavior": `Edit the existing behavior for “${component.name}”.`,
      "Connect data": `Connect “${component.name}” to the data it needs. If a source is missing, offer simple choices before creating it.`,
      "Fix a problem": `Find and fix the problem affecting “${component.name}”.`,
      "Improve component": `Improve the usability, responsive design, and accessibility of “${component.name}”.`,
      "Explain element": `Explain in plain language what “${component.name}” is, what it does, and how I can change it.`,
    };
    setCodexRequest({ context, prompt: direct?.prompt ?? prompts[action] });
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
      setSaveState("Unsaved changes");
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void saveProject(project)
        .then(async () => {
          setSaveState("Saved automatically");
          setVersions(await listProjectVersions(project.id));
        })
        .catch((error) =>
          setSaveState(
            `Save error: ${error instanceof Error ? error.message : String(error)}`,
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
    setSaveState("Unsaved changes");
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
    setSaveState("Unsaved changes");
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
            else {
              const next = applyEditorOperation(project, pageId, {
                type: command.tool,
                args: command.args,
              });
              change(next);
            }
            await fetch(`/api/live/commands/${command.id}`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ok: true }),
            });
            processingCommands.current.delete(command.id);
            setFeedback(
              `Codex change applied · transaction ${command.id.slice(0, 8)}`,
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
  }, [project, pageId, change, undo, finishBridgeCommand]);

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
    if (!currentPage) return setFeedback("Create a page first");
    const component = makeComponent(type);
    if (parentId) component.parentId = parentId;
    patchPage((components) => [...components, component]);
    setSelected([component.id]);
  };
  const addPluginComponent = (
    contribution: Extract<PluginContribution, { kind: "component" }>,
  ) => {
    if (!currentPage) return setFeedback("Create a page first");
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
  const saveReusableComponent = () => {
    if (!currentPage || !selected.length)
      return setFeedback("Select one or more elements to save as a block");
    const included = new Set<string>();
    selected.forEach((id) => {
      included.add(id);
      descendantIds(currentPage.components, id).forEach((childId) => included.add(childId));
    });
    const name = reusableName.trim() || activeComponent?.name || "Blocco riutilizzabile";
    const definition = createReusableComponent(
      name,
      currentPage.components.filter((component) => included.has(component.id)),
    );
    change({
      ...project,
      reusableComponents: [...project.reusableComponents, definition],
    });
    setReusableName("");
    setFeedback(`${name} salvato nei tuoi blocchi`);
  };
  const addReusableComponent = (definitionId: string) => {
    const definition = project.reusableComponents.find((item) => item.id === definitionId);
    if (!definition || !currentPage) return;
    const instance = instantiateReusableComponent(definition);
    patchPage((components) => [...components, instance.wrapper, ...instance.components]);
    setSelected([instance.wrapper.id]);
    setFeedback(`${definition.name} aggiunto come gruppo completamente modificabile`);
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
      setFeedback("Select elements in the same group to align them");
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
    const number = project.pages.length + 1;
    setPageDraft({ name: `Screen ${number}`, path: `/screen-${number}` });
  };
  const createPage = () => {
    if (!pageDraft) return;
    const name = pageDraft.name.trim();
    const path = `/${pageDraft.path.trim().replace(/^\/+|\/+$/g, "")}`;
    if (!name) return setFeedback("Enter a screen name");
    if (project.pages.some((page) => page.path === path)) return setFeedback("Choose a unique route");
    const root = makeComponent("section");
    root.name = `${name} content`;
    root.props = { ...root.props, label: name, description: "Design this screen visually or ask Codex to build it." };
    root.accessibility = { ...root.accessibility, label: `${name} content` };
    root.styles.mobile = { ...root.styles.mobile, width: "100%", minHeight: "640px", padding: "20px 16px", gap: "16px" };
    const page = {
      id: crypto.randomUUID(),
      name,
      path,
      components: [root],
    };
    change({ ...project, pages: [...project.pages, page] });
    setPageId(page.id);
    setSelected([root.id]);
    setPageDraft(undefined);
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
      return setFeedback("Name and collection are required");
    if (
      project.dataSources.some(
        (source) => source.collection === collection.trim(),
      )
    )
      return setFeedback("A source already exists for this collection");
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
          schemaVersion: 1,
          migrations: [],
          relations: [],
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
    setSourceDraftFields(normalizedFields.map((field) => ({ ...field, id: crypto.randomUUID() })));
    setFeedback(
      sourceProvider === "indexeddb"
        ? "IndexedDB source created and schema validated"
        : sourceProvider === "generated"
          ? "Local backend configured: it will be included in the export"
          : "REST API connected. The token stays in an environment variable, not in the project",
    );
  };
  const openSource = (id: string) => {
    const source = project.dataSources.find((item) => item.id === id);
    setSelectedSourceId(id);
    setSourceDraftFields(Object.entries(source?.schema ?? {}).map(([name, type]) => ({ id: crypto.randomUUID(), name, type })));
    setRelationField("");
    setRelationTarget("");
    setRelationTargetField("id");
  };
  const migrateSelectedSource = () => {
    if (!selectedSourceDefinition) return;
    const normalized = sourceDraftFields.map((field) => ({ ...field, name: field.name.trim() }));
    if (normalized.some((field) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(field.name)))
      return setFeedback("Every field must start with a letter and contain only letters, numbers, or underscores");
    if (new Set(normalized.map((field) => field.name)).size !== normalized.length)
      return setFeedback("Field names must be unique");
    if (!normalized.some((field) => field.name === "id")) return setFeedback("The schema must contain an id field");
    const nextSchema = Object.fromEntries(normalized.map((field) => [field.name, field.type]));
    if (JSON.stringify(nextSchema) === JSON.stringify(selectedSourceDefinition.schema)) return setFeedback("The schema is already up to date");
    const version = (selectedSourceDefinition.schemaVersion ?? 1) + 1;
    change({ ...project, dataSources: project.dataSources.map((source) => source.id === selectedSourceDefinition.id ? {
      ...source,
      schema: nextSchema,
      schemaVersion: version,
      migrations: [...(source.migrations ?? []), { version, createdAt: new Date().toISOString(), previousSchema: source.schema, nextSchema }],
    } : source) });
    setSourceDraftFields(normalized);
    setFeedback(`Schema updated to version ${version}. Existing records remain available.`);
  };
  const addRelation = () => {
    if (!selectedSourceDefinition || !relationField || !relationTarget) return setFeedback("Choose the local field and source to connect");
    const target = project.dataSources.find((source) => source.id === relationTarget);
    if (!target || !relationTargetField || !(relationTargetField in target.schema)) return setFeedback("Choose a valid field in the connected source");
    if ((selectedSourceDefinition.relations ?? []).some((relation) => relation.field === relationField)) return setFeedback("This field is already connected");
    change({ ...project, dataSources: project.dataSources.map((source) => source.id === selectedSourceDefinition.id ? { ...source, relations: [...(source.relations ?? []), { id: crypto.randomUUID(), field: relationField, targetSourceId: target.id, targetField: relationTargetField, kind: relationKind }] } : source) });
    setFeedback(`Relation created: ${relationField} → ${target.name}.${relationTargetField}`);
  };
  const removeRelation = (relationId: string) => {
    if (!selectedSourceDefinition) return;
    change({ ...project, dataSources: project.dataSources.map((source) => source.id === selectedSourceDefinition.id ? { ...source, relations: (source.relations ?? []).filter((relation) => relation.id !== relationId) } : source) });
    setFeedback("Relazione rimossa");
  };
  const connectComponentAction = (component: EditorComponent, event: ActionEventDefinition, existingFlowId?: string) => {
    const selectedFlow = existingFlowId ? project.flows.find((item) => item.id === existingFlowId) : undefined;
    const newFlow: Flow | undefined = selectedFlow ? undefined : {
      id: crypto.randomUUID(),
      name: `${component.name} · ${event.label}`,
      nodes: [{
        id: crypto.randomUUID(),
        type: "event",
        label: event.label,
        position: { x: 40, y: 80 },
        config: { trigger: event.id, componentId: component.id },
      }],
      edges: [],
    };
    const targetFlow = selectedFlow ?? newFlow!;
    change({
      ...project,
      flows: newFlow ? [...project.flows, newFlow] : project.flows,
      pages: project.pages.map((page) => page.id === pageId ? {
        ...page,
        components: page.components.map((item) => item.id === component.id ? { ...item, events: { ...item.events, [event.id]: targetFlow.id } } : item),
      } : page),
    });
    setFlowId(targetFlow.id);
    setSelectedFlowNodeId(targetFlow.nodes.find((node) => node.type === "event")?.id ?? "");
    setTab("flow");
    setFeedback(`${event.label} is connected to ${targetFlow.name}`);
  };
  const removeComponentAction = (component: EditorComponent, eventId: string) => {
    change({ ...project, pages: project.pages.map((page) => page.id === pageId ? {
      ...page,
      components: page.components.map((item) => item.id === component.id ? { ...item, events: Object.fromEntries(Object.entries(item.events).filter(([name]) => name !== eventId)) } : item),
    } : page) });
    setFeedback("Action disconnected. The reusable flow was kept.");
  };
  const askCodexForAction = (component: EditorComponent, event?: ActionEventDefinition) => {
    const element = document.querySelector<HTMLElement>(`[data-component-id="${component.id}"]`);
    const rect = element?.getBoundingClientRect();
    askCodex("Ask Codex", {
      component,
      bounds: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : { x: 0, y: 0, width: 0, height: 0 },
      prompt: event ? `When “${event.label}” happens on “${component.name}”, ` : `Create or improve an action for “${component.name}”: `,
    });
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
        return setFeedback("Create the local projects source first");
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
      name: "Add task",
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
          label: "Not empty",
          position: { x: 380, y: 80 },
          config: { message: "Enter a task before adding it" },
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
  const createReusableFlow = () => {
    const id = crypto.randomUUID(), startId = crypto.randomUUID();
    const reusable: Flow = {
      id,
      name: `Reusable flow ${project.flows.length + 1}`,
      nodes: [{ id: startId, type: "event", label: "Input", position: { x: 80, y: 100 }, config: { trigger: "manual" } }],
      edges: [],
    };
    change({ ...project, flows: [...project.flows, reusable] });
    setFlowId(id);
    setSelectedFlowNodeId(startId);
    setFeedback("Reusable flow created. Add steps, then call it from any other flow.");
  };
  const addPluginNode = (
    contribution: Extract<PluginContribution, { kind: "node" }>,
  ) => {
    if (!flow) return setFeedback("Create a flow before adding the plugin node");
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

  const refreshRecords = useCallback(async (sourceId?: string): Promise<LocalRecord[]> => {
    const source = project.dataSources.find((item) => item.id === sourceId) ?? project.dataSources[0];
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
  const persistFlowRun = useCallback(async (activeFlowId: string, startedAt: string, result: FlowLog[]) => {
    const logs = result.map((log) => ({
      nodeId: log.nodeId,
      level: log.level,
      message: log.message,
      durationMs: log.durationMs ?? 0,
    }));
    const run = {
      id: crypto.randomUUID(),
      flowId: activeFlowId,
      startedAt,
      durationMs: logs.reduce((total, log) => total + log.durationMs, 0),
      logs,
    };
    const base = projectRef.current;
    const candidate = {
      ...base,
      flowRuns: [...base.flowRuns, run].slice(-20),
      revision: base.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    projectRef.current = candidate;
    change({ ...base, flowRuns: candidate.flowRuns }, false);
    await saveProject(candidate);
    setSaveState("Saved automatically");
  }, [change]);
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
      const startedAt = new Date().toISOString();
      const result = await runProjectFlow(activeFlow.id, project.flows, {
        input,
        insert: (value, sourceId) => insertRecord(sourceId || source.id, String(value)),
        query: (sourceId) => queryRecords(sourceId || source.id),
        refresh: async () => {
          await queryRecords(source.id);
        },
        runModule: (moduleId, value) => {
          const module = project.codeModules.find((item) => item.id === moduleId);
          if (!module) throw new Error("Advanced module not found");
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
      await persistFlowRun(activeFlow.id, startedAt, result);
      const error = result.find((entry) => entry.level === "error");
      if (error) throw new Error(error.message);
    },
    [project.flows, project.dataSources, project.codeModules, refreshRecords, persistFlowRun],
  );

  const runPreviewFlow = useCallback(async (flowId: string, input: unknown) => {
    const activeFlow = project.flows.find((item) => item.id === flowId);
    const source = project.dataSources[0];
    if (!activeFlow) throw new Error("Flow non trovato");
    let notification: string | undefined, level: string | undefined, navigate: { path: string; mode: "page" | "back" | "url" } | undefined, modal: { componentId: string; operation: "open" | "close" } | undefined, ui: { componentId: string; operation: string; value: string } | undefined;
    setLogs([]);
    const startedAt = new Date().toISOString();
    const result = await runProjectFlow(activeFlow.id, project.flows, {
      input,
      insert: (value, sourceId) => insertGenericRecord(sourceId || source?.id || "", value),
      query: (sourceId) => queryRecords(sourceId || source?.id || ""),
      update: async (value, sourceId) => {
        if (!value || typeof value !== "object") throw new Error("The record to update is not valid");
        const record = value as Record<string, unknown>;
        return updateGenericRecord(sourceId || source?.id || "", String(record.id || ""), record);
      },
      delete: async (value, sourceId) => {
        const id = typeof value === "object" && value ? String((value as Record<string, unknown>).id || "") : String(value || "");
        await deleteGenericRecord(sourceId || source?.id || "", id);
      },
      refresh: async () => { if (source) await refreshRecords(); },
      navigate: (path, mode) => { navigate = { path, mode }; },
      openModal: (componentId, operation) => { modal = { componentId, operation }; },
      updateUI: (componentId, operation, value) => { ui = { componentId, operation, value }; },
      notify: (message, kind) => { notification = message; level = kind; },
      localNotification: (title, body, delayMs) => {
        notification = `Reminder scheduled: ${title}${body ? ` · ${body}` : ""} (${Math.round(delayMs / 1000)} s)`;
        level = "success";
      },
      requestPermission: async (permission) => {
        if (permission === "notifications" && "Notification" in window) return (Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission) === "granted";
        if (permission === "geolocation" && navigator.permissions) return (await navigator.permissions.query({ name: "geolocation" })).state === "granted";
        return false;
      },
      nativeAction: (capability, action, value, config) => runNativeWeb(capability, action, value, config),
      platformInfo: () => ({ platform: "web", version: navigator.userAgent }),
      signOut: () => { notification = "Sessione chiusa nella preview"; level = "success"; },
      runModule: (moduleId, value) => {
        const module = project.codeModules.find((item) => item.id === moduleId);
        if (!module) throw new Error("Advanced module not found");
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
    await persistFlowRun(activeFlow.id, startedAt, result);
    const failure = result.find((entry) => entry.level === "error");
    if (failure) throw new Error(failure.message);
    return { notification, level, navigate, modal, ui };
  }, [project.flows, project.dataSources, project.codeModules, refreshRecords, persistFlowRun]);

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

  const recordAction = useCallback(async (action: "update" | "delete" | "undo", payload?: Record<string, unknown>, sourceId?: string) => {
    const source = project.dataSources.find((item) => item.id === sourceId) ?? project.dataSources[0];
    if (!source) throw new Error("Configura prima la sorgente locale");
    if (action === "update") await updateGenericRecord(source.id, String(payload?.id ?? ""), payload ?? {});
    if (action === "delete") await deleteGenericRecord(source.id, String(payload?.id ?? ""));
    if (action === "undo") await insertGenericRecord(source.id, payload ?? {});
    return queryRecords(source.id);
  }, [project.dataSources]);

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
    const fileName = `${project.name}.kyro.json`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
    await archiveExport(blob, fileName, "project");
  };
  const openGeneratedFile = async (path: string) => {
    try {
      const content = path === "project.kyro.json" || path === "project.frontend-editor.json"
        ? serializeProject(project)
        : path.endsWith("/")
          ? `Cartella generata durante la build: ${path}`
          : (await import("./generator")).generateFiles(project)[path];
      if (!content) throw new Error(`The file ${path} is not produced by this configuration`);
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
  const reparent = (componentId: string, parentId?: string) => {
    if (!currentPage) return;
    const component = currentPage.components.find((item) => item.id === componentId);
    if (!component) return;
    if (parentId && (parentId === componentId || descendantIds(currentPage.components, componentId).has(parentId))) {
      setFeedback("A container cannot be moved inside itself");
      return;
    }
    change((value) =>
      applyEditorOperation(value, pageId, {
        type: "move_component",
        args: { componentId, parentId: parentId || null },
      }),
    );
    setSelected([componentId]);
    setFeedback(parentId ? "Elemento spostato nel contenitore" : "Elemento riportato sulla pagina");
  };
  const moveRelative = (componentId: string, targetId: string, after: boolean) => {
    if (!currentPage || componentId === targetId) return;
    const source = currentPage.components.find((item) => item.id === componentId);
    const target = currentPage.components.find((item) => item.id === targetId);
    if (!source || !target) return;
    const parentId = target.parentId;
    if (parentId && (parentId === componentId || descendantIds(currentPage.components, componentId).has(parentId))) {
      setFeedback("Questo spostamento creerebbe un ciclo");
      return;
    }
    const siblings = currentPage.components.filter((item) => item.parentId === parentId && item.id !== componentId);
    const targetIndex = siblings.findIndex((item) => item.id === targetId);
    change((value) => applyEditorOperation(value, pageId, {
      type: "move_component",
      args: { componentId, parentId: parentId || null, index: targetIndex + (after ? 1 : 0) },
    }));
    setSelected([componentId]);
    setFeedback(after ? "Elemento spostato dopo" : "Elemento spostato prima");
  };
  const wrap = (componentId: string) =>
    change((value) =>
      applyEditorOperation(value, pageId, {
        type: "wrap_component",
        args: { componentId, componentType: "stack", name: "Gruppo" },
      }),
    );

  const commands = [
    ...([
      ["Open Design", "componenti canvas", () => setTab("design")],
      ["Open Flow", "interazioni nodi", () => setTab("flow")],
      ["Open Dati", "database sorgenti", () => setTab("data")],
      ["Open Preview", "prova anteprima", () => setTab("preview")],
      ["Open Pubblica", "export web pwa android", () => setTab("settings")],
      ["Add page", "new screen", addPage],
      ["Undo last change", "undo history", undo],
      ["Ripristina modifica", "redo cronologia", redo],
    ] as Array<[string, string, () => void]>),
    ...componentTypes.map(
      (type) =>
        [
          `Add ${type}`,
          `component element ${type}`,
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
              <span className="visually-hidden">Search commands</span>
              <input
                autoFocus
                type="search"
                placeholder="What would you like to do?"
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setCommandOpen(false);
                }}
              />
            </label>
            <p>Quick commands · Ctrl+K</p>
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
                  No command found. Try “preview”, “page”, or a component name.
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
          aria-label="Close project and return to the dashboard"
        >
          <span>K</span>
        </button>
        <div className="project-title">
          <input
            aria-label="Project name"
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
            aria-label="Undo"
          >
            ↶
          </button>
          <button
            className="icon-button"
            onClick={redo}
            disabled={!future.length}
            aria-label="Redo"
          >
            ↷
          </button>
          <button
            className="icon-button"
            data-help="Search actions and components. Shortcut: Ctrl+K."
            onClick={() => setCommandOpen(true)}
            aria-label="Open quick commands"
          >
            ⌘
          </button>
          <details className="history-menu">
            <summary>Versions {versions.length}</summary>
            <div>
              {versions.slice(0, 8).map((version) => (
                <button
                  key={version.id}
                  className="secondary"
                  onClick={() => {
                    change(version.project);
                    setFeedback(`Restored revision ${version.revision}`);
                  }}
                >
                  Revision {version.revision}
                  <small>{new Date(version.createdAt).toLocaleString("en")}</small>
                </button>
              ))}
            </div>
          </details>
          <details className="history-menu">
            <summary>Exports {exportHistory.length}</summary>
            <div>
              {exportHistory.length === 0 ? (
                <span>No archived exports</span>
              ) : exportHistory.slice(0, 8).map((record) => (
                <button
                  key={record.id}
                  className="secondary"
                  onClick={() => downloadStoredExport(record)}
                >
                  {record.fileName}
                  <small>{new Date(record.createdAt).toLocaleString("en")}</small>
                </button>
              ))}
            </div>
          </details>
          <button className="secondary" onClick={exportProject}>
            Export JSON
          </button>
          <button
            onClick={() =>
              void import("./generator")
                .then(({ downloadGeneratedApp }) =>
                  downloadGeneratedApp(project),
                )
                .then(async ({ blob, fileName }) => {
                  await archiveExport(blob, fileName, project.exportConfig.target);
                  setFeedback("TypeScript app exported as a ZIP and archived");
                })
                .catch((error) =>
                  setFeedback(
                    error instanceof Error ? error.message : String(error),
                  ),
                )
            }
          >
            Export app
          </button>
        </div>
      </header>
      <nav className="workspace-tabs" aria-label="Workspaces">
        {(
          [
            [
              "design",
              "Design",
              "Design pages and components without writing code.",
            ],
            [
              "flow",
              "Flow",
              "Define what happens when a person interacts.",
            ],
            ["data", "Data", "Create and connect local or remote data sources."],
            [
              "preview",
              "Preview",
              "Use the app exactly as a real person will.",
            ],
            ["plugins", "Extensions", "Add reviewed capabilities to Kyro."],
            [
              "terminal",
              "Terminal",
              "Run advanced commands in the local project folder.",
            ],
            [
              "settings",
              "Publish",
              "Configure Web, PWA, or Android without using a terminal.",
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
            Imported source · {project.importedSource.detected} ·{" "}
            {project.importedSource.files.length} preserved files
          </summary>
          <p>
            {project.importedSource.exactModel
              ? "The complete Kyro model was restored: continue in Design, Flow, Data, or Publish."
              : "Recognized elements are editable on the canvas. Unconverted code remains in the export's original-project folder."}
          </p>
          {project.importedSource.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </details>
      )}
      {feedback && (
        <div className="global-feedback" role="status">
          {feedback}
          <button aria-label="Close message" onClick={() => setFeedback("")}>
            ×
          </button>
        </div>
      )}
      {tab === "design" && (
        <div className="editor-grid">
          <aside className="left-panel" style={{ width: leftPanelWidth }}>
            <button
              type="button"
              className="panel-resizer panel-resizer-left"
              role="separator"
              aria-label="Resize elements panel"
              aria-orientation="vertical"
              aria-valuemin={190}
              aria-valuemax={420}
              aria-valuenow={leftPanelWidth}
              onPointerDown={(event) => startPanelResize("left", event)}
              onKeyDown={(event) => resizePanelWithKeyboard("left", event)}
              onDoubleClick={() => setPanelWidth("left", 240)}
            />
            <PanelTitle eyebrow="Structure" title="Pages" />
            <div className="page-list">
              {project.pages.map((page) => (
                <button
                  data-help={`Open ${page.name} to edit it.`}
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
                data-help="Create a new blank screen in the project."
                className="dashed"
                onClick={addPage}
              >
                ＋ Add page
              </button>
            </div>
            <PanelTitle eyebrow="Elements" title="Palette" />
            <label className="palette-search">
              <span className="visually-hidden">Search components</span>
              <input
                type="search"
                placeholder="Search components…"
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
              />
            </label>
            <section className="reusable-library" aria-label="Blocchi riutilizzabili">
              <strong>Your blocks</strong>
              <small>Save a selection and reuse it as an editable group.</small>
              {selected.length > 0 && (
                <div className="reusable-save">
                  <input
                    aria-label="Reusable block name"
                    placeholder={activeComponent?.name ?? "Block name"}
                    value={reusableName}
                    onChange={(event) => setReusableName(event.target.value)}
                  />
                <button type="button" onClick={saveReusableComponent}>Save selection</button>
                </div>
              )}
              {project.reusableComponents.map((definition) => (
                <div className="reusable-entry" key={definition.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("application/frontend-reusable", definition.id)}
                    onClick={() => addReusableComponent(definition.id)}
                  >
                    <span>◇</span>{definition.name}
                    <small>{definition.components.length} elements</small>
                  </button>
                  <button
                    type="button"
                    className="reusable-remove"
                    aria-label={`Remove block ${definition.name}`}
                    onClick={() => change({ ...project, reusableComponents: project.reusableComponents.filter((item) => item.id !== definition.id) })}
                  >×</button>
                </div>
              ))}
            </section>
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
                  No components found. Try “form”, “card”, or “chart”.
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
                <div className="canvas-layout-tools" aria-label="Container columns">
                  <span>Columns</span>
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      key={count}
                      aria-label={`${["Una", "Due", "Tre", "Quattro"][count - 1]} ${count === 1 ? "colonna" : "colonne"}`}
                      onClick={() =>
                        updateComponent((component) => ({
                          ...component,
                          styles: {
                            ...component.styles,
                            [breakpoint]: {
                              ...component.styles[breakpoint],
                              display: "grid",
                              gridTemplateColumns: gridColumns(count),
                              gap: "16px",
                            },
                          },
                        }))
                      }
                    >
                      {count}
                    </button>
                  ))}
                  <button
                    aria-label="Meno colonne"
                    disabled={gridFractions(componentStyle(activeComponent).gridTemplateColumns).length <= 1}
                    onClick={() => {
                      const count = gridFractions(componentStyle(activeComponent).gridTemplateColumns).length;
                      updateComponent((component) => ({
                        ...component,
                        styles: {
                          ...component.styles,
                          [breakpoint]: {
                            ...component.styles[breakpoint],
                            display: "grid",
                            gridTemplateColumns: gridColumns(count - 1),
                            gap: componentStyle(component).gap || "16px",
                          },
                        },
                      }));
                    }}
                  >−</button>
                  <output aria-label="Column count">
                    {gridFractions(componentStyle(activeComponent).gridTemplateColumns).length}
                  </output>
                  <button
                    aria-label="More columns"
                    disabled={gridFractions(componentStyle(activeComponent).gridTemplateColumns).length >= 12}
                    onClick={() => {
                      const count = gridFractions(componentStyle(activeComponent).gridTemplateColumns).length;
                      updateComponent((component) => ({
                        ...component,
                        styles: {
                          ...component.styles,
                          [breakpoint]: {
                            ...component.styles[breakpoint],
                            display: "grid",
                            gridTemplateColumns: gridColumns(count + 1),
                            gap: componentStyle(component).gap || "16px",
                          },
                        },
                      }));
                    }}
                  >＋</button>
                </div>
              )}
              {selected.length > 1 && (
                <div
                  className="canvas-arrange-tools"
                  aria-label={`Disponi ${selected.length} elements selezionati`}
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
                className={`design-canvas canvas-${breakpoint} ${canvasDropActive ? "drop-target" : ""}`}
                style={{
                  transform: `scale(${zoom})`,
                  background: project.theme.tokens.pageBackground ?? "#ffffff",
                  backgroundImage: project.theme.tokens.pageBackgroundImage ?? "none",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                onPointerDown={startMarquee}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (event.target === event.currentTarget) setCanvasDropActive(true);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCanvasDropActive(false);
                }}
                onDrop={(event) => {
                  setCanvasDropActive(false);
                  const existingId = event.dataTransfer.getData("application/frontend-existing");
                  if (existingId) {
                    reparent(existingId);
                    return;
                  }
                  const reusableId = event.dataTransfer.getData("application/frontend-reusable");
                  if (reusableId) {
                    addReusableComponent(reusableId);
                    return;
                  }
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
                    <strong>Create your first page</strong>
                    <button onClick={addPage}>Add page</button>
                  </div>
                ) : currentPage.components.length === 0 ? (
                  <div className="canvas-empty">
                    <strong>Drag a component here</strong>
                    <span>or click an element in the palette</span>
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
                      onReparent={reparent}
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
          <aside className="right-panel" style={{ width: rightPanelWidth }}>
            <button
              type="button"
              className="panel-resizer panel-resizer-right"
              role="separator"
              aria-label="Resize properties panel"
              aria-orientation="vertical"
              aria-valuemin={230}
              aria-valuemax={480}
              aria-valuenow={rightPanelWidth}
              onPointerDown={(event) => startPanelResize("right", event)}
              onKeyDown={(event) => resizePanelWithKeyboard("right", event)}
              onDoubleClick={() => setPanelWidth("right", 300)}
            />
            <PanelTitle
              eyebrow="Inspector"
              title={
                selected.length > 1
                  ? `${selected.length} elements`
                  : (activeComponent?.name ?? "Properties")
              }
            />
            {activeComponent && <div className="inspector-tabs" role="tablist" aria-label="Element inspector">
              <button type="button" role="tab" aria-selected={inspectorMode === "design"} className={inspectorMode === "design" ? "active" : ""} onClick={() => setInspectorMode("design")}>Design</button>
              <button type="button" role="tab" aria-selected={inspectorMode === "actions"} className={inspectorMode === "actions" ? "active" : ""} onClick={() => setInspectorMode("actions")}>Actions <span>{Object.keys(activeComponent.events).length}</span></button>
            </div>}
            {activeComponent ? (
              inspectorMode === "actions" ? <ComponentActions
                component={activeComponent}
                flows={project.flows}
                onCreate={(event) => connectComponentAction(activeComponent, event)}
                onLink={(event, targetFlowId) => connectComponentAction(activeComponent, event, targetFlowId)}
                onOpen={(targetFlowId) => { setFlowId(targetFlowId); setSelectedFlowNodeId(project.flows.find((item) => item.id === targetFlowId)?.nodes.find((node) => node.type === "event")?.id ?? ""); setTab("flow"); }}
                onRemove={(eventId) => removeComponentAction(activeComponent, eventId)}
                onAskCodex={(event) => askCodexForAction(activeComponent, event)}
              /> : <>
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
                        name: `${item!.name} copy`,
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
              <div className="empty-panel compact"><strong>No page</strong></div>
            )}
            <PanelTitle eyebrow="Hierarchy" title="Layers" />
            <ol className="layers" role="tree">
              {branches.map((branch) => (
                <LayerBranch
                  key={branch.component.id}
                  branch={branch}
                  level={1}
                  selected={selected}
                  onSelect={(id) => setSelected([id])}
                  onReparent={reparent}
                  onMoveRelative={moveRelative}
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
              <p className="eyebrow">Behavior</p>
              <h1>Flow editor</h1>
              <p>
                Start from a page and element, choose an event, then connect what
                happens next. Every branch stays visible and reusable.
              </p>
              <div className="flow-context-picker" aria-label="Flow context">
                <label>Page<select value={pageId} onChange={(event) => { setPageId(event.target.value); setSelected([]); setSelectedFlowNodeId(""); }}>
                  {project.pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
                </select></label>
                <label>Element<select value={activeComponent?.id ?? ""} onChange={(event) => { const id = event.target.value; setSelected(id ? [id] : []); const component = currentPage?.components.find((item) => item.id === id); const firstFlow = component && project.flows.find((item) => Object.values(component.events).includes(item.id)); if (firstFlow) { setFlowId(firstFlow.id); setSelectedFlowNodeId(firstFlow.nodes.find((node) => node.type === "event")?.id ?? ""); } }}>
                  <option value="">Page events</option>
                  {currentPage?.components.map((component) => <option key={component.id} value={component.id}>{component.name} · {component.type}</option>)}
                </select></label>
                <label>Event<select disabled={!activeComponent || Object.keys(activeComponent.events).length === 0} value={activeComponent && Object.values(activeComponent.events).includes(flow?.id ?? "") ? flow?.id : ""} onChange={(event) => { const target = project.flows.find((item) => item.id === event.target.value); if (!target) return; setFlowId(target.id); setSelectedFlowNodeId(target.nodes.find((node) => node.type === "event")?.id ?? ""); }}>
                  <option value="">{activeComponent ? "Choose a connected event…" : "Choose an element first"}</option>
                  {activeComponent && Object.entries(activeComponent.events).map(([eventId, targetFlowId]) => <option key={eventId} value={targetFlowId}>{eventId} → {project.flows.find((item) => item.id === targetFlowId)?.name ?? "Missing flow"}</option>)}
                </select></label>
                {activeComponent && <button type="button" className="secondary" onClick={() => { setInspectorMode("actions"); setTab("design"); }}>Add or edit actions</button>}
              </div>
              {project.flows.length > 0 && (
                <label>
                  Active flow
                  <select
                    aria-label="Active flow"
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
            <div className="button-row">
              <button className="secondary" onClick={createReusableFlow}>New reusable flow</button>
              <button onClick={createFlow}>
                {project.state.experience === "landing"
                  ? "Create landing interactions"
                  : project.state.experience === "dashboard"
                    ? "Create dashboard flow"
                    : "Create data flow"}
              </button>
            </div>
          </div>
          {pluginNodes.length > 0 && (
            <div className="plugin-contribution-bar" aria-label="Nodes provided by extensions">
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
              <div className="flow-canvas">Loading Flow editor…</div>
            }
          >
            <FlowEditor
              flow={flow}
              flows={project.flows}
              pages={project.pages}
              components={project.pages.flatMap((page) => page.components)}
              sources={project.dataSources}
              modules={project.codeModules}
              roles={project.appConfig.authentication.roles}
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
                  const triggers = updated.nodes.filter((node) => node.type === "event" && isComponentEvent(node.config.trigger ?? "click") && node.config.componentId);
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
          <FlowRunHistory runs={project.flowRuns} flows={project.flows} onOpen={setLogs} />
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
                Choose where data should live. Kyro configures the
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
              <h2>New source</h2>
              <fieldset className="provider-choice">
                <legend>Where do you want to store the data?</legend>
                {(
                  [
                    [
                      "indexeddb",
                      "On this device",
                      "Ideal for prototypes, personal use, and offline mode. No account required.",
                    ],
                    [
                      "rest",
                      "Existing service",
                      "Connect a REST API address. Credentials remain in environment variables.",
                    ],
                    [
                      "generated",
                      "Generate the backend too",
                      "The export will include a small Node server with persistent storage and a CRUD API.",
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
                <div className="plugin-provider-presets" aria-label="Providers supplied by plugins">
                  <strong>Isolated plugin providers</strong>
                  {pluginProviders.map((contribution) => (
                    <button
                      type="button"
                      className="secondary"
                      key={contribution.id}
                      onClick={() => {
                        setSourceProvider("rest");
                        setSourceEndpoint(contribution.endpoint);
                        setSourceName(contribution.label);
                        setFeedback(`Provider preset loaded: ${contribution.label}`);
                      }}
                    >
                      Use {contribution.label}
                    </button>
                  ))}
                </div>
              )}
              <label>
                Name
                <input
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                />
              </label>
              <label>
                Collection
                <input
                  value={collection}
                  onChange={(event) => setCollection(event.target.value)}
                />
              </label>
              {sourceProvider !== "indexeddb" && (
                <label>
                  API address
                  <input
                    type="url"
                    value={sourceEndpoint}
                    onChange={(event) => setSourceEndpoint(event.target.value)}
                    placeholder="https://api.example.com/projects"
                  />
                  <small>
                    {sourceProvider === "generated"
                      ? "This is the default address of the backend included in the export."
                      : "Do not put tokens in the address. They are read at startup from API_TOKEN."}
                  </small>
                </label>
              )}
              <fieldset>
                <legend>Record fields</legend>
                <p className="property-help">Define the information you want to save. The <code>id</code> field identifies each record.</p>
                {schemaFields.map((field) => (
                  <div className="schema-row" key={field.id}>
                    <input aria-label="Field name" value={field.name} disabled={field.name === "id"} onChange={(event) => setSchemaFields((fields) => fields.map((item) => item.id === field.id ? { ...item, name: event.target.value } : item))} />
                    <select aria-label={`Field type ${field.name || "unnamed"}`} value={field.type} onChange={(event) => setSchemaFields((fields) => fields.map((item) => item.id === field.id ? { ...item, type: event.target.value as typeof field.type } : item))}>
                      <option value="string">Text</option><option value="number">Number</option><option value="boolean">Yes / no</option><option value="datetime">Date and time</option>
                    </select>
                    <button type="button" className="secondary" disabled={field.name === "id"} aria-label={`Delete field ${field.name}`} onClick={() => setSchemaFields((fields) => fields.filter((item) => item.id !== field.id))}>Delete</button>
                  </div>
                ))}
                <button type="button" className="secondary" onClick={() => setSchemaFields((fields) => [...fields, { id: crypto.randomUUID(), name: `field${fields.length}`, type: "string" }])}>+ Add field</button>
              </fieldset>
              <button type="submit">
                {sourceProvider === "indexeddb"
                  ? "Create IndexedDB source"
                  : sourceProvider === "generated"
                    ? "Configure generated backend"
                    : "Connect REST API"}
              </button>
            </form>
            <section>
              <h2>Configured sources</h2>
              {project.dataSources.length === 0 ? (
                <div className="empty-panel">
                  <strong>No sources</strong>
                  <span>Create a local database to connect the list.</span>
                </div>
              ) : (
                project.dataSources.map((source) => (
                  <button
                    type="button"
                    className={`source-card ${selectedSourceId === source.id ? "selected" : ""}`}
                    aria-pressed={selectedSourceId === source.id}
                    key={source.id}
                    onClick={() => openSource(source.id)}
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
                    <span className="valid-chip">v{source.schemaVersion ?? 1}</span>
                  </button>
                ))
              )}
              {selectedSourceDefinition && (
                <section className="source-schema-editor" aria-label="Data source evolution">
                  <div className="section-heading"><div><p className="eyebrow">Safe evolution</p><h3>Schema v{selectedSourceDefinition.schemaVersion ?? 1}</h3></div><span>{selectedSourceDefinition.migrations?.length ?? 0} migrations</span></div>
                  <p className="property-help">Add or change fields without deleting saved records. Every update creates a reproducible version.</p>
                  <fieldset>
                    <legend>Fields in the next version</legend>
                    {sourceDraftFields.map((field) => <div className="schema-row" key={field.id}>
                      <input aria-label="Existing schema field name" value={field.name} disabled={field.name === "id"} onChange={(event) => setSourceDraftFields((fields) => fields.map((item) => item.id === field.id ? { ...item, name: event.target.value } : item))} />
                      <select aria-label={`Existing field type ${field.name}`} value={field.type} onChange={(event) => setSourceDraftFields((fields) => fields.map((item) => item.id === field.id ? { ...item, type: event.target.value as typeof field.type } : item))}><option value="string">Text</option><option value="number">Number</option><option value="boolean">Yes / no</option><option value="datetime">Date and time</option></select>
                      <button type="button" className="secondary" disabled={field.name === "id"} aria-label={`Remove existing field ${field.name}`} onClick={() => setSourceDraftFields((fields) => fields.filter((item) => item.id !== field.id))}>Remove</button>
                    </div>)}
                    <div className="inline-actions"><button type="button" className="secondary" onClick={() => setSourceDraftFields((fields) => [...fields, { id: crypto.randomUUID(), name: `field${fields.length}`, type: "string" }])}>+ New field</button><button type="button" onClick={migrateSelectedSource}>Save new version</button></div>
                  </fieldset>
                  <fieldset>
                    <legend>Connect another source</legend>
                    {project.dataSources.length < 2 ? <p className="property-help">Create a second source to connect, for example, projects and clients.</p> : <>
                      <label>Local field<select aria-label="Local relation field" value={relationField} onChange={(event) => setRelationField(event.target.value)}><option value="">Choose field…</option>{Object.keys(selectedSourceDefinition.schema).map((field) => <option key={field}>{field}</option>)}</select></label>
                      <label>Connected source<select aria-label="Relation source" value={relationTarget} onChange={(event) => { setRelationTarget(event.target.value); setRelationTargetField("id"); }}><option value="">Choose source…</option>{project.dataSources.filter((source) => source.id !== selectedSourceDefinition.id).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
                      <label>Connected field<select aria-label="Relation target field" value={relationTargetField} onChange={(event) => setRelationTargetField(event.target.value)}>{Object.keys(project.dataSources.find((source) => source.id === relationTarget)?.schema ?? { id: "string" }).map((field) => <option key={field}>{field}</option>)}</select></label>
                      <label>Cardinality<select aria-label="Relation cardinality" value={relationKind} onChange={(event) => setRelationKind(event.target.value as "one" | "many")}><option value="one">One item</option><option value="many">Many items</option></select></label>
                      <button type="button" onClick={addRelation}>Create relation</button>
                    </>}
                    {(selectedSourceDefinition.relations ?? []).map((relation) => { const target = project.dataSources.find((source) => source.id === relation.targetSourceId); return <div className="relation-row" key={relation.id}><span><strong>{relation.field}</strong> → {target?.name ?? "Missing source"}.{relation.targetField} · {relation.kind === "one" ? "one" : "many"}</span><button type="button" className="secondary" onClick={() => removeRelation(relation.id)}>Remove</button></div>; })}
                  </fieldset>
                  {(selectedSourceDefinition.migrations?.length ?? 0) > 0 && <details><summary>Schema history</summary><ol>{[...(selectedSourceDefinition.migrations ?? [])].reverse().map((migration) => <li key={migration.version}><strong>Version {migration.version}</strong> · {new Date(migration.createdAt).toLocaleString("en")}</li>)}</ol></details>}
                </section>
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
                  aria-label="Choose asset"
                  type="file"
                  accept="image/*,audio/*,video/*"
                  multiple
                  onChange={(event) => void addAssets(event.target.files)}
                />
                {project.assets.length === 0 ? (
                  <div className="empty-panel compact">
                    <strong>No assets</strong>
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
                          aria-label={`Delete ${asset.name}`}
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
              Interactive mode
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
              onRuntimeLog={(level, message) => setLogs((current) => [...current.slice(-199), { nodeId: "runtime", level, message }])}
              onRefresh={refreshRecords}
              onDashboardAction={dashboardAction}
              onRecordAction={recordAction}
              onNavigatePage={(path) => {
                const destination = project.pages.find((page) => page.path === path);
                if (destination) setPageId(destination.id);
              }}
              onThemeChange={(themeMode) => change((value) => ({ ...value, appConfig: { ...value.appConfig, themeMode } }))}
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
              <strong>No page</strong>
              <span>Create a page to open Preview.</span>
            </div>
          )}
          <FlowRunHistory runs={project.flowRuns} flows={project.flows} onOpen={setLogs} />
          <LogConsole logs={logs} paused={pausedFlow} onResume={() => resumeFlow.current?.()} onSelect={(nodeId) => { setSelectedFlowNodeId(nodeId); setTab("flow"); }} />
        </main>
      )}
      {tab === "settings" && (
        <Suspense
          fallback={
            <main className="wide-workspace">Loading publishing tools…</main>
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
      {pageDraft && (
        <div className="tutorial-backdrop" role="presentation" onMouseDown={() => setPageDraft(undefined)}>
          <form
            className="tutorial-dialog page-wizard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="page-wizard-title"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); createPage(); }}
          >
            <button type="button" className="tutorial-close" aria-label="Close page wizard" onClick={() => setPageDraft(undefined)}>×</button>
            <span className="guide-kicker">New screen</span>
            <h2 id="page-wizard-title">What is this screen for?</h2>
            <label>Screen name<input autoFocus aria-label="Screen name" value={pageDraft.name} onChange={(event) => setPageDraft({ ...pageDraft, name: event.target.value })} /></label>
            <label>Route<input aria-label="Screen route" value={pageDraft.path} onChange={(event) => setPageDraft({ ...pageDraft, path: event.target.value })} /></label>
            <small>Kyro adds an editable screen container so you can start dragging elements or ask Codex immediately.</small>
            <div className="inline-actions"><button type="button" className="secondary" onClick={() => setPageDraft(undefined)}>Cancel</button><button type="submit">Create screen</button></div>
          </form>
        </div>
      )}
      {contextMenu && (
        <div
          className="component-menu"
          role="menu"
          aria-label={`Actions for ${contextMenu.component.name}`}
          style={{
            left: clampContextMenuPosition(contextMenu.x, contextMenu.y, window.innerWidth, window.innerHeight).x,
            top: clampContextMenuPosition(contextMenu.x, contextMenu.y, window.innerWidth, window.innerHeight).y,
          }}
        >
          {[
            "Ask Codex",
            "Create behavior",
            "Edit behavior",
            "Connect data",
            "Fix a problem",
            "Improve component",
            "Explain element",
          ].map((action) => (
            <button
              role="menuitem"
              key={action}
              onClick={() => askCodex(action)}
            >
              {action === "Ask Codex" ? "⌘" : "›"}
              <span>{action}</span>
            </button>
          ))}
          <button
            role="menuitem"
            className="menu-cancel"
            onClick={() => setContextMenu(undefined)}
          >
            Close menu
          </button>
        </div>
      )}
      {generatedFile && (
        <div className="generated-file-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setGeneratedFile(undefined)}>
          <section role="dialog" aria-modal="true" aria-labelledby="generated-file-title">
            <header><div><p className="eyebrow">Derived from the graph</p><h2 id="generated-file-title">{generatedFile.path}</h2></div><button type="button" className="secondary" aria-label="Close generated file" onClick={() => setGeneratedFile(undefined)}>×</button></header>
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
          const nativeCapture = window.frontendEditorDesktop?.captureRegion;
          if (nativeCapture) {
            const rect = canvas.getBoundingClientRect();
            return nativeCapture({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
          }
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
      aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
      aria-pressed={theme === "dark"}
      onClick={onToggle}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "◐"}</span>
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
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
    <section className="page-appearance" aria-label="Page appearance">
      <div><strong>Page background</strong><small>Shared by canvas, preview and export.</small></div>
      <div className="palette-swatches" aria-label="Page palette">
        {visualPalettes.map((palette) => (
          <button aria-label={`${palette.name} page background`} key={palette.name} style={{ background: palette.background, color: palette.color }} onClick={() => onChange({ pageBackground: palette.background })}>Aa</button>
        ))}
      </div>
      <label>
        Page color
        <span className="color-field">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(background) ? background : "#ffffff"} onChange={(event) => onChange({ pageBackground: event.target.value })} />
          <input aria-label="Page color value" value={background} onChange={(event) => onChange({ pageBackground: event.target.value })} />
        </span>
      </label>
      <label>
        Page gradient
        <select value={visualGradients.some(([, value]) => value === image) ? image : "none"} onChange={(event) => onChange({ pageBackgroundImage: event.target.value })}>
          <option value="none">None</option>
          {visualGradients.map(([name, value]) => <option key={name} value={value}>{name}</option>)}
        </select>
      </label>
      {assets.length > 0 && (
        <label>
          Immagine pagina
          <select value={image.startsWith("url(") ? image : "none"} onChange={(event) => onChange({ pageBackgroundImage: event.target.value })}>
            <option value="none">None</option>
            {assets.map((asset) => <option key={asset.id} value={`url(${JSON.stringify(asset.url)})`}>{asset.name}</option>)}
          </select>
        </label>
      )}
      <p className="property-help">Select an element on the canvas to edit its colors, text, and effects.</p>
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
      <summary>Connected program</summary>
      <div className="connection-summary">
        <span><strong>{view.events.length}</strong> events</span>
        <span><strong>{view.dependentFlows.length}</strong> flow</span>
        <span><strong>{view.dataSources.length}</strong> data sources</span>
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
        <div className="capability-issues" aria-label="Missing capabilities">
          {view.issues.map((issue) => (
            <article key={issue.id}>
              <strong>{issue.title}</strong>
              <span>{issue.explanation}</span>
              {issue.plan && (
                <details className="capability-plan">
                  <summary>Compare solutions</summary>
                  <div>
                    <strong>What is required</strong>
                    <ul>{issue.plan.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
                    <strong>Alternatives</strong>
                    <ul>{issue.plan.alternatives.map((item) => <li key={item}>{item}</li>)}</ul>
                    <p>{issue.plan.costNote}</p>
                    {issue.plan.confirmationRequired && <em>No account, cost, or secret will be configured without your confirmation.</em>}
                  </div>
                </details>
              )}
              <button className="secondary" onClick={() => onResolve(issue)}>
                {issue.target === "data"
                  ? "Configure storage"
                  : issue.target === "flow"
                    ? "Configure interaction"
                    : issue.target === "settings"
                      ? "Configure publishing"
                      : "Ask Codex"}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <span className="capability-ready">Capabilities connected</span>
      )}
      <details>
        <summary>Generated files</summary>
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
          {view.incoming.length} inputs · {view.outgoing.length} outputs · {view.components.length} elements · {view.dataSources.length} data sources
        </span>
      </div>
      <div className="flow-dependency-list">
        {view.components.map((component) => (
          <button className="secondary" key={component.id} onClick={() => onOpenComponent(component.id)}>
            Open {component.name} <small>{component.type}</small>
          </button>
        ))}
        {view.dataSources.map((source) => (
          <button className="secondary" key={source.id} onClick={onOpenData}>
            Open {source.name} <small>{source.provider}</small>
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
    <section className="data-source-connections" aria-label="Impatto sorgente data sources">
      <div>
        <p className="eyebrow">Grafo unificato</p>
        <h3>{view.name}</h3>
        <span>{provider} · archivio {view.collection}</span>
      </div>
      <div className="data-impact-counts">
        <span><strong>{view.components.length}</strong> elements</span>
        <span><strong>{view.flows.length}</strong> flow</span>
        <span><strong>{view.fields.length}</strong> campi</span>
      </div>
      <div className="capability-chips">
        {view.capabilities.map((item) => <span key={item}>{capabilityNames[item] ?? item}</span>)}
      </div>
      {view.components.map((component) => (
        <button className="secondary" key={component.id} onClick={() => onOpenComponent(component.pageId, component.id)}>
          Open {component.name} <small>{component.pageName}</small>
        </button>
      ))}
      {view.flows.map((flow) => (
        <button className="secondary" key={flow.id} onClick={() => onOpenFlow(flow.id)}>
          Open flow {flow.name} <small>{flow.nodes.join(" · ")}</small>
        </button>
      ))}
      {!view.components.length && !view.flows.length && <p className="property-help">This source is ready but is not connected to any elements or flows yet.</p>}
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
    `Add ${type} to the page. Drag it onto the canvas or click it.`,
  ]),
) as Record<EditorComponent["type"], string>;
const componentAliases: Partial<Record<EditorComponent["type"], string>> = {
  grid: "colonne griglia layout",
  stack: "fila colonna gruppo layout",
  container: "sezione contenitore gruppo",
  chart: "grafico statistiche data sources",
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
  table: "tabella elenco data sources",
  card: "scheda riquadro",
  carousel: "carosello scorrimento",
  accordion: "fisarmonica domande",
};
const componentNames: Partial<Record<EditorComponent["type"], string>> = {
  container: "Section",
  stack: "Row / column",
  grid: "Columns",
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
  const [tutorialOpen, setTutorialOpen] = useState(false);
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
      label: "Create a page",
      help: "A page is one screen of your application.",
    },
    {
      done: components > 0,
      tab: "design",
      label: "Add elements",
      help: "Use the palette to build the screen visually.",
    },
    {
      done:
        project.dataSources.length > 0 ||
        project.state.experience === "landing",
      tab: "data",
      label: "Connect data",
      help: "Only needed when the page saves or shows dynamic content.",
    },
    {
      done: project.flows.length > 0,
      tab: "flow",
      label: "Create behavior",
      help: "A flow connects a gesture, such as a click, to its result.",
    },
    {
      done: false,
      tab: "preview",
      label: "Try the result",
      help: "Open Preview and use the page like a real visitor.",
    },
  ];
  const next = steps.find((step) => !step.done) ?? steps.at(-1)!;
  return (
    <aside className="guide-strip" aria-label="Guided path">
      <span className="guide-kicker">Next step</span>
      <strong>{next.label}</strong>
      <span>{next.help}</span>
      <button
        data-help={`Open ${next.tab} to: ${next.label}.`}
        onClick={() => onOpen(next.tab)}
      >
        {tab === next.tab ? "You are here" : "Take me there"}{" "}
        <span aria-hidden="true">→</span>
      </button>
      <button className="secondary" onClick={() => setTutorialOpen(true)}>
        Full tutorial
      </button>
      <details>
        <summary data-help="Show every step and what is already complete.">
          Path
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
      {tutorialOpen && (
        <div className="tutorial-backdrop" role="presentation" onMouseDown={() => setTutorialOpen(false)}>
          <section className="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="tutorial-close" aria-label="Close tutorial" onClick={() => setTutorialOpen(false)}>×</button>
            <span className="guide-kicker">From blank canvas to finished project</span>
            <h2 id="tutorial-title">Build visually, like Canva</h2>
            <ol>
              <li><strong>Add.</strong> Drag an element from the left palette onto the page.</li>
              <li><strong>Move.</strong> Select it and drag it directly on the canvas. Guides help you align it.</li>
              <li><strong>Resize.</strong> Use the handles on the right, bottom, or corner.</li>
              <li><strong>Customize.</strong> Use the Design panel to choose colors, text, spacing, and responsive layout.</li>
              <li><strong>Bring it to life.</strong> Open Flow to connect clicks, data, and actions, or right-click and choose “Ask Codex”.</li>
              <li><strong>Finish.</strong> Try desktop and mobile in Preview, then export a standalone project.</li>
            </ol>
            <button autoFocus onClick={() => setTutorialOpen(false)}>Start on the canvas</button>
          </section>
        </div>
      )}
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
  onReparent,
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
  onReparent: (componentId: string, parentId?: string) => void;
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
        canContain(component)
          ? (type, existingId) => existingId ? onReparent(existingId, component.id) : type && onAdd(type, component.id)
          : undefined
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
              onReparent={onReparent}
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
  onReparent,
  onMoveRelative,
}: {
  branch: ComponentBranch;
  level: number;
  selected: string[];
  onSelect: (id: string) => void;
  onReparent: (componentId: string, parentId?: string) => void;
  onMoveRelative: (componentId: string, targetId: string, after: boolean) => void;
}) {
  const [dropMode, setDropMode] = useState<"before" | "inside" | "after">();
  const acceptsChildren = canContain(branch.component);
  return (
    <li
      role="treeitem"
      aria-level={level}
      aria-expanded={branch.children.length ? true : undefined}
    >
      <button
        draggable
        style={{ paddingLeft: `${8 + (level - 1) * 16}px` }}
        className={`${selected.includes(branch.component.id) ? "active" : ""} ${dropMode ? `drop-${dropMode}` : ""}`}
        onClick={() => onSelect(branch.component.id)}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("application/frontend-existing", branch.component.id);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const ratio = (event.clientY - event.currentTarget.getBoundingClientRect().top) / event.currentTarget.getBoundingClientRect().height;
          setDropMode(ratio < 0.28 ? "before" : ratio > 0.72 || !acceptsChildren ? "after" : "inside");
        }}
        onDragLeave={() => setDropMode(undefined)}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const mode = dropMode ?? (acceptsChildren ? "inside" : "after");
          setDropMode(undefined);
          const existingId = event.dataTransfer.getData("application/frontend-existing");
          if (!existingId) return;
          if (mode === "inside") onReparent(existingId, branch.component.id);
          else onMoveRelative(existingId, branch.component.id, mode === "after");
        }}
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
              onReparent={onReparent}
              onMoveRelative={onMoveRelative}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

function designContent(component: EditorComponent) {
  const label = String(component.props.label ?? component.name);
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
  if (component.type === "signature")
    return <div role="img" aria-label={component.accessibility.label} style={{ minHeight: 120, borderBottom: "2px solid currentColor", opacity: 0.75 }}>✍ {label}</div>;
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
    return <progress max={Number(component.props.max || 100)} value={Number(component.props.value || 60)} />;
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
        {label && <strong>{label}</strong>}
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
  onDrop?: (type?: EditorComponent["type"], existingId?: string) => void;
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
  const [dropActive, setDropActive] = useState(false);
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
  const fractions = style.display === "grid" ? gridFractions(style.gridTemplateColumns) : [];
  const resizeColumn = (boundary: number, event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const zone = event.currentTarget.parentElement!.getBoundingClientRect();
    const start = event.clientX;
    const initial = style.gridTemplateColumns;
    let next = initial;
    const move = (pointer: PointerEvent) => {
      next = resizeGridColumns(initial, boundary, (pointer.clientX - start) / zone.width);
      setDirectPreview({ gridTemplateColumns: next, transition: "none" });
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      setDirectPreview({});
      onDirectStyle({ gridTemplateColumns: next });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };
  const nudgeColumn = (boundary: number, direction: number) =>
    onDirectStyle({
      gridTemplateColumns: resizeGridColumns(style.gridTemplateColumns, boundary, direction * 0.025),
    });
  return (
    <article
      className={`canvas-component ${selected ? "selected" : ""} ${dropActive ? "drop-target" : ""}`}
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
              setDropActive(true);
            }
          : undefined
      }
      onDragLeave={
        onDrop
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropActive(false);
            }
          : undefined
      }
      onDrop={
        onDrop
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              setDropActive(false);
              const existingId = event.dataTransfer.getData("application/frontend-existing");
              if (existingId) {
                onDrop(undefined, existingId);
                return;
              }
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
            {children ? component.name : "Drop elements here"}
          </span>
          {children}
          {selected && fractions.slice(0, -1).map((_, index) => {
            const position = fractions.slice(0, index + 1).reduce((sum, value) => sum + value, 0) /
              fractions.reduce((sum, value) => sum + value, 0) * 100;
            return (
              <button
                key={index}
                className="grid-divider-handle"
                style={{ left: `${position}%` }}
                aria-label={`Ridimensiona colonne ${index + 1} e ${index + 2}`}
                title="Trascina per cambiare la larghezza delle colonne"
                onPointerDown={(event) => resizeColumn(index, event)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  event.stopPropagation();
                  nudgeColumn(index, event.key === "ArrowLeft" ? -1 : 1);
                }}
              />
            );
          })}
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
        Name
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
      <label data-help="Choose the visual container for this element. Page moves it back to the top level.">
        Dentro
        <select
          value={component.parentId ?? ""}
          onChange={(event) => onReparent(event.target.value || undefined)}
        >
          <option value="">Page (top level)</option>
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
          Background
          <input
            type="color"
            value={style.background}
            onChange={(event) => setStyle("background", event.target.value)}
          />
        </label>
      </div>
      <label>
        Corner radius
        <input
          value={style.borderRadius}
          onChange={(event) => setStyle("borderRadius", event.target.value)}
        />
      </label>
      <label>
        Visibility
        <select
          value={style.display}
          onChange={(event) => setStyle("display", event.target.value)}
        >
          <option value="block">Visible</option>
          <option value="none">Hidden</option>
        </select>
      </label>
      <div className="button-row">
        <button
          className="secondary"
          data-help="Create a vertical group around this element to organize several elements together."
          onClick={onWrap}
        >
          Group
        </button>
        <button className="secondary" onClick={onDuplicate}>
          Duplicate
        </button>
        <button className="danger" onClick={onDelete}>
          Delete
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
        <h2 id="log-title">Flow console</h2>
        <span>{logs.length ? `${logs.length} operations` : "Waiting"}</span>
      </div>
      {paused && <div className="flow-paused" role="status"><strong>Paused at node</strong><pre>{JSON.stringify(paused.value, null, 2)}</pre><button type="button" onClick={onResume}>Continue execution</button></div>}
      {logs.length > 0 && <div className="log-replay" role="group" aria-label="Flow replay"><button type="button" className="secondary" onClick={() => showStep(0)}>From start</button><button type="button" className="secondary" aria-label="Previous step" disabled={cursor <= 0} onClick={() => showStep(cursor - 1)}>←</button><output>{cursor < 0 ? `— / ${logs.length}` : `${cursor + 1} / ${logs.length}`}</output><button type="button" className="secondary" aria-label="Next step" disabled={cursor >= logs.length - 1} onClick={() => showStep(cursor + 1)}>→</button><button type="button" className="secondary" aria-pressed={playing} onClick={() => { setCursor(-1); setPlaying((value) => !value); }}>{playing ? "Stop replay" : "Replay"}</button></div>}
      {logs.length === 0 ? (
        <p>
          Run the flow from Preview to inspect input, output, and errors.
        </p>
      ) : (
        <ol>
          {logs.map((log, index) => (
            <li key={`${log.nodeId}-${index}`} className={`${log.level}${cursor === index ? " current" : ""}`}>
              <code>{log.level}</code>
              <button type="button" className="log-step" onClick={() => showStep(index)}><span>{log.message}</span>{log.durationMs !== undefined && <time>{log.durationMs.toFixed(1)} ms</time>}{log.value !== undefined && <pre>{JSON.stringify(log.value, null, 2)}</pre>}</button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function FlowRunHistory({ runs, flows, onOpen }: { runs: Project["flowRuns"]; flows: Project["flows"]; onOpen: (logs: FlowLog[]) => void }) {
  return (
    <details className="flow-run-history">
      <summary>Cronologia esecuzioni <span>{runs.length}</span></summary>
      <div>
        {runs.length === 0 ? <p>None esecuzione registrata.</p> : [...runs].reverse().map((run) => (
          <button key={run.id} type="button" className="secondary" onClick={() => onOpen(run.logs)}>
            <strong>{flows.find((flow) => flow.id === run.flowId)?.name ?? "Flow rimosso"}</strong>
            <span>{run.logs.length} passi · {run.durationMs.toFixed(1)} ms</span>
            <time>{new Date(run.startedAt).toLocaleString("it")}</time>
          </button>
        ))}
      </div>
    </details>
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
    name: "Tasks",
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
          label: action === "navigate" ? "Go to features" : "Show notification",
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
          label: "Save request",
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
  if (!source) throw new Error("Dashboard source is missing");
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
    make("Create project", bySlot("create"), "insert", true),
    make("Aggiorna progetto", bySlot("project-form"), "update", true),
    make("Delete progetto", bySlot("detail-modal"), "delete"),
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
