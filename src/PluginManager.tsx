import { useEffect, useState } from 'react'
import { installPlugin, listPlugins, removePlugin } from './db'
import type { PluginManifest, Project } from './model'

const example: PluginManifest = {
  id: 'example.focus-theme', name: 'Focus Theme', version: '1.0.0', author: 'Frontend Editor',
  compatibility: '1.x', dependencies: [], permissions: ['themes'], contributions: ['theme:focus'], configuration: {},
}

export function PluginManager({ project, onChange }: { project: Project; onChange: (project: Project) => void }) {
  const [catalog, setCatalog] = useState<PluginManifest[]>([])
  const [feedback, setFeedback] = useState('')
  const refresh = () => listPlugins().then(setCatalog)
  useEffect(() => { void refresh() }, [])
  const install = async () => {
    try {
      if (catalog.some((plugin) => plugin.id === example.id)) throw new Error('Il plugin è già installato: collisione ID impedita')
      await installPlugin(example)
      onChange({ ...project, plugins: [...project.plugins, { id: example.id, version: example.version, enabled: true }] })
      setFeedback('Plugin installato e abilitato')
      await refresh()
    } catch (error) { setFeedback(error instanceof Error ? error.message : String(error)) }
  }
  const toggle = (id: string) => {
    const existing = project.plugins.find((plugin) => plugin.id === id)
    onChange({ ...project, plugins: existing ? project.plugins.map((plugin) => plugin.id === id ? { ...plugin, enabled: !plugin.enabled } : plugin) : [...project.plugins, { id, version: catalog.find((plugin) => plugin.id === id)!.version, enabled: true }] })
    setFeedback(existing?.enabled ? 'Plugin disabilitato' : 'Plugin abilitato')
  }
  const remove = async (id: string) => {
    await removePlugin(id)
    onChange({ ...project, plugins: project.plugins.filter((plugin) => plugin.id !== id) })
    setFeedback('Plugin rimosso')
    await refresh()
  }
  return <section className="settings-section" aria-labelledby="plugins-title">
    <div className="section-heading"><div><p className="eyebrow">Catalogo locale</p><h2 id="plugins-title">Plugin</h2></div><button onClick={install}>Installa plugin di esempio</button></div>
    {feedback && <p role="status" className="feedback">{feedback}</p>}
    {catalog.length === 0 ? <div className="empty-panel"><strong>Catalogo vuoto</strong><span>Installa il plugin di esempio validato, senza eseguire codice esterno.</span></div> : catalog.map((manifest) => {
      const state = project.plugins.find((plugin) => plugin.id === manifest.id)
      return <article className="plugin-card" key={manifest.id}>
        <div><strong>{manifest.name}</strong><span>{manifest.id} · v{manifest.version} · {manifest.author}</span><small>Permessi: {manifest.permissions.join(', ') || 'nessuno'}</small></div>
        <div className="button-row"><button className="secondary" onClick={() => toggle(manifest.id)}>{state?.enabled ? 'Disabilita' : 'Abilita'}</button><button className="danger" onClick={() => remove(manifest.id)}>Rimuovi</button></div>
      </article>
    })}
  </section>
}
