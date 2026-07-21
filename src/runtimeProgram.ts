import { canContain, componentTree, type ComponentBranch } from "./hierarchy";
import { parseProject, type Breakpoint, type EditorComponent, type Project } from "./model";

export type RuntimeAdapter = {
  target: "preview" | "web" | "pwa" | "android";
  data: "host" | "embedded";
  navigation: "host" | "hash";
  native: "host" | "web" | "capacitor";
};

export type RuntimeProgram = {
  contractVersion: 1;
  projectId: string;
  graphRevision: number;
  pages: { id: string; name: string; path: string; markup: string; componentIds: string[]; components: EditorComponent[] }[];
  flows: Project["flows"];
  dataSources: Project["dataSources"];
  codeModules: Project["codeModules"];
  appConfig: Project["appConfig"];
  state: Project["state"];
  theme: Project["theme"];
  bindings: { componentId: string; event: string; flowId: string }[];
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(
  /[&<>"]/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!,
);
const safeCss = (value: unknown) => String(value ?? "").replace(/[{};]/g, "");
const deepFreeze = <T,>(value: T): T => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

export function runtimeComponentHtml(component: EditorComponent, children = "") {
  const text = escapeHtml(component.props.label ?? component.name);
  const fieldName = escapeHtml(component.props.fieldName || component.id);
  const common = `id="${escapeHtml(component.id)}" data-component="${escapeHtml(component.id)}"${component.props.tooltip ? ` title="${escapeHtml(component.props.tooltip)}"` : ""}${component.props.disabled === true ? ' aria-disabled="true"' : ""}`;
  const legacyCommon = `id="${escapeHtml(component.id)}"${component.props.tooltip ? ` title="${escapeHtml(component.props.tooltip)}"` : ""}${component.props.disabled === true ? ' aria-disabled="true"' : ""}`;
  const runtimeId = `data-component="${escapeHtml(component.id)}"`;
  const viewState = component.type === "loader" ? "loading" : component.type === "empty" ? "empty" : component.props.viewState === "error" || (component.type === "alert" && /(^|\s)error(\s|$)/i.test(`${component.name} ${component.intent.role}`)) ? "error" : undefined;
  if (viewState) return `<div ${common} data-view-state="${viewState}" role="${viewState === "error" ? "alert" : "status"}" hidden>${text}</div>`;
  if (component.type === "input") return `<label>${escapeHtml(component.accessibility.label)}<input ${common} data-kind="input" name="${fieldName}" type="${["text", "email", "number", "password", "search", "date", "time"].includes(String(component.props.inputType)) ? escapeHtml(component.props.inputType) : "text"}" placeholder="${escapeHtml(component.props.placeholder)}"${component.props.required === true ? " required" : ""}></label>`;
  if (component.type === "button") return `<button ${common} data-kind="button" type="${["button", "submit", "reset"].includes(String(component.props.buttonType)) ? escapeHtml(component.props.buttonType) : "button"}"${component.props.disabled === true ? " disabled" : ""}>${text}</button>`;
  if (component.type === "list") return `<section ${common} data-kind="list"${component.binding?.sourceId ? ` data-source="${escapeHtml(component.binding.sourceId)}"` : ""}${component.events.recordUpdate ? ` data-record-update-flow="${escapeHtml(component.events.recordUpdate)}"` : ""}${component.events.recordDelete ? ` data-record-delete-flow="${escapeHtml(component.events.recordDelete)}"` : ""} aria-label="${escapeHtml(component.accessibility.label)}"><div class="loading status" role="status">Loading…</div><div class="empty" hidden>No items yet. Add your first one.</div><div class="error" role="alert" hidden></div><ul></ul></section>`;
  if (component.type === "toast") return `<div ${common} data-kind="toast" role="status" aria-live="polite" hidden>${text}</div>`;
  if (component.type === "title") return `<h1 ${common}>${text}</h1>`;
  if (component.type === "textarea") return `<label>${escapeHtml(component.accessibility.label)}<textarea ${common} name="${fieldName}"${component.props.required === true ? " required" : ""} placeholder="${escapeHtml(component.props.placeholder)}"></textarea></label>`;
  if (component.type === "select") return `<label>${escapeHtml(component.accessibility.label)}<select ${common} name="${fieldName}">${String(component.props.options || component.props.label || component.name).split("|").map((option) => `<option>${escapeHtml(option)}</option>`).join("")}</select></label>`;
  if (component.type === "checkbox" || component.type === "radio") return `<label ${legacyCommon} class="choice-control" ${runtimeId}><input id="preview-${escapeHtml(component.id)}-control" name="${fieldName}" type="${component.type}"><span>${text}</span></label>`;
  if (component.type === "image") return `<img ${common} src="${escapeHtml(component.props.src || "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22160%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%23e8eaf2%22/%3E%3C/svg%3E")}" alt="${escapeHtml(component.accessibility.label)}">`;
  if (component.type === "link") return `<a ${common} href="${escapeHtml(component.props.href || component.props.path || "#")}">${text}</a>`;
  if (component.type === "upload") return `<label>${text}<input ${common} type="file"></label>`;
  if (component.type === "signature") return `<label ${common} class="signature-pad">${text}<canvas data-signature-canvas role="img" aria-label="${escapeHtml(component.accessibility.label)}"></canvas><input type="hidden" name="${fieldName}"><button type="button" data-clear-signature>Clear signature</button></label>`;
  if (component.type === "progress") return `<label>${text}<progress ${common} max="${escapeHtml(component.props.max || 100)}" value="${escapeHtml(component.props.value || 60)}">${escapeHtml(component.props.value || 60)}</progress></label>`;
  if (component.type === "table") return `<div ${common} class="table-scroll"><table><caption>${text}</caption><thead><tr><th>Name</th><th>Status</th><th>Date</th></tr></thead><tbody><tr><td>Example item</td><td><span class="chip">Active</span></td><td>Today</td></tr></tbody></table></div>`;
  if (component.type === "chart") return `<figure ${common} data-kind="chart" aria-label="${escapeHtml(component.accessibility.label)}"><svg viewBox="0 0 320 140" role="img" aria-label="Bar chart">${[70, 38, 52, 18, 58, 44, 30].map((y, index) => `<rect x="${18 + index * 42}" y="${y}" width="34" height="${124 - y}" rx="6"></rect>`).join("")}</svg><figcaption>${text}</figcaption></figure>`;
  if (component.type === "calendar") return `<section ${legacyCommon} data-kind="calendar" ${runtimeId}><label>${text}<input id="preview-${escapeHtml(component.id)}-control" type="date"></label><ul aria-live="polite"></ul></section>`;
  if (component.type === "audio" || component.type === "video") return `<${component.type} ${common} controls src="${escapeHtml(component.props.src || "")}">${text}</${component.type}>`;
  if (component.type === "avatar") return `<span ${common} class="avatar" role="img" aria-label="${escapeHtml(component.accessibility.label)}">${escapeHtml(String(component.props.initials || text).slice(0, 2).toUpperCase())}</span>`;
  if (component.type === "badge") return `<span ${common} class="chip">${text}</span>`;
  if (component.type === "accordion") return `<details ${common}><summary>${text}</summary>${children || `<p>${escapeHtml(component.props.description || "Expandable content")}</p>`}</details>`;
  if (canContain(component)) {
    const visibleText = children && String(component.props.label ?? "").toLowerCase() === component.type ? "" : text;
    const ownContent = `${visibleText ? `<strong>${visibleText}</strong>` : ""}${component.props.description ? `<p>${escapeHtml(component.props.description)}</p>` : ""}`;
    const tag = ["header", "footer", "section", "form"].includes(component.type) ? component.type : ["sidebar", "drawer", "menu"].includes(component.type) ? "aside" : component.type === "navbar" ? "nav" : "div";
    const role = component.type === "modal" ? "dialog" : component.accessibility.role || (component.type === "hero" ? "region" : "group");
    return `<${tag} ${legacyCommon} class="generated-container generated-${component.type}" ${runtimeId} role="${escapeHtml(role)}">${ownContent}${children}</${tag}>`;
  }
  return `<div ${common} role="${escapeHtml(component.accessibility.role || "group")}">${text}</div>`;
}

const runtimeBranchHtml = ({ component, children }: ComponentBranch): string => runtimeComponentHtml(component, children.map(runtimeBranchHtml).join("\n"));

export function runtimeComponentCss(component: EditorComponent, breakpoint: Breakpoint) {
  const style = { ...component.styles.desktop, ...(breakpoint === "desktop" ? {} : component.styles[breakpoint]) };
  const declarations = (value: Record<string, unknown>) => Object.entries(value).map(([key, item]) => `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${safeCss(item)}`).join(";");
  const rules = (target: string) => `${target}{${declarations(style)}}${target}:hover{${declarations(component.states.hover)}}${target}:focus-visible,${target}:focus-within{${declarations(component.states.focus)}}${target}:active{${declarations(component.states.active)}}${target}:disabled,${target}[aria-disabled="true"]{${declarations(component.states.disabled)}}`;
  return rules(`[id="${component.id}"]`) + rules(`[data-component="${component.id}"]`);
}

export function compileRuntimeProgram(input: Project): RuntimeProgram {
  const project = parseProject(structuredClone(input));
  const pages = project.pages.map((page) => ({
    id: page.id, name: page.name, path: page.path,
    markup: componentTree(page.components).map(runtimeBranchHtml).join("\n"),
    componentIds: page.components.map((component) => component.id), components: page.components,
  }));
  return deepFreeze({
    contractVersion: 1 as const, projectId: project.id, graphRevision: project.revision, pages,
    flows: project.flows, dataSources: project.dataSources, codeModules: project.codeModules,
    appConfig: project.appConfig, state: project.state, theme: project.theme,
    bindings: project.pages.flatMap((page) => page.components.flatMap((component) => Object.entries(component.events).map(([event, flowId]) => ({ componentId: component.id, event, flowId })))),
  });
}

export const previewRuntimeAdapter: RuntimeAdapter = { target: "preview", data: "host", navigation: "host", native: "host" };
export const exportRuntimeAdapter = (target: "web" | "pwa" | "android"): RuntimeAdapter => ({ target, data: "embedded", navigation: "hash", native: target === "android" ? "capacitor" : "web" });
