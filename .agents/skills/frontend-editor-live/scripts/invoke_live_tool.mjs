const [tool, argsJson = '{}', baseArg = process.env.FRONTEND_EDITOR_LIVE_URL || 'http://127.0.0.1:4173'] = process.argv.slice(2)
if (!tool) throw new Error('Uso: node scripts/invoke_live_tool.mjs <tool> [args-json] [base-url]')
const base = baseArg.replace(/\/$/, '')
const statusResponse = await fetch(`${base}/api/live/status`, { signal: AbortSignal.timeout(5000) })
const state = await statusResponse.json()
if (!statusResponse.ok) throw new Error(state.error || `Bridge HTTP ${statusResponse.status}`)
const response = await fetch(`${base}/api/live/tools/${encodeURIComponent(tool)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: state.projectId, pageId: state.pageId, revision: state.revision, args: JSON.parse(argsJson) }) })
let result = await response.json()
if (response.ok && response.status === 202 && result.transactionId) {
  for (let attempt = 0; attempt < 120 && result.status === 'pending'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const transaction = await fetch(`${base}/api/live/transactions/${encodeURIComponent(result.transactionId)}`)
    result = await transaction.json()
    if (!transaction.ok) break
  }
}
console.log(JSON.stringify(result, null, 2))
if (!response.ok || result.status === 'error' || result.status === 'pending') process.exitCode = 1
