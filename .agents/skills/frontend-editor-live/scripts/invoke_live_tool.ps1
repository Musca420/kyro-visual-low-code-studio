param(
  [Parameter(Mandatory = $true)][string]$Tool,
  [string]$ArgsJson = '{}',
  [string]$BaseUrl = 'http://127.0.0.1:4173'
)
$ErrorActionPreference = 'Stop'
$state = Invoke-RestMethod -Uri "$BaseUrl/api/live/status" -TimeoutSec 5
$payload = @{
  projectId = $state.projectId
  pageId = $state.pageId
  revision = $state.revision
  args = $ArgsJson | ConvertFrom-Json
} | ConvertTo-Json -Depth 30
Invoke-RestMethod -Uri "$BaseUrl/api/live/tools/$Tool" -Method Post -ContentType 'application/json' -Body $payload | ConvertTo-Json -Depth 30
