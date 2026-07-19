/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef } from "react";
import type { Breakpoint, EditorComponent, Project } from "./model";
import type { LocalRecord } from "./db";
import { canContain, componentTree, type ComponentBranch } from "./hierarchy";

type Props = {
  project: Project;
  pageId: string;
  breakpoint: Breakpoint;
  interactive: boolean;
  onAdd: (value: string) => Promise<void>;
  onRunFlow?: (flowId: string, input: unknown) => Promise<{ notification?: string; level?: string; navigate?: { path: string; mode: "page" | "back" | "url" }; modal?: { componentId: string; operation: "open" | "close" }; ui?: { componentId: string; operation: string; value: string } }>;
  onRefresh: (sourceId?: string) => Promise<LocalRecord[]>;
  onDashboardAction?: (
    action: string,
    payload?: Record<string, string>,
  ) => Promise<LocalRecord[]>;
  onRecordAction?: (
    action: "update" | "delete" | "undo",
    payload?: Record<string, unknown>,
    sourceId?: string,
  ) => Promise<LocalRecord[]>;
  error?: string;
  captureRequest?: string;
  onCapture?: (result: {
    dataUrl: string;
    width: number;
    height: number;
  }) => void;
  onCaptureError?: (error: string) => void;
  onRuntimeLog?: (level: "info" | "error", message: string) => void;
  onNavigatePage?: (path: string) => void;
  onThemeChange?: (mode: "light" | "dark" | "system") => void;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!,
  );
const attr = (component?: EditorComponent) =>
  component ? `data-component="${component.id}"` : "";
const bySlot = (components: EditorComponent[], slot: string) =>
  components.find((component) => component.props.slot === slot);
const label = (component?: EditorComponent) =>
  escapeHtml(component?.props.label || component?.name || "");

export function buildBottomNavigation(project: Project, activePath?: string) {
  const navigation = project.appConfig.mobileBottomNavigation;
  if (!navigation?.enabled) return "";
  return `<nav class="app-bottom-nav" aria-label="Navigazione principale">${navigation.items
    .map(
      (item) =>
        `<button type="button" data-fe-page="${escapeHtml(item.path)}"${item.path === activePath ? ' aria-current="page"' : ""}>${escapeHtml(item.label)}</button>`,
    )
    .join("")}</nav>`;
}

