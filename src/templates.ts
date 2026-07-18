import { createProject, makeComponent, type EditorComponent, type Project } from './model'

function component(type: EditorComponent['type'], name: string, label: string, slot: string, props: Record<string, string | number | boolean> = {}) {
  const value = makeComponent(type)
  value.name = name
  value.props = { ...value.props, label, slot, ...props }
  value.accessibility.label = label
  return value
}

function style(value: EditorComponent, desktop: Partial<EditorComponent['styles']['desktop']>, mobile: Partial<EditorComponent['styles']['mobile']> = {}) {
  value.styles.desktop = { ...value.styles.desktop, ...desktop }
  value.styles.tablet = { ...value.styles.tablet, width: '100%' }
  value.styles.mobile = { ...value.styles.mobile, width: '100%', ...mobile }
  return value
}

export function createLandingProject(name: string): Project {
  const project = createProject(name)
  const components = [
    style(component('navbar', 'Navbar', 'Northstar', 'navbar', { links: 'Features,Pricing,About' }), { background: '#0b1020', color: '#ffffff', borderRadius: '16px', padding: '18px 24px', boxShadow: '0 14px 32px #0b10202e' }),
    style(component('title', 'Hero title', 'Build clearer products, faster.', 'hero-title'), { fontSize: '56px', color: '#101528', background: '#f5f3ff', padding: '24px 0 8px' }, { fontSize: '38px' }),
    style(component('text', 'Hero description', 'A focused workspace for teams that want less busywork and more momentum.', 'hero-copy'), { fontSize: '20px', color: '#536078', background: '#f5f3ff' }),
    style(component('button', 'Primary CTA', 'Explore features', 'hero-primary'), { width: '190px', background: '#6d5dfc', color: '#ffffff', borderRadius: '12px', boxShadow: '0 10px 24px #6d5dfc45' }),
    style(component('button', 'Secondary CTA', 'See how it works', 'hero-secondary'), { width: '190px', background: '#ffffff', color: '#4036b8', borderRadius: '12px' }),
    style(component('image', 'Hero visual', 'Product workspace preview', 'hero-visual'), { minHeight: '340px', background: '#161b32', borderRadius: '24px', boxShadow: '0 26px 60px #20264b38' }),
    component('title', 'Features heading', 'Everything your team needs to move.', 'features-title'),
    style(component('card', 'Feature card 1', 'Plan with confidence', 'feature', { description: 'Turn priorities into a calm, shared roadmap.', icon: '◇' }), { width: '31%', minHeight: '190px', background: '#ffffff', padding: '24px', boxShadow: '0 14px 34px #30385814' }),
    style(component('card', 'Feature card 2', 'Ship together', 'feature', { description: 'Keep decisions, progress and ownership in sync.', icon: '↗' }), { width: '31%', minHeight: '190px', background: '#ffffff', padding: '24px', boxShadow: '0 14px 34px #30385814' }),
    style(component('card', 'Feature card 3', 'Learn continuously', 'feature', { description: 'See what works and improve every cycle.', icon: '◎' }), { width: '31%', minHeight: '190px', background: '#ffffff', padding: '24px', boxShadow: '0 14px 34px #30385814' }),
    style(component('card', 'Call to action', 'Ready to give work more focus?', 'cta', { description: 'Start with a simple system your whole team will actually use.' }), { background: '#6d5dfc', color: '#ffffff', padding: '42px', borderRadius: '22px', boxShadow: '0 18px 42px #6d5dfc3b' }),
    style(component('text', 'Footer', '© 2026 Northstar · Privacy · Terms', 'footer'), { background: '#0b1020', color: '#c4cada', padding: '30px', borderRadius: '16px' }),
    component('modal', 'Feature modal', 'Welcome to Northstar', 'modal', { description: 'The feature tour is ready. Explore a calmer way to ship great work.' }),
    component('toast', 'Demo notification', 'Interactive demo enabled', 'toast'),
  ]
  project.pages = [{ id: crypto.randomUUID(), name: 'Landing', path: '/', components }]
  project.state = { experience: 'landing' }
  project.theme.tokens = { primary: '#6d5dfc', ink: '#101528', surface: '#ffffff', canvas: '#f5f3ff' }
  return project
}

export function createDashboardProject(name: string): Project {
  const project = createProject(name)
  const components = [
    style(component('navbar', 'Sidebar', 'Orbit PM', 'sidebar', { links: 'Overview,Projects,Team,Reports' }), { width: '240px', minHeight: '720px', background: '#111827', color: '#ffffff', borderRadius: '18px' }),
    style(component('navbar', 'Topbar', 'Projects workspace', 'topbar'), { background: '#ffffff', color: '#172033', boxShadow: '0 8px 24px #1f29370f' }),
    component('title', 'Dashboard title', 'Good morning, Alex', 'dashboard-title'),
    ...[
      ['Total projects', 'kpi-total'], ['In progress', 'kpi-progress'], ['Completed', 'kpi-completed'], ['High priority', 'kpi-priority'],
    ].map(([label, slot]) => style(component('card', label, label, slot), { width: '23%', minHeight: '128px', background: '#ffffff', padding: '20px', boxShadow: '0 10px 28px #1f29370f' })),
    component('input', 'Project search', 'Search projects', 'search', { placeholder: 'Search by name or description…' }),
    component('select', 'Status filter', 'All statuses', 'filter', { options: 'All statuses,Planned,In progress,Completed,On hold' }),
    component('button', 'Sort projects', 'Sort: newest', 'sort'),
    style(component('button', 'Create project', 'New project', 'create'), { width: '150px', background: '#6d5dfc', color: '#ffffff' }),
    style(component('table', 'Projects table', 'Projects', 'projects-table'), { minHeight: '340px', background: '#ffffff', padding: '0', boxShadow: '0 12px 30px #1f29370f' }),
    component('loader', 'Loading projects', 'Loading projects…', 'loading'),
    component('empty', 'Empty projects', 'No projects match your filters.', 'empty'),
    component('alert', 'Projects error', 'Unable to load projects.', 'error'),
    component('modal', 'Project editor', 'Create project', 'project-modal'),
    component('form', 'Project form', 'Project details', 'project-form'),
    component('modal', 'Project detail', 'Project detail', 'detail-modal'),
    component('toast', 'Project toast', 'Project saved', 'toast'),
  ]
  project.pages = [{ id: crypto.randomUUID(), name: 'Dashboard', path: '/', components }]
  project.state = { experience: 'dashboard' }
  project.theme.tokens = { primary: '#6d5dfc', ink: '#172033', surface: '#ffffff', canvas: '#f4f6fa' }
  return project
}
