import JSZip from 'jszip'
import type { Breakpoint, EditorComponent, Project } from './model'
import { parseProject, serializeProject } from './model'
import { buildExperienceAssets } from './PreviewFrame'

const htmlEscape = (value: unknown) => String(value ?? '').replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]!)
const cssEscape = (value: unknown) => String(value ?? '').replace(/[{};]/g, '')

function componentHtml(component: EditorComponent) {
  const label = htmlEscape(component.props.label || component.name)
  if (component.type === 'input') return `<label>${htmlEscape(component.accessibility.label)}<input id="${component.id}" placeholder="${htmlEscape(component.props.placeholder)}" /></label>`
  if (component.type === 'button') return `<button id="${component.id}" type="button">${label}</button>`
  if (component.type === 'list') return `<section id="${component.id}" aria-label="${htmlEscape(component.accessibility.label)}"><div class="status" role="status">Caricamento…</div><ul></ul></section>`
  if (component.type === 'title') return `<h1 id="${component.id}">${label}</h1>`
  if (component.type === 'textarea') return `<label>${htmlEscape(component.accessibility.label)}<textarea id="${component.id}"></textarea></label>`
  if (component.type === 'checkbox') return `<label><input id="${component.id}" type="checkbox" /> ${label}</label>`
  return `<div id="${component.id}" role="${htmlEscape(component.accessibility.role || 'group')}">${label}</div>`
}

function componentCss(component: EditorComponent, breakpoint: Breakpoint) {
  const style = { ...component.styles.desktop, ...(breakpoint === 'desktop' ? {} : component.styles[breakpoint]) }
  return `[id="${component.id}"]{${Object.entries(style).map(([key, value]) => `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${cssEscape(value)}`).join(';')}}`
}

