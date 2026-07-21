import { useCallback, useEffect, useState } from 'react'
import { installPlugin, listGlobalCapabilities, listPlugins, removePlugin, saveOpenModeSession, saveVerifiedOpenModeResult } from './db'
import type { PluginManifest, Project } from './model'
import type { GlobalCapability } from './globalCapability'
import { chooseOpenModeResolution, failOpenModeSession, startOpenMode, verifyOpenModeModule, type OpenModeSession } from './openMode'
import type { ProjectTransactionRecord } from './transactionEngine'

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

export function PluginManager({ project, onChange, onInstallModule, onCatalogChange }: { project: Project; onChange: (project: Project) => void; onInstallModule: (module: Project['codeModules'][number]) => Promise<ProjectTransactionRecord>; onCatalogChange?: () => void }) {
  const [catalog, setCatalog] = useState<PluginManifest[]>([])
  const [capabilities, setCapabilities] = useState<GlobalCapability[]>([])
  const [feedback, setFeedback] = useState('')
  const [openMode, setOpenMode] = useState<OpenModeSession>()
  const [moduleOperation, setModuleOperation] = useState<Project['codeModules'][number]['operation']>('trim')
  const [testInput, setTestInput] = useState(' example ')
  const [testExpected, setTestExpected] = useState('example')
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
  const selectedCapability = capabilities.find((capability) => capability.id === openMode?.capabilityRecordId)
  const beginOpenMode = async (capability: GlobalCapability) => {
    const session = startOpenMode(capability, project.id)
    setOpenMode(session); await saveOpenModeSession(session)
  }
  const recordLimitation = async () => {
    if (!openMode) return
    const completed = chooseOpenModeResolution(openMode, 'limitation')
    setOpenMode(completed); await saveOpenModeSession(completed); setFeedback('Limitation recorded. Kyro did not simulate or install anything.')
  }
  const implementModule = async () => {
    if (!openMode || !selectedCapability) return
    const session = chooseOpenModeResolution(openMode, 'local_module')
    setOpenMode(session); await saveOpenModeSession(session)
    const outputType = moduleOperation === 'count' ? 'number' : moduleOperation === 'pick' ? 'unknown' : 'string'
    const inputType = moduleOperation === 'count' ? 'list' : moduleOperation === 'pick' ? 'record' : moduleOperation === 'template' ? 'unknown' : 'string'
    const module = { id: crypto.randomUUID(), name: selectedCapability.name, description: selectedCapability.generalizedIntent, inputType, outputType, operation: moduleOperation, config: {}, tests: [{ id: crypto.randomUUID(), input: testInput, expected: testExpected }] } as Project['codeModules'][number]
    try {
      const transaction = await onInstallModule(module)
      const result = await verifyOpenModeModule(session, selectedCapability, module, transaction.id, transaction.verification!)
      if (result.implementation) await saveVerifiedOpenModeResult(result)
      else await saveOpenModeSession(result.session)
      setOpenMode(result.session); setFeedback(result.session.events.at(-1)?.detail ?? 'Open Mode completed'); await refresh()
    } catch (error) {
      const failed = failOpenModeSession(session, error instanceof Error ? error.message : String(error))
      setOpenMode(failed); await saveOpenModeSession(failed); setFeedback(failed.events.at(-1)!.detail)
    }
  }
  return <section className="settings-section" aria-labelledby="plugins-title">
    <div className="section-heading"><div><p className="eyebrow">Local catalog</p><h2 id="plugins-title">Plugins</h2></div><button onClick={install}>Install example plugin</button></div>
    {feedback && <p role="status" className="feedback">{feedback}</p>}
    <div className="section-heading"><div><p className="eyebrow">Codex capability registry</p><h3>Global capabilities</h3></div><span>{capabilities.length} saved</span></div>
    {capabilities.length === 0 ? <div className="empty-panel"><strong>No learned capabilities yet</strong><span>Unsupported requests can become reviewed, reusable Kyro capabilities.</span></div> : capabilities.map((capability) => <article className="plugin-card" key={capability.id}>
      <div><strong>{capability.name}</strong><span>{capability.kind.replace('_', ' ')} · v{capability.version} · global</span><small>{capability.generalizedIntent}</small><small>State: {capability.state} · activation: {capability.activation.replace('_', ' ')}</small><small>Implementation: {capability.contract.implementation.status} · evidence: {capability.evidence.filter((item) => item.passed).length}/{capability.validationTests.length + 1}</small>{capability.previousVersion && <small>Migration from v{capability.previousVersion}: {capability.migrations[0]?.strategy ?? 'not planned'} · rollback v{capability.previousVersion}</small>}</div>
      <div className="button-row"><span className={capability.state === 'active' ? 'valid-chip' : 'warning-chip'}>{capability.state}</span>{capability.state !== 'active' && <button type="button" className="secondary" onClick={() => void beginOpenMode(capability)}>Resolve safely</button>}</div>
    </article>)}
    {openMode && selectedCapability && <section className="settings-card open-mode-panel" aria-label="Open Mode resolution">
      <p className="eyebrow">Open Mode · {openMode.stage}</p><h3>{selectedCapability.name}</h3><p>{openMode.limitation}</p>
      {openMode.stage === 'limitation' && <div className="button-row">{selectedCapability.kind === 'typed_module' && selectedCapability.validationTests.length === 1 && <button type="button" onClick={() => void implementModule()}>Build confined module</button>}<button type="button" className="secondary" onClick={() => void recordLimitation()}>Keep explicit limitation</button></div>}
      {openMode.stage === 'limitation' && selectedCapability.kind === 'typed_module' && selectedCapability.validationTests.length === 1 && <div className="open-mode-module"><label>Safe operation<select aria-label="Open Mode operation" value={moduleOperation} onChange={(event) => setModuleOperation(event.target.value as typeof moduleOperation)}><option value="trim">Trim spaces</option><option value="uppercase">Uppercase</option><option value="lowercase">Lowercase</option><option value="template">Compose text</option><option value="pick">Read field</option><option value="count">Count items</option></select></label><label>Test input<input aria-label="Open Mode test input" value={testInput} onChange={(event) => setTestInput(event.target.value)} /></label><label>Expected result<input aria-label="Open Mode expected result" value={testExpected} onChange={(event) => setTestExpected(event.target.value)} /></label></div>}
      {openMode.events.map((item, index) => <small key={`${item.at}-${index}`}>{item.stage}: {item.status} · {item.detail}</small>)}
    </section>}
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