async function rasterizePreview(html: string, width: number, height: number) {
  const copy = document.createElement("iframe");
  copy.setAttribute("sandbox", "allow-same-origin");
  Object.assign(copy.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${width}px`,
    height: `${height}px`,
    border: "0",
  });
  copy.srcdoc = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  document.body.append(copy);
  try {
    await new Promise<void>((resolve, reject) => {
      copy.onload = () => resolve();
      copy.onerror = () =>
        reject(new Error("Impossibile preparare la cattura preview"));
    });
    const root = copy.contentDocument?.documentElement;
    if (!root) throw new Error("DOM preview non disponibile");
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(root, {
      width,
      height,
      scale: 1,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: false,
    });
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } finally {
    copy.remove();
  }
}

export function renderComponent(component: EditorComponent, children = "") {
  const text = label(component);
  const fieldName = escapeHtml(component.props.fieldName || component.id);
  const common = `data-component="${component.id}" id="preview-${component.id}"${component.props.tooltip ? ` title="${escapeHtml(component.props.tooltip)}"` : ""}${component.props.disabled === true ? ' aria-disabled="true"' : ""}`;
  if (component.type === "input")
    return `<label>${escapeHtml(component.accessibility.label)}<input ${common} data-kind="input" name="${fieldName}" type="${["text", "email", "number", "password", "search", "date", "time"].includes(String(component.props.inputType)) ? escapeHtml(component.props.inputType) : "text"}" placeholder="${escapeHtml(component.props.placeholder)}"${component.props.required === true ? " required" : ""}></label>`;
  if (component.type === "button")
    return `<button ${common} data-kind="button" type="${["button", "submit", "reset"].includes(String(component.props.buttonType)) ? escapeHtml(component.props.buttonType) : "button"}"${component.props.disabled === true ? " disabled" : ""}>${text}</button>`;
  if (component.type === "list")
    return `<section ${common} data-kind="list" aria-label="${escapeHtml(component.accessibility.label)}"><div class="loading" role="status">Caricamento…</div><div class="empty" hidden>Nessun elemento. Aggiungine uno.</div><div class="error" role="alert" hidden></div><ul></ul></section>`;
  if (component.type === "toast")
    return `<div ${common} data-kind="toast" role="status" aria-live="polite" hidden>${text}</div>`;
  if (component.type === "title") return `<h1 ${common}>${text}</h1>`;
  if (component.type === "textarea")
    return `<label>${escapeHtml(component.accessibility.label)}<textarea ${common} name="${fieldName}"${component.props.required === true ? " required" : ""} placeholder="${escapeHtml(component.props.placeholder)}"></textarea></label>`;
  if (component.type === "select")
    return `<label>${escapeHtml(component.accessibility.label)}<select ${common} name="${fieldName}">${String(component.props.options || component.props.label || component.name).split("|").map((option) => `<option>${escapeHtml(option)}</option>`).join("")}</select></label>`;
  if (component.type === "checkbox" || component.type === "radio")
    return `<label><input ${common} name="${fieldName}" type="${component.type}"> ${text}</label>`;
  if (component.type === "image")
    return `<img ${common} src="${escapeHtml(component.props.src || "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22160%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%23e8eaf2%22/%3E%3C/svg%3E")}" alt="${escapeHtml(component.accessibility.label)}">`;
  if (component.type === "link")
    return `<a ${common} href="${escapeHtml(component.props.href || "#")}">${text}</a>`;
  if (component.type === "upload")
    return `<label>${text}<input ${common} type="file"></label>`;
  if (component.type === "progress")
    return `<label>${text}<progress ${common} max="${escapeHtml(component.props.max || 100)}" value="${escapeHtml(component.props.value || 60)}">${escapeHtml(component.props.value || 60)}</progress></label>`;
  if (component.type === "table")
    return `<div ${common} class="table-scroll"><table><caption>${text}</caption><thead><tr><th>Nome</th><th>Stato</th><th>Data</th></tr></thead><tbody><tr><td>Elemento di esempio</td><td><span class="chip">Attivo</span></td><td>Oggi</td></tr></tbody></table></div>`;
  if (component.type === "chart")
    return `<figure ${common} aria-label="${escapeHtml(component.accessibility.label)}"><svg viewBox="0 0 320 140" role="img" aria-label="Grafico a barre"><rect x="24" y="70" width="48" height="54" rx="6"></rect><rect x="92" y="38" width="48" height="86" rx="6"></rect><rect x="160" y="52" width="48" height="72" rx="6"></rect><rect x="228" y="18" width="48" height="106" rx="6"></rect></svg><figcaption>${text}</figcaption></figure>`;
  if (component.type === "calendar")
    return `<label>${text}<input ${common} type="date"></label>`;
  if (component.type === "audio" || component.type === "video")
    return `<${component.type} ${common} controls src="${escapeHtml(component.props.src || "")}">${text}</${component.type}>`;
  if (component.type === "avatar")
    return `<span ${common} class="avatar" role="img" aria-label="${escapeHtml(component.accessibility.label)}">${escapeHtml(
      String(component.props.initials || text)
        .slice(0, 2)
        .toUpperCase(),
    )}</span>`;
  if (component.type === "badge")
    return `<span ${common} class="chip">${text}</span>`;
  if (component.type === "accordion")
    return `<details ${common}><summary>${text}</summary>${children || `<p>${escapeHtml(component.props.description || "Contenuto espandibile")}</p>`}</details>`;
  if (canContain(component)) {
    const ownContent = `<strong>${text}</strong>${component.props.description ? `<p>${escapeHtml(component.props.description)}</p>` : ""}`;
    const content = `${ownContent}${children}`;
    const tag =
      component.type === "header" ||
      component.type === "footer" ||
      component.type === "section" ||
      component.type === "form"
        ? component.type
        : component.type === "sidebar" ||
            component.type === "drawer" ||
            component.type === "menu"
          ? "aside"
          : component.type === "navbar"
            ? "nav"
            : "div";
    const role =
      component.type === "modal"
        ? "dialog"
        : component.accessibility.role ||
          (component.type === "hero" ? "region" : "group");
    return `<${tag} ${common} class="preview-container preview-${component.type}" role="${escapeHtml(role)}">${content}</${tag}>`;
  }
  return `<div ${common} role="${escapeHtml(component.accessibility.role || "group")}">${text}</div>`;
}

const renderBranch = ({ component, children }: ComponentBranch): string =>
  renderComponent(component, children.map(renderBranch).join("\n"));

function styleFor(component: EditorComponent, breakpoint: Breakpoint) {
  const style = {
    ...component.styles.desktop,
    ...(breakpoint === "desktop" ? {} : component.styles[breakpoint]),
  };
  const declarations = (value: Record<string, unknown>) =>
    Object.entries(value)
      .map(
        ([key, item]) =>
          `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${String(item).replace(/[{};]/g, "")}`,
      )
      .join(";");
  const target = `[data-component="${component.id}"]`;
  return `${target}{${declarations(style)}}${target}:hover{${declarations(component.states.hover)}}${target}:focus-visible,${target}:focus-within{${declarations(component.states.focus)}}${target}:active{${declarations(component.states.active)}}${target}:disabled,${target}[aria-disabled="true"]{${declarations(component.states.disabled)}}`;
}

function flowTriggerScript(pages: Project["pages"], flows: Project["flows"], experience: unknown, interactive: boolean) {
  if (!interactive) return "";
  const bindings = experience ? [] : pages.flatMap((page) => page.components.flatMap((component) =>
    Object.entries(component.events).map(([event, flowId]) => ({ componentId: component.id, event, flowId, inputId: flows.find((flow) => flow.id === flowId)?.nodes.find((node) => node.type === "readInput")?.config.componentId })),
  ));
  const automatic = flows.flatMap((flow) => flow.nodes
    .filter((node) => node.type === "event" && ["pageLoad", "timer"].includes(node.config.trigger))
    .map((node) => ({ flowId: flow.id, trigger: node.config.trigger, interval: Math.min(3600000, Math.max(500, Number(node.config.interval) || 5000)) })),
  );
  const safe = (value: unknown) => JSON.stringify(value).replaceAll("<", "\\u003c");
  return `;const feBindings=${safe(bindings)},feAutomatic=${safe(automatic)};const feInput=(event,binding)=>{const configured=binding.inputId&&document.querySelector('[data-component="'+CSS.escape(binding.inputId)+'"]');if(configured&&'value'in configured)return configured.value;const target=event.target;if(event.type==='submit'&&target instanceof HTMLFormElement)return Object.fromEntries(new FormData(target));if(target instanceof HTMLInputElement&&target.type==='file')return target.files?.[0];return target&&'value'in target?target.value:''};const feUpdate=(change)=>{const element=change&&document.querySelector('[data-component="'+CSS.escape(change.componentId)+'"]');if(!element)return;if(change.operation==='show')element.hidden=false;if(change.operation==='hide')element.hidden=true;if(change.operation==='enable'){element.removeAttribute('disabled');element.removeAttribute('aria-disabled')}if(change.operation==='disable'){element.setAttribute('disabled','');element.setAttribute('aria-disabled','true')}if(change.operation==='text')element.textContent=change.value;if(change.operation==='value'&&'value'in element)element.value=change.value;if(['background','color','opacity'].includes(change.operation))element.style[change.operation]=change.value};feBindings.forEach((binding)=>{const element=document.querySelector('[data-component="'+CSS.escape(binding.componentId)+'"]'),run=(event)=>{event.preventDefault();send('RUN_FLOW',{flowId:binding.flowId,input:feInput(event,binding)})};element?.addEventListener(binding.event,run);if(binding.event==='submit'&&element instanceof HTMLFormElement)element.querySelectorAll('button[type="submit"]').forEach((button)=>button.addEventListener('click',(event)=>{event.preventDefault();send('RUN_FLOW',{flowId:binding.flowId,input:Object.fromEntries(new FormData(element))})}))});feAutomatic.forEach((item)=>item.trigger==='pageLoad'?send('RUN_FLOW',{flowId:item.flowId,input:''}):setInterval(()=>send('RUN_FLOW',{flowId:item.flowId,input:''}),item.interval));addEventListener('message',(event)=>{const message=event.data;if(message?.channel!=='frontend-editor-host'||message.action!=='flow')return;let status=document.querySelector('[data-flow-status]');if(!status){status=document.createElement('div');status.dataset.flowStatus='';status.setAttribute('role','status');status.style.cssText='position:fixed;right:16px;bottom:16px;z-index:9999;padding:12px 16px;border-radius:10px;background:#172033;color:white;box-shadow:0 12px 30px #0004';document.body.append(status)}if(message.notification){status.textContent=message.notification;status.hidden=false;clearTimeout(window.feStatusTimer);window.feStatusTimer=setTimeout(()=>status.hidden=true,2600)}if(message.navigate?.mode==='back')history.back();else if(message.navigate?.mode==='url')location.assign(message.navigate.path);else if(message.navigate)location.hash=message.navigate.path;if(message.modal){const element=document.querySelector('[data-component="'+CSS.escape(message.modal.componentId)+'"]');if(message.modal.operation==='close')element?.setAttribute('hidden','');else element?.removeAttribute('hidden')}if(message.ui)feUpdate(message.ui)});`;
}

function landingMarkup(components: EditorComponent[]) {
  const nav = bySlot(components, "navbar"),
    title = bySlot(components, "hero-title"),
    copy = bySlot(components, "hero-copy"),
    primary = bySlot(components, "hero-primary"),
    secondary = bySlot(components, "hero-secondary"),
    visual = bySlot(components, "hero-visual"),
    featureTitle = bySlot(components, "features-title"),
    features = components.filter(
      (component) => component.props.slot === "feature",
    ),
    cta = bySlot(components, "cta"),
    footer = bySlot(components, "footer"),
    modal = bySlot(components, "modal"),
    toast = bySlot(components, "toast"),
    pricingTitle = bySlot(components, "pricing-title"),
    pricingSearch = bySlot(components, "pricing-search"),
    plans = components.filter(
      (component) => component.props.slot === "pricing-card",
    ),
    contactTitle = bySlot(components, "contact-title"),
    contactForm = bySlot(components, "contact-form"),
    contactName = bySlot(components, "contact-name"),
    contactSubmit = bySlot(components, "contact-submit"),
    contactList = bySlot(components, "contact-list");
  const links = String(nav?.props.links ?? "").split(",");
  const base = `<nav ${attr(nav)} aria-label="Navigazione principale"><a class="logo" href="#top">${label(nav)}</a><div>${links.map((link) => `<a href="#${escapeHtml(link.toLowerCase())}">${escapeHtml(link)}</a>`).join("")}</div><button class="mobile-menu" aria-label="Apri menu" aria-expanded="false">☰</button></nav><main id="top" class="landing"><section class="hero"><div class="hero-copy"><p class="kicker">PROJECT CLARITY, DELIVERED</p><h1 ${attr(title)}>${label(title)}</h1><p ${attr(copy)}>${label(copy)}</p><div class="hero-actions"><button ${attr(primary)} data-landing-action="features">${label(primary)}</button><button ${attr(secondary)} data-landing-action="notify">${label(secondary)}</button></div></div><div ${attr(visual)} class="hero-visual" role="img" aria-label="${label(visual)}"><div class="visual-window"><span></span><span></span><span></span><article><i></i><b></b></article><article><i></i><b></b></article><article><i></i><b></b></article></div></div></section><section id="features" class="features"><p class="kicker">BUILT FOR MOMENTUM</p><h2 ${attr(featureTitle)}>${label(featureTitle)}</h2><div class="feature-grid">${features.map((feature) => `<article ${attr(feature)}><span>${escapeHtml(feature.props.icon)}</span><h3>${label(feature)}</h3><p>${escapeHtml(feature.props.description)}</p><button class="feature-more" data-open-modal>Learn more <span aria-hidden="true">→</span></button></article>`).join("")}</div></section><section ${attr(cta)} class="landing-cta"><div><h2>${label(cta)}</h2><p>${escapeHtml(cta?.props.description)}</p></div><button data-page-target="contact">Start free today</button></section></main><footer ${attr(footer)}>${label(footer)}</footer><div class="modal-backdrop" hidden><section ${attr(modal)} role="dialog" aria-modal="true" aria-labelledby="landing-modal-title"><button class="modal-close" aria-label="Chiudi modal">×</button><h2 id="landing-modal-title">${label(modal)}</h2><p>${escapeHtml(modal?.props.description)}</p><button data-page-target="contact">Parliamone</button></section></div><div ${attr(toast)} class="toast" role="status" hidden>${label(toast)}</div>`;
  const richPages = `<section class="rich-page pricing-page" id="pricing" hidden><p class="kicker">PRICING</p><h1 ${attr(pricingTitle)}>${label(pricingTitle)}</h1><label class="plan-search">Cerca tra i piani<input ${attr(pricingSearch)} type="search" placeholder="${escapeHtml(pricingSearch?.props.placeholder)}"></label><div class="pricing-grid">${plans.map((plan, index) => `<article ${attr(plan)} data-plan="${label(plan).toLowerCase()}"><span>${index === 1 ? "Più scelto" : "Piano"}</span><h2>${label(plan)}</h2><strong>€${[19, 49, 99][index] ?? 29}<small>/mese</small></strong><p>${escapeHtml(plan.props.description)}</p><button data-open-modal>Scopri il piano</button></article>`).join("")}</div><p class="plan-empty" hidden>Nessun piano corrisponde alla ricerca.</p></section><section class="rich-page contact-page" id="contact" hidden><div><p class="kicker">LET'S BUILD</p><h1 ${attr(contactTitle)}>${label(contactTitle)}</h1><p>Raccontaci cosa vuoi realizzare. La richiesta viene salvata nella sorgente collegata al flow.</p></div><form ${attr(contactForm)} novalidate><label>Nome<input ${attr(contactName)} name="name" required minlength="2" placeholder="${escapeHtml(contactName?.props.placeholder)}"></label><label>Email<input name="email" type="email" required placeholder="nome@azienda.it"></label><label>Messaggio<textarea name="message" required minlength="8" placeholder="Obiettivo, tempi e pubblico"></textarea></label><div class="contact-error" role="alert"></div><button ${attr(contactSubmit)} type="submit">${label(contactSubmit)}</button></form><section ${attr(contactList)} class="contact-history" aria-label="Richieste inviate"><h2>${label(contactList)}</h2><div class="loading" role="status">Caricamento…</div><div class="empty" hidden>Nessuna richiesta inviata.</div><ul></ul></section></section>`;
  const validation = `<script>document.addEventListener('invalid',(event)=>{const form=event.target.closest('.contact-page form');if(form)form.querySelector('.contact-error').textContent='Completa nome, email e messaggio con valori validi.'},true)</script>`;
  return `<style>[hidden]{display:none!important}</style>${base.replace("</main>", `${richPages}</main>`)}${validation}`;
}

function landingCss() {
  return `[hidden]{display:none!important}${landingThemeCss()}`;
}

function landingThemeCss() {
  return `body{padding:0;background:#f5f3ff;color:#101528}nav{width:min(1180px,calc(100% - 40px));margin:18px auto;display:flex;align-items:center;justify-content:space-between}nav .logo{font-weight:900;font-size:20px;color:inherit;text-decoration:none}nav div{display:flex;gap:26px}nav div a{color:inherit;text-decoration:none;font-weight:650}.mobile-menu{display:none}.landing{width:min(1180px,calc(100% - 40px));margin:auto;max-width:none}.hero{min-height:650px;display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:56px}.hero h1{font-size:clamp(46px,6vw,76px);line-height:1;letter-spacing:-.055em;margin:12px 0 24px}.hero-copy>p{font-size:20px;line-height:1.7;color:#536078}.kicker{font-size:12px!important;letter-spacing:.16em;color:#6d5dfc!important;font-weight:800}.hero-actions{display:flex;gap:12px;margin-top:30px}.hero-actions button,.landing-cta button{padding:14px 20px;border:1px solid #6d5dfc;border-radius:12px;background:#6d5dfc;color:white;font-weight:750;transition:.18s}.hero-actions button:nth-child(2){background:white;color:#4036b8}.hero-actions button:hover,.landing-cta button:hover{translate:0 -2px;box-shadow:0 12px 28px #6d5dfc40}.visual-window{padding:22px;height:280px;border-radius:18px;background:#202742;display:grid;grid-template-columns:repeat(3,8px) 1fr;gap:8px}.visual-window>span{width:8px;height:8px;border-radius:50%;background:#8176ff}.visual-window article{grid-column:1/-1;display:grid;grid-template-columns:48px 1fr;gap:14px;align-items:center;background:#ffffff0e;border:1px solid #ffffff18;border-radius:12px;padding:16px}.visual-window i{height:34px;border-radius:9px;background:#6d5dfc}.visual-window b{height:9px;border-radius:8px;background:#ffffff30}.features{padding:90px 0}.features>h2{font-size:44px;max-width:650px}.feature-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.feature-grid article{width:100%!important;transition:.18s}.feature-grid article:hover{translate:0 -5px;box-shadow:0 20px 40px #30385824}.feature-grid article>span{font-size:28px;color:#6d5dfc}.feature-grid h3{font-size:21px}.feature-grid p{color:#657087;line-height:1.6}.feature-more{padding:0;background:transparent;color:#5547d9}.landing-cta{display:flex;align-items:center;justify-content:space-between;margin:50px 0}.landing-cta h2{font-size:32px;margin-bottom:8px}.landing-cta p{margin:0;color:#e7e4ff}.landing-cta button{background:#fff;color:#4036b8}footer{width:min(1180px,calc(100% - 40px));margin:20px auto}.toast{position:fixed;right:24px;bottom:24px;padding:15px 18px;background:#111827;color:#fff;border-radius:12px;box-shadow:0 16px 40px #11182740}.modal-backdrop{position:fixed;inset:0;background:#11182780;display:grid;place-items:center;padding:20px;z-index:5}.modal-backdrop[hidden]{display:none}.modal-backdrop section{max-width:480px;background:#fff;padding:32px;border-radius:18px}.modal-close{float:right;background:transparent;color:#111827;font-size:22px}.rich-page{min-height:650px;padding:90px 0;animation:fe-rise .32s ease-out}.rich-page>h1,.contact-page h1{font-size:clamp(40px,6vw,68px);letter-spacing:-.045em}.plan-search{max-width:420px;margin:30px 0}.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.pricing-grid article{width:100%!important;display:grid;gap:15px}.pricing-grid article>span{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#6d5dfc;font-weight:800}.pricing-grid strong{font-size:36px}.pricing-grid small{font-size:14px;color:#697386}.plan-empty{padding:40px;text-align:center;color:#697386}.contact-page{grid-template-columns:minmax(0,.8fr) minmax(320px,1fr);gap:54px;align-items:start}.contact-page:not([hidden]){display:grid}.contact-page form{display:grid;gap:15px;background:#fff;padding:28px;border-radius:20px;box-shadow:0 18px 45px #2e35551c}.contact-page textarea{min-height:120px;resize:vertical}.contact-error{min-height:20px;color:#b42318}.contact-history{grid-column:1/-1;padding-top:20px}.contact-history ul{display:grid;gap:10px}.contact-history li{padding:14px 18px;background:#fff;border-radius:12px;border:1px solid #e4e5ec}@media(max-width:800px){nav div{display:none}nav div.open{position:absolute;z-index:4;top:76px;left:20px;right:20px;display:grid;padding:18px;background:#0b1020;border-radius:14px}nav div.open a{color:#fff}.mobile-menu{display:block}.hero{grid-template-columns:1fr;padding:70px 0}.hero-visual{order:-1}.feature-grid,.pricing-grid{grid-template-columns:1fr}.landing-cta{display:grid;gap:22px}.features,.rich-page{padding:60px 0}.contact-page:not([hidden]){display:grid;grid-template-columns:1fr}}@media(max-width:500px){.hero h1{font-size:42px}.hero-actions{display:grid}.hero-actions button{width:100%!important}.visual-window{height:230px}.features>h2{font-size:34px}.contact-page form{padding:20px}}`;
}

function dashboardMarkup(components: EditorComponent[]) {
  const sidebar = bySlot(components, "sidebar"),
    topbar = bySlot(components, "topbar"),
    title = bySlot(components, "dashboard-title"),
    search = bySlot(components, "search"),
    filter = bySlot(components, "filter"),
    sort = bySlot(components, "sort"),
    create = bySlot(components, "create"),
    table = bySlot(components, "projects-table"),
    loader = bySlot(components, "loading"),
    empty = bySlot(components, "empty"),
    error = bySlot(components, "error"),
    modal = bySlot(components, "project-modal"),
    toast = bySlot(components, "toast");
  return `<main class="dashboard-shell"><aside ${attr(sidebar)}><div class="dash-logo">◈ ${label(sidebar)}</div><nav aria-label="Dashboard">${String(
    sidebar?.props.links ?? "",
  )
    .split(",")
    .map(
      (link, index) =>
        `<a class="${index === 0 ? "active" : ""}" href="#${escapeHtml(link.toLowerCase())}">${["▦", "□", "♙", "↗"][index] ?? "·"} ${escapeHtml(link)}</a>`,
    )
    .join(
      "",
    )}</nav><div class="user-card"><span>AM</span><div><strong>Alex Morgan</strong><small>Product lead</small></div></div></aside><section class="dash-main"><header ${attr(topbar)}><button class="sidebar-toggle" aria-label="Apri navigazione">☰</button><span>${label(topbar)}</span><div><button aria-label="Notifiche">●</button><span class="avatar">AM</span></div></header><div class="dash-content"><div class="dash-heading"><div><p>Saturday, July 18</p><h1 ${attr(title)}>${label(title)}</h1></div><button ${attr(create)} id="new-project">＋ ${label(create)}</button></div><section class="kpis" aria-label="Indicatori progetto"><article><span>▦</span><strong data-kpi="total">0</strong><small>Total projects</small></article><article><span>◴</span><strong data-kpi="progress">0</strong><small>In progress</small></article><article><span>✓</span><strong data-kpi="completed">0</strong><small>Completed</small></article><article><span>!</span><strong data-kpi="priority">0</strong><small>High priority</small></article></section><section class="projects-panel"><div class="projects-head"><div><h2>Projects</h2><p>Manage delivery across your team.</p></div><div class="project-controls"><label class="search-label">Search<input ${attr(search)} id="project-search" type="search" placeholder="${escapeHtml(search?.props.placeholder)}"></label><label>Status<select ${attr(filter)} id="status-filter"><option>All statuses</option><option>Planned</option><option>In progress</option><option>Completed</option><option>On hold</option></select></label><button ${attr(sort)} id="sort-projects">${label(sort)}</button></div></div><div ${attr(loader)} id="dash-loading" role="status">${label(loader)}</div><div ${attr(error)} id="dash-error" role="alert" hidden></div><div ${attr(empty)} id="dash-empty" hidden>${label(empty)}</div><div class="table-scroll"><table ${attr(table)}><thead><tr><th>Project</th><th>Status</th><th>Priority</th><th>Due date</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody></tbody></table></div></section></div></section></main><div class="modal-backdrop" id="project-modal" hidden><section ${attr(modal)} role="dialog" aria-modal="true" aria-labelledby="project-modal-title"><button type="button" class="modal-close" aria-label="Chiudi modal">×</button><p class="kicker">PROJECT DETAILS</p><h2 id="project-modal-title">${label(modal)}</h2><form novalidate><input type="hidden" name="id"><label>Project name<input name="name" minlength="2" required></label><label>Description<textarea name="description" minlength="4" required></textarea></label><div class="form-grid"><label>Status<select name="status"><option>Planned</option><option>In progress</option><option>Completed</option><option>On hold</option></select></label><label>Priority<select name="priority"><option>Low</option><option selected>Medium</option><option>High</option></select></label></div><label>Due date<input name="dueDate" type="date" required></label><div class="form-error" role="alert"></div><div class="modal-actions"><button type="button" class="secondary modal-cancel">Cancel</button><button type="submit">Save project</button></div></form></section></div><div ${attr(toast)} class="toast" role="status" hidden>${label(toast)}</div>`;
}

function dashboardCss() {
  return `body{padding:0;background:#f4f6fa}.dashboard-shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh;width:100%;max-width:none}.dashboard-shell>aside{position:sticky;top:0;height:100vh;padding:24px 16px;display:flex;flex-direction:column}.dash-logo{font-size:20px;font-weight:900;padding:6px 10px 30px}.dashboard-shell aside nav{display:grid;gap:6px}.dashboard-shell aside nav a{padding:12px;color:#9ca6ba;text-decoration:none;border-radius:10px;font-weight:650}.dashboard-shell aside nav a.active,.dashboard-shell aside nav a:hover{background:#ffffff12;color:#fff}.user-card{margin-top:auto;display:flex;gap:10px;align-items:center;padding:12px;background:#ffffff0d;border-radius:12px}.user-card>span,.avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#6d5dfc;color:#fff;font-size:11px}.user-card div{display:grid}.user-card small{color:#8d97aa}.dash-main{min-width:0}.dash-main>header{height:66px;display:flex;align-items:center;justify-content:space-between;padding:0 28px}.dash-main>header>div{display:flex;align-items:center;gap:14px}.dash-main>header button{background:transparent;color:#687085}.sidebar-toggle{display:none}.dash-content{padding:32px;max-width:1450px;margin:auto}.dash-heading{display:flex;align-items:center;justify-content:space-between}.dash-heading p,.projects-head p{color:#7c8596;margin-bottom:5px}.dash-heading h1{font-size:30px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0}.kpis article{width:100%!important;display:grid;grid-template-columns:42px 1fr;align-items:center;padding:20px;border:1px solid #e6e9f0;border-radius:15px;background:#fff}.kpis article>span{grid-row:1/3;display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:#eeecff;color:#5c4ee5}.kpis strong{font-size:25px}.kpis small{color:#7a8494}.projects-panel{background:#fff;border:1px solid #e6e9f0;border-radius:17px;padding:22px}.projects-head{display:flex;justify-content:space-between;gap:18px}.projects-head h2{margin-bottom:3px}.project-controls{display:flex;align-items:end;gap:9px}.project-controls label{font-size:10px}.project-controls input,.project-controls select{min-width:170px}.project-controls button{white-space:nowrap;background:#fff;color:#4f596c;border:1px solid #d8dce5}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:15px;border-bottom:1px solid #eceef3}th{color:#7b8495;font-size:11px;text-transform:uppercase;letter-spacing:.08em}td strong{display:block}td small{color:#7c8596}.chip{display:inline-flex;padding:5px 8px;border-radius:20px;background:#eef0f5;font-size:11px}.chip.completed{background:#e8f7f0;color:#16785b}.chip.in-progress{background:#fff5df;color:#9a6400}.chip.high{background:#ffebe8;color:#b42318}.row-actions{display:flex;justify-content:flex-end;gap:6px}.row-actions button{background:#f4f5f8;color:#4c5668;padding:7px 9px}.row-actions .delete{color:#b42318}.projects-panel>#dash-loading,.projects-panel>#dash-empty,.projects-panel>#dash-error{padding:32px;text-align:center;color:#737d8e}.toast{position:fixed;right:24px;bottom:24px;padding:14px 18px;background:#172033;color:#fff;border-radius:12px;box-shadow:0 16px 40px #11182740}.modal-backdrop{position:fixed;inset:0;background:#1118278c;display:grid;place-items:start center;padding:20px;z-index:4;overflow:auto}.modal-backdrop[hidden]{display:none}.modal-backdrop section{width:min(520px,100%);background:#fff;padding:28px;border-radius:18px;margin:auto}.modal-close{float:right;background:transparent;color:#111827;font-size:22px}.modal-backdrop form{display:grid;gap:13px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.modal-actions{display:flex;justify-content:flex-end;gap:9px}.secondary{background:#fff!important;color:#445!important;border:1px solid #ddd!important}.form-error{color:#b42318;min-height:18px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:900px){.dashboard-shell{grid-template-columns:78px 1fr}.dashboard-shell aside{width:78px}.dash-logo{font-size:0}.dash-logo:first-letter{font-size:22px}.dashboard-shell aside nav a{font-size:0;text-align:center}.dashboard-shell aside nav a:first-letter{font-size:18px}.user-card div{display:none}.kpis{grid-template-columns:1fr 1fr}.projects-head{display:grid}.project-controls{flex-wrap:wrap}}@media(max-width:620px){.dashboard-shell{display:block}.dashboard-shell>aside{position:fixed;z-index:3;translate:-100% 0;width:240px!important;transition:.2s}.dashboard-shell>aside.open{translate:0}.sidebar-toggle{display:block}.dash-content{padding:18px}.dash-main>header{padding:0 18px}.dash-heading{align-items:flex-start}.dash-heading h1{font-size:24px}.kpis{grid-template-columns:1fr}.project-controls{display:grid;grid-template-columns:1fr 1fr}.search-label{grid-column:1/-1}.project-controls input,.project-controls select{min-width:0}.projects-head{gap:12px}th:nth-child(2),td:nth-child(2),th:nth-child(3),td:nth-child(3){display:none}.form-grid{grid-template-columns:1fr}}`;
}

function todoListRenderer(interactive: boolean) {
  return `let records=[];const button=document.querySelector('[data-kind="button"]'),input=document.querySelector('[data-kind="input"]'),search=document.querySelector('[name="search"]'),filter=document.querySelector('[name="filter"]'),form=document.querySelector('form');button?.addEventListener('click',()=>{${interactive ? "button.disabled=true;document.querySelector('.loading')?.removeAttribute('hidden');send('ADD',{value:input?.value||''})" : "send('DESIGN_CLICK')"}});const renderRecords=()=>{const root=document.querySelector('[data-kind="list"]');if(!root)return;const empty=root.querySelector('.empty'),list=root.querySelector('ul'),term=(search?.value||'').trim().toLowerCase(),state=filter?.value||'Tutti gli stati',items=records.filter((item)=>(state==='Tutti gli stati'||item.status===state)&&((item.text||'')+' '+(item.description||'')+' '+(item.category||'')).toLowerCase().includes(term));empty.hidden=Boolean(items.length);list.replaceChildren(...items.map((item)=>{const li=document.createElement('li'),title=document.createElement('strong'),description=document.createElement('p'),meta=document.createElement('div'),status=document.createElement('span'),priority=document.createElement('span'),time=document.createElement('time');li.className='record-row';title.textContent=item.text;description.textContent=item.description||'';status.className='chip';status.textContent=item.status||'';priority.className='chip';priority.textContent=item.priority||'';time.dateTime=item.dueDate||item.date;time.textContent=item.dueDate?new Date(item.dueDate+'T00:00:00').toLocaleDateString('it')+(item.time?' · '+item.time:''):new Date(item.date).toLocaleString('it');meta.append(status,priority,time);li.append(title,description,meta);return li}))};search?.addEventListener('input',renderRecords);filter?.addEventListener('change',renderRecords);addEventListener('message',(event)=>{const message=event.data;if(message?.channel!=='frontend-editor-host')return;const root=document.querySelector('[data-kind="list"]');if(!root)return;const loading=root.querySelector('.loading'),problem=root.querySelector('.error');if(button)button.disabled=false;loading.hidden=true;problem.hidden=!message.error;problem.textContent=message.error||'';records=message.records||[];renderRecords();if(message.action==='flow'&&!message.error)form?.reset()});send('READY')`;
}

function todoScript(interactive: boolean) {
  return `${todoListRenderer(interactive)};(()=>{let actionRecords=[],lastDeleted;const root=document.querySelector('[data-kind="list"]'),toast=document.querySelector('[data-component="tasks-toast"]');if(toast)toast.hidden=true;const showAction=(text,undo=false)=>{if(!toast)return;toast.replaceChildren(document.createTextNode(text));if(undo){const action=document.createElement('button');action.type='button';action.textContent='Annulla';action.style.marginLeft='10px';action.addEventListener('click',()=>{if(lastDeleted)send('RECORD_ACTION',{action:'undo',payload:lastDeleted})});toast.append(action)}toast.hidden=false;clearTimeout(window.recordToast);window.recordToast=setTimeout(()=>toast.hidden=true,5000)};const decorate=()=>{root?.querySelectorAll('.record-row').forEach((row)=>{if(row.querySelector('.record-actions'))return;const title=row.querySelector('strong')?.textContent||'',item=actionRecords.find((record)=>record.text===title);if(!item)return;const actions=document.createElement('div'),complete=document.createElement('button'),remove=document.createElement('button');actions.className='record-actions';actions.style.display='flex';actions.style.gap='8px';complete.type='button';complete.textContent=item.completed?'Completata':'Completa';complete.disabled=Boolean(item.completed);complete.addEventListener('click',()=>send('RECORD_ACTION',{action:'update',payload:{...item,status:'Completata',completed:true}}));remove.type='button';remove.textContent='Elimina';remove.style.background='#b42318';remove.addEventListener('click',()=>{if(confirm('Eliminare '+item.text+'?')){lastDeleted=item;send('RECORD_ACTION',{action:'delete',payload:{id:item.id}})}});actions.append(complete,remove);row.append(actions)})};new MutationObserver(decorate).observe(root||document.body,{childList:true,subtree:true});addEventListener('message',(event)=>{const message=event.data;if(message?.channel!=='frontend-editor-host')return;actionRecords=message.records||[];queueMicrotask(decorate);if(message.action==='update')showAction('Attività completata');if(message.action==='delete')showAction('Attività eliminata',true);if(message.action==='undo'){lastDeleted=undefined;showAction('Eliminazione annullata')}})})();`;
}

function recordConsistencyScript() {
  return `;(()=>{let currentRecords=[],lastDeleted;const root=document.querySelector('[data-kind="list"]'),toast=document.querySelector('[data-component="tasks-toast"]');const show=(text,undo=false)=>{if(!toast)return;toast.replaceChildren(document.createTextNode(text));if(undo){const button=document.createElement('button');button.type='button';button.textContent='Annulla';button.style.marginLeft='10px';button.addEventListener('click',()=>{if(lastDeleted)send('RECORD_ACTION',{action:'undo',payload:lastDeleted})});toast.append(button)}toast.hidden=false};const decorate=()=>{root?.querySelectorAll('.record-row').forEach((row)=>{const item=currentRecords.find((record)=>record.text===(row.querySelector('strong')?.textContent||''));if(!item)return;row.querySelector('.record-actions')?.remove();const actions=document.createElement('div'),complete=document.createElement('button'),remove=document.createElement('button'),done=Boolean(item.completed)||item.status==='Completata';actions.className='record-actions';actions.style.display='flex';actions.style.gap='8px';complete.type='button';complete.textContent=done?'Completata':'Completa';complete.disabled=done;complete.addEventListener('click',()=>send('RECORD_ACTION',{action:'update',payload:{...item,status:'Completata',completed:true}}));remove.type='button';remove.textContent='Elimina';remove.style.background='#b42318';remove.addEventListener('click',()=>{if(confirm('Eliminare '+item.text+'?')){lastDeleted=item;send('RECORD_ACTION',{action:'delete',payload:{id:item.id}})}});actions.append(complete,remove);row.append(actions)})};addEventListener('message',(event)=>{const message=event.data;if(message?.channel!=='frontend-editor-host')return;currentRecords=message.records||[];queueMicrotask(decorate);if(message.action==='delete')queueMicrotask(()=>show('Attività eliminata',true));if(message.action==='undo'){lastDeleted=undefined;queueMicrotask(()=>show('Eliminazione annullata'))}})})();`;
}

// Legacy renderers stay available while old saved projects migrate to the unified record renderer.
void todoScript;
void recordConsistencyScript;

function recordEditScript() {
  return `;(()=>{let records=[],editingId,descending=true;const root=document.querySelector('[data-kind="list"]'),form=document.querySelector('form'),submit=form?.querySelector('button[type="submit"]');const decorate=()=>{root?.querySelectorAll('.record-row').forEach((row)=>{if(row.querySelector('.edit-record'))return;const item=records.find((record)=>record.text===(row.querySelector('strong')?.textContent||'')),actions=row.querySelector('.record-actions');if(!item||!actions)return;const edit=document.createElement('button');edit.type='button';edit.className='edit-record';edit.textContent='Modifica';edit.addEventListener('click',()=>{editingId=item.id;Object.entries({title:item.text,description:item.description,status:item.status,priority:item.priority,category:item.category,dueDate:item.dueDate,time:item.time,notes:item.notes}).forEach(([name,value])=>{const field=form?.elements.namedItem(name);if(field&&'value'in field)field.value=value||''});const recurring=form?.elements.namedItem('recurring');if(recurring&&'checked'in recurring)recurring.checked=Boolean(item.recurring);if(submit)submit.textContent='Salva modifiche';form?.scrollIntoView({behavior:'smooth',block:'start'});form?.elements.namedItem('title')?.focus()});actions.prepend(edit)})};new MutationObserver(()=>queueMicrotask(decorate)).observe(root||document.body,{childList:true,subtree:true});form?.addEventListener('submit',(event)=>{if(!editingId)return;event.preventDefault();event.stopImmediatePropagation();if(!form.checkValidity()){form.reportValidity();return}const payload=Object.fromEntries(new FormData(form));payload.id=editingId;payload.text=payload.title;editingId=undefined;if(submit)submit.textContent='Salva attività';send('RECORD_ACTION',{action:'update',payload})},true);document.querySelectorAll('button').forEach((sort)=>{if(!sort.textContent?.toLowerCase().includes('ordina'))return;sort.addEventListener('click',()=>{const list=root?.querySelector('ul');if(!list)return;list.replaceChildren(...[...list.children].reverse());descending=!descending;sort.textContent=descending?'Ordina: recenti':'Ordina: meno recenti'})});addEventListener('message',(event)=>{if(event.data?.channel!=='frontend-editor-host')return;records=event.data.records||[];queueMicrotask(decorate);if(event.data.action==='update'&&form){form.reset();if(submit)submit.textContent='Salva attività'}})})();`;
}

function stableRecordActionsScript(tracksStreak: boolean) {
  const habits = tracksStreak;
  return `;(()=>{let records=[],lastDeleted,lastAction;const habits=${habits},root=document.querySelector('[data-kind="list"]'),toast=document.querySelector('[data-kind="toast"]'),progress=document.querySelector('progress');const text=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value};const show=(message,undo=false)=>{if(!toast)return;toast.replaceChildren(document.createTextNode(message));if(undo){const button=document.createElement('button');button.type='button';button.textContent='Annulla';button.style.marginLeft='10px';button.addEventListener('click',()=>{if(lastDeleted)send('RECORD_ACTION',{action:'undo',payload:lastDeleted})});toast.append(button)}toast.hidden=false};const decorate=()=>{const completed=records.filter((item)=>habits?item.completedToday:(item.completed||item.status==='Completata')).length;if(habits&&progress){progress.max=Math.max(1,records.length);progress.value=completed;progress.textContent='';progress.setAttribute('aria-label',completed+' di '+records.length+' elementi completati');text(progress.parentElement?.firstChild,completed+' di '+records.length+' completati')}root?.querySelectorAll('.record-row').forEach((row)=>{const item=records.find((record)=>record.text===(row.querySelector('strong')?.textContent||''));if(!item)return;if(habits){text(row.querySelector('p'),item.frequency||'');const chips=row.querySelectorAll('.chip'),streak=Number(item.currentStreak)||0;text(chips[0],item.completedToday?'Completata oggi':'Da completare');text(chips[1],streak+' '+(streak===1?'giorno':'giorni'))}if(row.querySelector('.record-actions'))return;const actions=document.createElement('div'),complete=document.createElement('button'),remove=document.createElement('button'),done=habits?Boolean(item.completedToday):(Boolean(item.completed)||item.status==='Completata');actions.className='record-actions';actions.style.display='flex';actions.style.gap='8px';complete.type='button';complete.textContent=done?(habits?'Completata oggi':'Completata'):(habits?'Completa oggi':'Completa');complete.disabled=done;complete.addEventListener('click',()=>{lastAction='complete';const streak=Number(item.currentStreak)||0;send('RECORD_ACTION',{action:'update',payload:habits?{...item,completedToday:true,currentStreak:streak+1,bestStreak:Math.max(Number(item.bestStreak)||0,streak+1),lastCompletedAt:new Date().toISOString()}:{...item,status:'Completata',completed:true}})});remove.type='button';remove.textContent='Elimina';remove.style.background='#b42318';remove.addEventListener('click',()=>{if(confirm('Eliminare '+item.text+'?')){lastDeleted=item;send('RECORD_ACTION',{action:'delete',payload:{id:item.id}})}});actions.append(complete,remove);row.append(actions)})};new MutationObserver(()=>queueMicrotask(decorate)).observe(root||document.body,{childList:true,subtree:true});addEventListener('message',(event)=>{const message=event.data;if(message?.channel!=='frontend-editor-host')return;records=message.records||[];queueMicrotask(decorate);if(message.action==='update'&&lastAction==='complete'){queueMicrotask(()=>show('Elemento completato'));lastAction=undefined}if(message.action==='delete')queueMicrotask(()=>show('Elemento eliminato',true));if(message.action==='undo'){lastDeleted=undefined;queueMicrotask(()=>show('Eliminazione annullata'))}})})();`;
}

function recordUpdateToastScript() {
  return `;(()=>{let editing=false;const toast=document.querySelector('[data-kind="toast"]');document.addEventListener('click',(event)=>{if(event.target.closest?.('.edit-record'))editing=true},true);addEventListener('message',(event)=>{const message=event.data;if(message?.channel!=='frontend-editor-host'||message.action!=='update'||!toast)return;toast.replaceChildren(document.createTextNode(editing?'Elemento aggiornato':'Elemento completato'));toast.hidden=false;editing=false})})();`;
}

function recordEditClickGuardScript() {
  return `;(()=>{let records=[];const form=document.querySelector('form'),submit=form?.querySelector('button[type="submit"]');document.addEventListener('click',(event)=>{const edit=event.target.closest?.('.edit-record');if(edit){const title=edit.closest('.record-row')?.querySelector('strong')?.textContent||'',item=records.find((record)=>record.text===title);if(item&&form)form.dataset.editingId=item.id;return}if(event.target!==submit||!form?.dataset.editingId)return;event.preventDefault();event.stopImmediatePropagation();if(!form.checkValidity()){form.reportValidity();return}const payload=Object.fromEntries(new FormData(form));payload.id=form.dataset.editingId;payload.text=payload.title;delete form.dataset.editingId;submit.textContent='Salva attività';send('RECORD_ACTION',{action:'update',payload})},true);addEventListener('message',(event)=>{if(event.data?.channel!=='frontend-editor-host')return;records=event.data.records||[];if(event.data.action==='update'&&form){delete form.dataset.editingId;form.reset();if(submit)submit.textContent='Salva attività'}})})();`;
}

function landingScript(interactive: boolean) {
  return `const toast=document.querySelector('.toast'),landing=document.querySelector('.landing'),menu=document.querySelector('.mobile-menu'),menuLinks=document.querySelector('nav div'),modal=document.querySelector('.modal-backdrop');const showToast=(text)=>{toast.textContent=text;toast.hidden=false;clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>toast.hidden=true,2400)};const showPage=(page)=>{const target=page==='about'?'contact':page;const rich=['pricing','contact'].includes(target);[...landing.children].forEach((section)=>section.hidden=rich?!section.classList.contains(target+'-page'):section.classList.contains('rich-page'));menuLinks?.classList.remove('open');menu?.setAttribute('aria-expanded','false');if(rich)document.querySelector('#'+target)?.scrollIntoView({block:'start'})};document.querySelectorAll('nav a').forEach((link)=>link.addEventListener('click',(event)=>{const target=link.getAttribute('href')?.slice(1)||'';if(['pricing','about','contact'].includes(target)){event.preventDefault();location.hash=target;showPage(target)}else showPage('home')}));document.querySelectorAll('[data-page-target]').forEach((button)=>button.addEventListener('click',()=>{modal.hidden=true;location.hash=button.dataset.pageTarget;showPage(button.dataset.pageTarget)}));document.querySelectorAll('[data-landing-action]').forEach((button)=>button.addEventListener('click',()=>{if(!${interactive})return;if(button.dataset.landingAction==='features'){showPage('home');document.querySelector('#features')?.scrollIntoView({behavior:'smooth'});location.hash='features'}else showToast('Interactive demo enabled — your workspace is ready.')}));menu?.addEventListener('click',()=>{const open=menuLinks?.classList.toggle('open');menu.setAttribute('aria-expanded',String(Boolean(open)))});document.querySelectorAll('[data-open-modal]').forEach((button)=>button.addEventListener('click',()=>{modal.hidden=false;modal.querySelector('button')?.focus()}));document.querySelector('.modal-close')?.addEventListener('click',()=>modal.hidden=true);modal?.addEventListener('click',(event)=>{if(event.target===modal)modal.hidden=true});document.querySelector('[data-component="'+(${JSON.stringify("placeholder")})+'"]');const planSearch=document.querySelector('.plan-search input'),planEmpty=document.querySelector('.plan-empty');planSearch?.addEventListener('input',()=>{let visible=0;document.querySelectorAll('[data-plan]').forEach((plan)=>{plan.hidden=!plan.dataset.plan.includes(planSearch.value.trim().toLowerCase());if(!plan.hidden)visible++});planEmpty.hidden=Boolean(visible)});const contactForm=document.querySelector('.contact-page form'),contactError=document.querySelector('.contact-error'),contactButton=contactForm?.querySelector('button[type="submit"]');contactForm?.addEventListener('submit',(event)=>{event.preventDefault();if(!contactForm.checkValidity()){contactError.textContent='Completa nome, email e messaggio con valori validi.';contactForm.reportValidity();return}contactError.textContent='';contactButton.disabled=true;const input=Object.fromEntries(new FormData(contactForm));send('ADD',{value:input.name+' <'+input.email+'>: '+input.message})});addEventListener('message',(event)=>{const message=event.data;if(message?.channel!=='frontend-editor-host')return;const history=document.querySelector('.contact-history');if(!history)return;contactButton&&(contactButton.disabled=false);history.querySelector('.loading').hidden=true;const items=message.records||[];history.querySelector('.empty').hidden=Boolean(items.length)||Boolean(message.error);contactError.textContent=message.error||'';const list=history.querySelector('ul');list.replaceChildren(...items.map((item)=>{const row=document.createElement('li');row.textContent=item.text;return row}));if(!message.error&&message.action==='add'){contactForm.reset();showToast('Richiesta salvata con successo')}});addEventListener('hashchange',()=>showPage(location.hash.slice(1)));showPage(location.hash.slice(1)||'home');send('READY')`;
}

function landingValidationScript() {
  return `;document.addEventListener('invalid',(event)=>{const form=event.target.closest?.('.contact-page form');if(form)form.querySelector('.contact-error').textContent='Completa nome, email e messaggio con valori validi.'},true);document.addEventListener('click',(event)=>{const button=event.target.closest?.('.contact-page button[type="submit"]');if(!button)return;event.preventDefault();const form=button.form,error=form.querySelector('.contact-error');if(!form.checkValidity()){error.textContent='Completa nome, email e messaggio con valori validi.';form.reportValidity();return}error.textContent='';button.disabled=true;const input=Object.fromEntries(new FormData(form));send('ADD',{value:input.name+' <'+input.email+'>: '+input.message})});`;
}

function dashboardScript(interactive: boolean) {
  return `let records=[],descending=true;const table=document.querySelector('tbody'),loading=document.querySelector('#dash-loading'),empty=document.querySelector('#dash-empty'),problem=document.querySelector('#dash-error'),search=document.querySelector('#project-search'),filter=document.querySelector('#status-filter'),modal=document.querySelector('#project-modal'),form=modal.querySelector('form'),toast=document.querySelector('.toast');const showToast=(text,isError=false)=>{toast.textContent=text;toast.style.background=isError?'#b42318':'#172033';toast.hidden=false;setTimeout(()=>toast.hidden=true,2400)};const filtered=()=>records.filter((item)=>(filter.value==='All statuses'||item.status===filter.value)&&((item.text||'')+' '+(item.description||'')).toLowerCase().includes(search.value.toLowerCase())).sort((a,b)=>descending?b.date.localeCompare(a.date):a.date.localeCompare(b.date));const chip=(value)=>String(value||'').toLowerCase().replaceAll(' ','-');const render=()=>{const shown=filtered();table.replaceChildren(...shown.map((item)=>{const row=document.createElement('tr');row.innerHTML='<td><strong></strong><small></small></td><td><span class="chip"></span></td><td><span class="chip"></span></td><td></td><td><div class="row-actions"><button class="edit">Edit</button><button class="delete">Delete</button></div></td>';row.dataset.id=item.id;row.querySelector('strong').textContent=item.text;row.querySelector('small').textContent=item.description||'';const chips=row.querySelectorAll('.chip');chips[0].textContent=item.status||'';chips[0].classList.add(chip(item.status));chips[1].textContent=item.priority||'';chips[1].classList.add(chip(item.priority));row.children[3].textContent=item.dueDate?new Date(item.dueDate+'T00:00:00').toLocaleDateString('it'):'';return row}));empty.hidden=Boolean(shown.length);document.querySelector('[data-kpi="total"]').textContent=records.length;document.querySelector('[data-kpi="progress"]').textContent=records.filter((r)=>r.status==='In progress').length;document.querySelector('[data-kpi="completed"]').textContent=records.filter((r)=>r.status==='Completed').length;document.querySelector('[data-kpi="priority"]').textContent=records.filter((r)=>r.priority==='High').length};const openForm=(item)=>{form.reset();form.elements.id.value=item?.id||'';form.elements.name.value=item?.text||'';form.elements.description.value=item?.description||'';form.elements.status.value=item?.status||'Planned';form.elements.priority.value=item?.priority||'Medium';form.elements.dueDate.value=item?.dueDate||'';document.querySelector('#project-modal-title').textContent=item?'Edit project':'Create project';form.querySelector('.form-error').textContent='';modal.hidden=false;form.elements.name.focus()};document.querySelector('#new-project')?.addEventListener('click',()=>${interactive ? "openForm()" : "undefined"});document.querySelectorAll('.modal-close,.modal-cancel').forEach((button)=>button.addEventListener('click',()=>modal.hidden=true));form.addEventListener('invalid',()=>form.querySelector('.form-error').textContent='Complete all required fields with valid values.',true);form.addEventListener('submit',(event)=>{event.preventDefault();if(!form.checkValidity()){form.querySelector('.form-error').textContent='Complete all required fields with valid values.';form.reportValidity();return}const payload=Object.fromEntries(new FormData(form));send('DASHBOARD_ACTION',{action:payload.id?'update':'create',payload})});table.addEventListener('click',(event)=>{const row=event.target.closest('tr');if(!row)return;const item=records.find((record)=>record.id===row.dataset.id);if(event.target.closest('.edit'))openForm(item);if(event.target.closest('.delete')&&confirm('Delete '+item.text+'?'))send('DASHBOARD_ACTION',{action:'delete',payload:{id:item.id}})});search.addEventListener('input',render);filter.addEventListener('change',render);document.querySelector('#sort-projects').addEventListener('click',(event)=>{descending=!descending;event.currentTarget.textContent=descending?'Sort: newest':'Sort: oldest';render()});document.querySelector('.sidebar-toggle').addEventListener('click',()=>document.querySelector('.dashboard-shell>aside').classList.toggle('open'));addEventListener('message',(event)=>{const message=event.data;if(message?.channel!=='frontend-editor-host')return;loading.hidden=true;if(message.error){problem.hidden=false;problem.textContent=message.error;showToast(message.error,true);return}problem.hidden=true;records=message.records||[];modal.hidden=true;render();if(message.action)showToast(message.action==='delete'?'Project deleted':'Project saved successfully')});send('READY')`;
}

function dashboardValidationScript() {
  return `;document.querySelector('#project-modal button[type="submit"]').addEventListener('click',(event)=>{event.preventDefault();if(!form.checkValidity()){form.querySelector('.form-error').textContent='Complete all required fields with valid values.';form.reportValidity();return}const payload=Object.fromEntries(new FormData(form));send('DASHBOARD_ACTION',{action:payload.id?'update':'create',payload})},true);`;
}

export function buildExperienceAssets(
  experience: "landing" | "dashboard",
  components: EditorComponent[],
) {
  return experience === "landing"
    ? {
        markup: landingMarkup(components),
        css: landingCss(),
        script: landingScript(true) + landingValidationScript(),
      }
    : {
        markup: dashboardMarkup(components),
        css: dashboardCss(),
        script: dashboardScript(true) + dashboardValidationScript(),
      };
}

export function PreviewFrame({
  project,
  pageId,
  breakpoint,
  interactive,
  onAdd,
  onRunFlow,
  onRefresh,
  onDashboardAction,
  onRecordAction,
  error,
  captureRequest,
  onCapture,
  onCaptureError,
  onRuntimeLog,
  onNavigatePage,
  onThemeChange,
}: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const { pages, flows, dataSources, theme } = project;
  const page = pages.find((candidate) => candidate.id === pageId);
  const sourceId = page?.components.find((component) => component.binding?.state === "data")?.binding?.sourceId ?? dataSources[0]?.id;
  const source = dataSources.find((candidate) => candidate.id === sourceId);
  const tracksStreak = Boolean(source && Object.hasOwn(source.schema, "completedToday") && Object.hasOwn(source.schema, "currentStreak"));
  const supportsStructuredEdit = Boolean(source && Object.hasOwn(source.schema, "title") && Object.hasOwn(source.schema, "dueDate"));
  const experience = project.state.experience;
  const srcDoc = useMemo(() => {
    const components =
      experience === "landing"
        ? pages.flatMap((candidate) => candidate.components)
        : (page?.components ?? []);
    const markup =
      experience === "landing"
        ? landingMarkup(components)
        : experience === "dashboard"
          ? dashboardMarkup(components)
          : `<main>${componentTree(components).map(renderBranch).join("\n")}</main>`;
    const navigation = buildBottomNavigation(project, page?.path);
    const css =
      experience === "landing"
        ? landingCss()
        : experience === "dashboard"
          ? dashboardCss()
          : "body{padding:24px}main{position:relative;min-height:680px;display:grid;gap:14px;width:min(680px,100%);margin:auto}";
    const hasGraphBindings = components.some((component) => Object.keys(component.events).length > 0);
    const behavior =
      experience === "landing"
        ? landingScript(interactive) + landingValidationScript()
        : experience === "dashboard"
          ? dashboardScript(interactive) + dashboardValidationScript()
          : todoListRenderer(interactive && !hasGraphBindings) + stableRecordActionsScript(tracksStreak) + (supportsStructuredEdit ? recordUpdateToastScript() + recordEditScript() + recordEditClickGuardScript() : "");
    const capture = `addEventListener('message',(event)=>{if(event.data?.channel!=='frontend-editor-capture')return;try{const width=Math.min(2400,Math.max(1,document.documentElement.scrollWidth)),height=Math.min(2400,Math.max(1,document.documentElement.scrollHeight)),copy=document.documentElement.cloneNode(true);copy.querySelectorAll('script').forEach((node)=>node.remove());send('CAPTURE_HTML',{html:'<!doctype html>'+copy.outerHTML,width,height})}catch(error){send('CAPTURE_ERROR',{error:String(error)})}});`;
    const navigationBehavior = `document.querySelectorAll('[data-fe-page]').forEach((item)=>item.addEventListener('click',()=>send('NAVIGATE_PAGE',{path:item.dataset.fePage})));`;
    const themeBehavior = `;(()=>{const control=document.querySelector('[name="theme"]'),normalize=(value)=>/scur|dark/i.test(value)?'dark':/chiar|light/i.test(value)?'light':'system',apply=(mode)=>{const resolved=mode==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):mode;document.documentElement.dataset.theme=resolved;if(control)control.value=[...control.options].find((option)=>normalize(option.value)===mode)?.value||control.value};apply(${JSON.stringify(project.appConfig.themeMode ?? "system")});control?.addEventListener('change',()=>{const mode=normalize(control.value);apply(mode);send('SET_THEME',{mode})})})();`;
    const observability = `;const feLogText=(value)=>{try{return typeof value==='string'?value:JSON.stringify(value)}catch{return String(value)}};['log','info','warn','error'].forEach((level)=>{const original=console[level].bind(console);console[level]=(...values)=>{original(...values);send('RUNTIME_LOG',{level:level==='error'?'error':'info',message:values.map(feLogText).join(' ')})}});addEventListener('error',(event)=>send('RUNTIME_LOG',{level:'error',message:event.message||'Errore runtime'}));addEventListener('unhandledrejection',(event)=>send('RUNTIME_LOG',{level:'error',message:'Promise non gestita: '+feLogText(event.reason)}));`;
    return `<!doctype html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#172033;background:#f7f8fc}html[data-theme=dark]{color-scheme:dark;color:#f3f4f6;background:#0f1115}html[data-theme=dark] body{color:#f3f4f6!important;background:#0f1115!important;background-image:none!important}html[data-theme=dark] input,html[data-theme=dark] textarea,html[data-theme=dark] select{color:#f3f4f6;background:#1d2229;border-color:#4b5563}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0}button,input,textarea,select{font:inherit}button{cursor:pointer;border:0;border-radius:10px;padding:11px 14px;background:#6d5dfc;color:#fff;font-weight:700}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #8b7fff;outline-offset:3px}input,textarea,select{width:100%;border:1px solid #cfd4df;border-radius:9px;padding:10px;background:#fff}label{display:grid;gap:5px;font-size:12px;font-weight:700}ul{list-style:none;padding:0}.record-row{display:grid;gap:6px;padding:14px 0;border-bottom:1px solid #ffffff20}.record-row p{margin:0;opacity:.78}.record-row div{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.record-row time{margin-left:auto;font-size:12px;opacity:.72}.chip{display:inline-flex;padding:4px 8px;border-radius:999px;background:#ffffff18;font-size:11px}.preview-container{display:grid;gap:12px}.preview-grid{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}.app-bottom-nav{position:sticky;z-index:20;bottom:0;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;padding:8px max(8px,env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));border-top:1px solid #cfd4df;background:color-mix(in srgb,${theme.tokens.pageBackground ?? "#ffffff"} 92%,transparent);backdrop-filter:blur(16px)}.app-bottom-nav button{min-height:44px;padding:8px;background:transparent;color:inherit;font-size:12px}.app-bottom-nav button[aria-current=page]{background:#6d5dfc;color:#fff}@keyframes fe-fade{from{opacity:0}to{opacity:1}}@keyframes fe-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}@keyframes fe-pulse{50%{transform:scale(1.04)}}@keyframes fe-float{50%{transform:translateY(-8px)}}.error{color:#b42318}.empty,.loading{color:#697386;padding:12px 0}${css}${components.map((component) => styleFor(component, breakpoint)).join("\n")}body{background:${theme.tokens.pageBackground ?? "#ffffff"};background-image:${theme.tokens.pageBackgroundImage ?? "none"};background-size:cover;background-position:center}</style></head><body>${markup}${navigation}<script>const send=(type,payload={})=>parent.postMessage({channel:'frontend-editor-preview',type,...payload},'*');${observability}${capture}${navigationBehavior}${themeBehavior}${behavior}${flowTriggerScript(pages, flows, experience, interactive)}</script></body></html>`;
  }, [project, page, pages, flows, theme, breakpoint, interactive, experience, tracksStreak, supportsStructuredEdit]);

  useEffect(() => {
    const listener = async (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.data?.channel !== "frontend-editor-preview"
      )
        return;
      if (event.data.type === "READY") {
        ready.current = true;
        const records = sourceId ? await onRefresh(sourceId) : [];
        frame.current?.contentWindow?.postMessage(
          { channel: "frontend-editor-host", records, error },
          "*",
        );
        if (captureRequest)
          frame.current?.contentWindow?.postMessage(
            { channel: "frontend-editor-capture" },
            "*",
          );
      }
      if (event.data.type === "CAPTURE_HTML") {
        try {
          onCapture?.(
            await rasterizePreview(
              String(event.data.html),
              Number(event.data.width),
              Number(event.data.height),
            ),
          );
        } catch (problem) {
          onCaptureError?.(
            problem instanceof Error ? problem.message : String(problem),
          );
        }
      }
      if (event.data.type === "CAPTURE_ERROR")
        onCaptureError?.(String(event.data.error));
      if (event.data.type === "RUNTIME_LOG")
        onRuntimeLog?.(event.data.level === "error" ? "error" : "info", String(event.data.message ?? ""));
      if (event.data.type === "NAVIGATE_PAGE")
        onNavigatePage?.(String(event.data.path ?? ""));
      if (event.data.type === "SET_THEME" && ["light", "dark", "system"].includes(String(event.data.mode)))
        onThemeChange?.(event.data.mode);
      if (event.data.type === "ADD") {
        try {
          await onAdd(String(event.data.value ?? ""));
          frame.current?.contentWindow?.postMessage(
            {
              channel: "frontend-editor-host",
              records: sourceId ? await onRefresh(sourceId) : [],
              action: "add",
            },
            "*",
          );
        } catch (problem) {
          frame.current?.contentWindow?.postMessage(
            {
              channel: "frontend-editor-host",
              records: [],
              error:
                problem instanceof Error ? problem.message : String(problem),
            },
            "*",
          );
        }
      }
      if (event.data.type === "RUN_FLOW" && onRunFlow) {
        try {
          const outcome = await onRunFlow(String(event.data.flowId ?? ""), event.data.input);
          if (outcome.navigate?.mode === "page") onNavigatePage?.(outcome.navigate.path);
          frame.current?.contentWindow?.postMessage({ channel: "frontend-editor-host", action: "flow", records: sourceId ? await onRefresh(sourceId) : [], ...outcome }, "*");
        } catch (problem) {
          const message = problem instanceof Error ? problem.message : String(problem);
          frame.current?.contentWindow?.postMessage({ channel: "frontend-editor-host", action: "flow", notification: message, error: message, records: sourceId ? await onRefresh(sourceId) : [], level: "error" }, "*");
        }
      }
      if (event.data.type === "DASHBOARD_ACTION" && onDashboardAction) {
        try {
          const records = await onDashboardAction(
            String(event.data.action),
            event.data.payload,
          );
          frame.current?.contentWindow?.postMessage(
            {
              channel: "frontend-editor-host",
              records,
              action: event.data.action,
            },
            "*",
          );
        } catch (problem) {
          frame.current?.contentWindow?.postMessage(
            {
              channel: "frontend-editor-host",
              records: sourceId ? await onRefresh(sourceId) : [],
              error:
                problem instanceof Error ? problem.message : String(problem),
            },
            "*",
          );
        }
      }
      if (event.data.type === "RECORD_ACTION" && onRecordAction) {
        try {
          const action = String(event.data.action) as "update" | "delete" | "undo";
          const records = await onRecordAction(action, event.data.payload, sourceId);
          frame.current?.contentWindow?.postMessage({ channel: "frontend-editor-host", records, action }, "*");
        } catch (problem) {
          const message = problem instanceof Error ? problem.message : String(problem);
          frame.current?.contentWindow?.postMessage({ channel: "frontend-editor-host", records: sourceId ? await onRefresh(sourceId) : [], error: message }, "*");
        }
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [
    onAdd,
    onRunFlow,
    onRuntimeLog,
    onNavigatePage,
    onThemeChange,
    onRefresh,
    onDashboardAction,
    onRecordAction,
    sourceId,
    error,
    captureRequest,
    onCapture,
    onCaptureError,
  ]);

  useEffect(() => {
    if (captureRequest && ready.current)
      frame.current?.contentWindow?.postMessage(
        { channel: "frontend-editor-capture" },
        "*",
      );
  }, [captureRequest]);
  useEffect(() => {
    ready.current = false;
  }, [srcDoc]);

  return (
    <iframe
      ref={frame}
      title="Preview isolata"
      sandbox="allow-scripts allow-modals"
      srcDoc={srcDoc}
      className={`preview-frame preview-${breakpoint}`}
    />
  );
}