function commonExportFiles(project: Project) {
  return {
    'package.json': JSON.stringify({ name: project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'generated-app', private: true, version: '1.0.0', type: 'module', scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' }, devDependencies: { typescript: '^5.8.3', vite: '^7.1.4' } }, null, 2),
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM'], module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true, allowJs: true, checkJs: false }, include: ['src'] }, null, 2),
    'capacitor.config.ts': `export default { appId: 'com.frontendeditor.${project.id.replace(/-/g, '').slice(0, 12)}', appName: ${JSON.stringify(project.name)}, webDir: 'dist' }`,
    'project.frontend-editor.json': serializeProject(project),
    'README.md': `# ${project.name}\n\n\`npm install\`, poi \`npm run dev\`. Build: \`npm run build\`. Per Android installare @capacitor/cli e @capacitor/android, quindi \`npx cap add android\` e \`npx cap sync\`. Nessun segreto è incluso.`,
  }
}

function generateExperienceFiles(project: Project, experience: 'landing' | 'dashboard'): Record<string, string> {
  const page = project.pages[0]
  const assets = buildExperienceAssets(experience, page.components)
  const desktop = page.components.map((component) => componentCss(component, 'desktop')).join('\n')
  const tablet = page.components.map((component) => componentCss(component, 'tablet')).join('\n')
  const mobile = page.components.map((component) => componentCss(component, 'mobile')).join('\n')
  const baseCss = `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#172033;background:#f7f8fc}*{box-sizing:border-box}body{margin:0}button,input,textarea,select{font:inherit}button{cursor:pointer;border:0;border-radius:10px;padding:11px 14px;background:#6d5dfc;color:#fff;font-weight:700}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #8b7fff;outline-offset:3px}input,textarea,select{width:100%;border:1px solid #cfd4df;border-radius:9px;padding:10px;background:#fff}label{display:grid;gap:5px;font-size:12px;font-weight:700}${assets.css}${desktop}\n@media(max-width:900px){${tablet}}\n@media(max-width:600px){${mobile}}`
  const landingMain = `import './style.css'\nawait import('./ui.js')\n`
  const dashboardMain = `import './style.css'

type Status = 'Planned' | 'In progress' | 'Completed' | 'On hold'
type Priority = 'Low' | 'Medium' | 'High'
type ProjectInput = { id?: string; name: string; description: string; status: Status; priority: Priority; dueDate: string }
type Item = { id: string; sourceId: string; text: string; description: string; status: Status; priority: Priority; dueDate: string; date: string }
const sourceId = ${JSON.stringify(project.dataSources[0]?.id ?? '')}
if (!sourceId) throw new Error('Sorgente dati dashboard non configurata')
const openDb = () => new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('frontend-editor-export', 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records', { keyPath: 'id' }).createIndex('sourceId', 'sourceId') }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
async function query(): Promise<Item[]> { const db = await openDb(); return new Promise((resolve, reject) => { const request = db.transaction('records').objectStore('records').index('sourceId').getAll(sourceId); request.onsuccess = () => resolve((request.result as Item[]).sort((a, b) => b.date.localeCompare(a.date))); request.onerror = () => reject(request.error) }) }
async function save(input: ProjectInput): Promise<void> {
  if (input.name.trim().length < 2 || input.description.trim().length < 4 || !/^\\d{4}-\\d{2}-\\d{2}$/.test(input.dueDate)) throw new Error('Complete all required fields with valid values.')
  const db = await openDb(); const existingId = input.id; const existing = existingId ? (await new Promise<Item | undefined>((resolve, reject) => { const request = db.transaction('records').objectStore('records').get(existingId); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })) : undefined
  const item: Item = { id: existing?.id ?? crypto.randomUUID(), sourceId, text: input.name.trim(), description: input.description.trim(), status: input.status, priority: input.priority, dueDate: input.dueDate, date: new Date().toISOString() }
  await new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put(item); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}
async function remove(id: string): Promise<void> { const db = await openDb(); await new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }) }
declare global { interface Window { dashboardData: { query: () => Promise<Item[]>; action: (action: string, payload: ProjectInput) => Promise<Item[]> } } }
window.dashboardData = { query, action: async (action, payload) => { if (action === 'delete') await remove(String(payload.id)); else await save(payload); return query() } }
await import('./ui.js')
`
  const ui = experience === 'landing'
    ? `export {};const send=()=>{};${assets.script}`
    : `export {};const deliver=(detail)=>dispatchEvent(new MessageEvent('message',{data:{channel:'frontend-editor-host',...detail}}));const send=async(type,payload={})=>{try{if(type==='READY')deliver({records:await window.dashboardData.query()});if(type==='DASHBOARD_ACTION')deliver({records:await window.dashboardData.action(payload.action,payload.payload),action:payload.action})}catch(error){deliver({records:await window.dashboardData.query(),error:error instanceof Error?error.message:String(error)})}};${assets.script}`
  return {
    ...commonExportFiles(project),
    'index.html': `<!doctype html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(project.name)}</title></head><body>${assets.markup}<script type="module" src="/src/main.ts"></script></body></html>`,
    'src/main.ts': experience === 'landing' ? landingMain : dashboardMain,
    'src/ui.js': ui,
    'src/style.css': baseCss,
  }
}

export function generateFiles(input: Project): Record<string, string> {
  const project = parseProject(input)
  const page = project.pages[0]
  if (!page) throw new Error('Aggiungi almeno una pagina prima dell’export')
  if (project.state.experience === 'landing' || project.state.experience === 'dashboard') {
    if (!project.flows.length) throw new Error('Configura i flow prima dell’export')
    if (project.state.experience === 'dashboard' && !project.dataSources.length) throw new Error('Configura la sorgente dati prima dell’export')
    return generateExperienceFiles(project, project.state.experience)
  }
  const inputComponent = page.components.find((component) => component.type === 'input')
  const button = page.components.find((component) => component.type === 'button')
  const list = page.components.find((component) => component.type === 'list')
  const source = project.dataSources[0]
  const body = `<nav aria-label="Pagine">${project.pages.map((item) => `<a href="#${htmlEscape(item.path)}">${htmlEscape(item.name)}</a>`).join('')}</nav>${project.pages.map((item) => `<section data-route="${htmlEscape(item.path)}">${item.components.map(componentHtml).join('\n')}</section>`).join('')}`
  const allComponents = project.pages.flatMap((item) => item.components)
  const desktop = allComponents.map((component) => componentCss(component, 'desktop')).join('\n')
  const tablet = allComponents.map((component) => componentCss(component, 'tablet')).join('\n')
  const mobile = allComponents.map((component) => componentCss(component, 'mobile')).join('\n')
  const main = `import './style.css'

type Item = { id: string; sourceId: string; text: string; date: string }
const sourceId = ${JSON.stringify(source?.id ?? 'local-items')}
const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('frontend-editor-export', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' }).createIndex('sourceId', 'sourceId')
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})
async function query(): Promise<Item[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => { const request = db.transaction('records').objectStore('records').index('sourceId').getAll(sourceId); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
}
async function insert(text: string) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').add({ id: crypto.randomUUID(), sourceId, text, date: new Date().toISOString() }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}
const status = document.querySelector<HTMLElement>('.status')
const list = document.getElementById('${list?.id ?? ''}')?.querySelector('ul')
async function refresh() {
  if (!status || !list) return
  status.textContent = 'Caricamento…'
  try { const items = await query(); list.replaceChildren(...items.map((item) => { const li = document.createElement('li'); li.textContent = item.text; return li })); status.textContent = items.length ? '' : 'Nessuna attività. Aggiungine una.' }
  catch (error) { status.textContent = 'Errore: ' + (error instanceof Error ? error.message : String(error)) }
}
function route() { const path = decodeURIComponent(location.hash.slice(1) || '/'); document.querySelectorAll<HTMLElement>('[data-route]').forEach((section) => { section.hidden = section.dataset.route !== path }) }
addEventListener('hashchange', route); route()
document.getElementById('${button?.id ?? ''}')?.addEventListener('click', async () => {
  const input = document.getElementById('${inputComponent?.id ?? ''}') as HTMLInputElement | null
  if (!input?.value.trim()) { input?.setAttribute('aria-invalid', 'true'); status!.textContent = 'Il valore è obbligatorio'; return }
  await insert(input.value.trim()); input.value = ''; input.removeAttribute('aria-invalid'); await refresh()
})
void refresh()
`
  return {
    'package.json': JSON.stringify({ name: project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'generated-app', private: true, version: '1.0.0', type: 'module', scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' }, devDependencies: { typescript: '^5.8.3', vite: '^7.1.4' } }, null, 2),
    'index.html': `<!doctype html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(project.name)}</title></head><body><main>${body}</main><script type="module" src="/src/main.ts"></script></body></html>`,
    'src/main.ts': main,
    'src/style.css': `:root{font-family:Inter,system-ui,sans-serif;color:#172033;background:#f5f7fb}*{box-sizing:border-box}body{margin:0}main{width:min(680px,calc(100% - 32px));margin:48px auto;display:grid;gap:16px}nav{display:flex;gap:12px}nav a{color:#5547d9}[data-route]{display:grid;gap:16px}[data-route][hidden]{display:none}${desktop}\n@media(max-width:900px){${tablet}}\n@media(max-width:600px){main{margin:20px auto}${mobile}}button,input,textarea{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #8b7fff;outline-offset:2px}ul{display:grid;gap:8px;padding:0;list-style:none}li{padding:12px;background:white;border-radius:10px}`,
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM'], module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true }, include: ['src'] }, null, 2),
    'capacitor.config.ts': `export default { appId: 'com.frontendeditor.${project.id.replace(/-/g, '').slice(0, 12)}', appName: ${JSON.stringify(project.name)}, webDir: 'dist' }`,
    'project.frontend-editor.json': serializeProject(project),
    'README.md': `# ${project.name}\n\n\`npm install\`, poi \`npm run dev\`. Build: \`npm run build\`. Per Android installare @capacitor/cli e @capacitor/android, quindi \`npx cap add android\` e \`npx cap sync\`. Nessun segreto è incluso.`,
  }
}

export async function downloadGeneratedApp(project: Project) {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(generateFiles(project))) zip.file(path, content)
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'app'}.zip`
  link.click()
  URL.revokeObjectURL(url)
}
