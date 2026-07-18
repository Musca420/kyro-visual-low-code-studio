$ErrorActionPreference = 'Stop'
$base = if ($args[0]) { $args[0].TrimEnd('/') } else { 'http://127.0.0.1:4173' }
try {
  $state = Invoke-RestMethod -Uri "$base/api/live/status" -TimeoutSec 5
  $required = 'projectId', 'pageId', 'revision', 'selectedComponentIds', 'timestamp', 'previewState'
  $missing = $required | Where-Object { $null -eq $state.$_ }
  if ($missing) { throw "Stato incompleto: $($missing -join ', ')" }
  $state | ConvertTo-Json -Depth 30
} catch {
  Write-Error "Frontend Editor Live Bridge non raggiungibile: $($_.Exception.Message)"
  exit 1
}
