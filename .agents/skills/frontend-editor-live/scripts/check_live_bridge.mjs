const base = (process.argv[2] || process.env.FRONTEND_EDITOR_LIVE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')
try {
  const response = await fetch(`${base}/api/live/status`, { signal: AbortSignal.timeout(5000) })
  const state = await response.json()
  if (!response.ok) throw new Error(state.error || `HTTP ${response.status}`)
  const required = ['projectId', 'pageId', 'revision', 'selectedComponentIds', 'timestamp', 'previewState']
  const missing = required.filter((key) => state[key] === undefined || state[key] === null)
  if (missing.length) throw new Error(`Stato incompleto: ${missing.join(', ')}`)
  console.log(JSON.stringify({ projectId: state.projectId, pageId: state.pageId, revision: state.revision, selectedComponentIds: state.selectedComponentIds, viewport: state.viewport, previewState: state.previewState, validationErrors: state.validationErrors, consoleErrors: state.consoleErrors }, null, 2))
} catch (error) {
  console.error(`Frontend Editor Live Bridge non raggiungibile: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
