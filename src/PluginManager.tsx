import { useCallback, useEffect, useState } from 'react'
import { installPlugin, listGlobalCapabilities, listPlugins, removePlugin } from './db'
import type { PluginManifest, Project } from './model'
import type { GlobalCapability } from './globalCapability'

const example: PluginManifest = {
  id: 'example.focus-theme', name: 'Focus Theme', version: '1.0.0', author: 'Kyro',
  compatibility: '1.x', dependencies: [], permissions: ['components', 'flows', 'data', 'themes'],
  contributions: [
    { kind: 'component', id: 'focus-card', label: 'Focus card', componentType: 'card', props: { label: 'Focus card' }, styles: { background: '#102a2f', color: '#e6fffb', borderColor: '#22d3ee', borderWidth: '1px', borderStyle: 'solid', boxShadow: '0 16px 38px #06181d40' } },
    { kind: 'node', id: 'focus-notify', label: 'Focus notification', nodeType: 'notify', config: { message: 'Focus session completed' } },
    { kind: 'provider', id: 'focus-api', label: 'Local Focus API', endpoint: 'http://127.0.0.1:8787/records' },
    { kind: 'theme', id: 'focus-dark', label: 'Focus Theme', tokens: { pageBackground: '#07181c', primary: '#22d3ee', accent: '#fb923c' } },
  ], configuration: {},
}

export function PluginManager({ project, onChange, onCatalogChange }: { project: Project; onChange: (project: Project) => void; onCatalogChange?: () => void }) {
  const [catalog, setCatalog] = useState<PluginManifest[]>([])
  const [capabilities, setCapabilities] = useState<GlobalCapability[]>([])
  const [feedback, setFeedback] = useState('')
  const refresh = useCallback(() => Promise.all([listPlugins(), listGlobalCapabilities()]).then(([plugins, globalCapabilities]) => { setCatalog(plugins); setCapabilities(globalCapabilities); onCatalogChange?.() }), [onCatalogChange])
  useEffect(() => { void refresh() }, [refresh])
  const install = async () => {
    try {
      if (catalog.some((plugin) => plugin.id === example.id)) throw new Error('The plugin is already installed: duplicate ID blocked')
      await installPlugin(example)
      onChange({ ...project, plugins: [...project.plugins, { id: example.id, version: example.version, enabled: true }] })
      setFeedback('Plugin installed and enabled')
      await refresh()
    } catch (error) { setFeedback(error instanceof Error ? error.message : String(error)) }
  }
  const toggle = (id: string) => {
    const existing = project.plugins.find((plugin) => plugin.id === id)
    onChange({ ...project, plugins: existing ? project.plugins.map((plugin) => plugin.id === id ? { ...plugin, enabled: !plugin.enabled } : plugin) : [...project.plugins, { id, version: catalog.find((plugin) => plugin.id === id)!.version, enabled: true }] })
    setFeedback(existing?.enabled ? 'Plugin disabled' : 'Plugin enabled')
  }
  const remove = async (id: string) => {
    await removePlugin(id)
    onChange({ ...project, plugins: project.plugins.filter((plugin) => plugin.id !== id) })
    setFeedback('Plugin removed')
    await refresh()
  }
  return <section className="settings-section" aria-labelledby="plugins-title">
    <div className="section-heading"><div><p className="eyebrow">Local catalog</p><h2 id="plugins-title">Plugins</h2></div><button onClick={install}>Install example plugin</button></div>
    {feedback && <p role="status" className="feedback">{feedback}</p>}
    <div className="section-heading"><div><p className="eyebrow">Codex capability registry</p><h3>Global capabilities</h3></div><span>{capabilities.length} saved</span></div>
    {capabilities.length === 0 ? <div className="empty-panel"><strong>No learned capabilities yet</strong><span>Unsupported requests can become reviewed, reusable Kyro capabilities.</span></div> : capabilities.map((capability) => <article className="plugin-card" key={capability.id}>
      <div><strong>{capability.name}</strong><span>{capability.kind.replace('_', ' ')} · v{capability.version} · global</span><small>{capability.generalizedIntent}</small><small>State: {capability.state} · activation: {capability.activation.replace('_', ' ')}</small></div>
      <span className={capability.state === 'active' ? 'valid-chip' : 'warning-chip'}>{capability.state}</span>
    </article>)}
    {catalog.length === 0 ? <div className="empty-panel"><strong>Empty catalog</strong><span>Install the validated example plugin without running external code.</span></div> : catalog.map((manifest) => {
      const state = project.plugins.find((plugin) => plugin.id === manifest.id)
      return <article className="plugin-card" key={manifest.id}>
        <div><strong>{manifest.name}</strong><span>{manifest.id} · v{manifest.version} · {manifest.author}</span><small>Permissions: {manifest.permissions.join(', ') || 'none'}</small><small>Isolated contributions: {manifest.contributions.map((item) => typeof item === 'string' ? item : `${item.kind}:${item.label}`).join(' · ') || 'none'}</small></div>
        <div className="button-row"><button className="secondary" onClick={() => toggle(manifest.id)}>{state?.enabled ? 'Disable' : 'Enable'}</button><button className="danger" onClick={() => remove(manifest.id)}>Remove</button></div>
        {state?.enabled && manifest.contributions.filter((item) => typeof item !== 'string' && item.kind === 'theme').map((item) => typeof item === 'string' || item.kind !== 'theme' ? null : <button key={item.id} className="secondary" onClick={() => { onChange({ ...project, theme: { tokens: { ...project.theme.tokens, ...item.tokens } } }); setFeedback(`Plugin theme applied: ${item.label}`) }}>Apply {item.label}</button>)}
      </article>
    })}
  </section>
}
