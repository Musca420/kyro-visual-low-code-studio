$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$work = Join-Path $root ".kyro\benchmarks\evaluation-prompts-10"
$project = Join-Path $work "cli-copy"
$baseline = Join-Path $work "baseline-app"
$projectPath = [IO.Path]::GetFullPath($project)
$workPath = [IO.Path]::GetFullPath($work) + [IO.Path]::DirectorySeparatorChar
if (-not $projectPath.StartsWith($workPath, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe benchmark path" }
if (Test-Path -LiteralPath $projectPath) { Remove-Item -LiteralPath $projectPath -Recurse -Force }
Copy-Item -LiteralPath $baseline -Destination $projectPath -Recurse
$protocol = Get-Content -Raw (Join-Path $root "docs\benchmarks\kyro-vs-codex-cli-10-prompts.json") | ConvertFrom-Json
$results = @()

foreach ($item in $protocol.prompts) {
  $output = Join-Path $work ("cli-" + $item.id + ".jsonl")
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  $item.prompt | & codex exec --ignore-user-config --ephemeral --json --skip-git-repo-check --sandbox workspace-write -c 'model_reasoning_effort="low"' -C $project - | Tee-Object -FilePath $output
  $exitCode = $LASTEXITCODE
  $watch.Stop()
  $events = Get-Content $output | ForEach-Object { try { $_ | ConvertFrom-Json } catch {} }
  $usage = ($events | Where-Object type -eq "turn.completed" | Select-Object -Last 1).usage
  $message = ($events | Where-Object { $_.item.type -eq "agent_message" } | Select-Object -Last 1).item.text
  $commands = @($events | Where-Object { $_.item.type -eq "command_execution" }).Count
  $files = @(Get-ChildItem -Path $project -Recurse -File | Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]|[\\/]dist[\\/]' })
  $results += [ordered]@{
    id = $item.id
    prompt = $item.prompt
    success = $exitCode -eq 0
    exitCode = $exitCode
    elapsedMs = $watch.ElapsedMilliseconds
    usage = [ordered]@{
      inputTokens = [int64]$usage.input_tokens
      cachedInputTokens = [int64]$usage.cached_input_tokens
      outputTokens = [int64]$usage.output_tokens
      totalTokens = [int64]$usage.input_tokens + [int64]$usage.output_tokens
    }
    commandExecutions = $commands
    projectFileCount = $files.Count
    result = $message
  }
}

[ordered]@{ protocol = $protocol.title; results = $results } |
  ConvertTo-Json -Depth 8 |
  Set-Content -Encoding utf8 (Join-Path $work "cli-results.json")
