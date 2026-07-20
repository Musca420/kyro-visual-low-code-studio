param(
  [string]$Output = "artifacts/nexusfield/Kyro-Hackathon-Demo-2m40.mp4"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$toolRoot = Join-Path $env:LOCALAPPDATA "Temp/kyro-media-tools/node_modules"
$ffmpeg = Join-Path $toolRoot "ffmpeg-static/ffmpeg.exe"
$ffprobe = Join-Path $toolRoot "ffprobe-static/bin/win32/x64/ffprobe.exe"
if (-not (Test-Path $ffmpeg) -or -not (Test-Path $ffprobe)) {
  throw "Install ffmpeg-static and ffprobe-static in $toolRoot before building the demo."
}

$build = Join-Path $repo "artifacts/demo-build"
New-Item -ItemType Directory -Force -Path $build | Out-Null
$raw = Join-Path $repo "artifacts/nexusfield/raw-video"
$shots = Join-Path $repo "artifacts/nexusfield"
$font = "C\:/Windows/Fonts/segoeui.ttf"
$fontBold = "C\:/Windows/Fonts/seguisb.ttf"

function Invoke-Ffmpeg([string[]]$Arguments) {
  & $ffmpeg -hide_banner -loglevel error -y @Arguments
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed with exit code $LASTEXITCODE" }
}

function New-VideoSegment([string]$Name, [string]$Source, [double]$Duration, [double]$Start = 0) {
  $target = Join-Path $build "$Name.mp4"
  Invoke-Ffmpeg @(
    "-ss", "$Start", "-i", $Source, "-t", "$Duration", "-an",
    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x071315,fps=30,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", "30", $target
  )
  return $target
}

function New-StillSegment([string]$Name, [string]$Source, [double]$Duration) {
  $target = Join-Path $build "$Name.mp4"
  $frames = [int]($Duration * 30)
  Invoke-Ffmpeg @(
    "-loop", "1", "-i", $Source, "-t", "$Duration", "-an",
    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x071315,zoompan=z='min(zoom+0.00008,1.025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=30,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", "30", $target
  )
  return $target
}

function New-CardSegment([string]$Name, [double]$Duration, [string]$Headline, [string]$Subline) {
  $target = Join-Path $build "$Name.mp4"
  $headlineSafe = $Headline.Replace(":", "\:").Replace("'", "\'")
  $sublineSafe = $Subline.Replace(":", "\:").Replace("'", "\'")
  $filter = "drawtext=fontfile='$fontBold':text='$headlineSafe':fontcolor=white:fontsize=118:x=(w-text_w)/2:y=365,drawtext=fontfile='$font':text='$sublineSafe':fontcolor=0x5eead4:fontsize=42:x=(w-text_w)/2:y=540,drawbox=x=445:y=660:w=1030:h=3:color=0x22d3ee@0.8:t=fill,format=yuv420p"
  Invoke-Ffmpeg @("-f", "lavfi", "-i", "color=c=0x071315:s=1920x1080:r=30:d=$Duration", "-vf", $filter, "-c:v", "libx264", "-preset", "medium", "-crf", "20", $target)
  return $target
}

$segments = @()
$segments += New-CardSegment "00-title" 6 "KYRO" "Visual Low-Code Studio - Design first. Program anything."
$segments += New-VideoSegment "01-new-project" (Join-Path $raw "page@b139e3b57be7409c53ac4979dfcafeae.webm") 9.5
$segments += New-VideoSegment "02-design-live" (Join-Path $raw "page@bc357f3cd4ce36ed00308d275e3cdbd5.webm") 35
$segments += New-StillSegment "03-responsive-result" (Join-Path $shots "25-mobile-core-authored.png") 8
$segments += New-StillSegment "04-ask-codex" (Join-Path $shots "04-codex-home-plan.png") 17
$segments += New-VideoSegment "05-flow" (Join-Path $raw "page@1ea74b5cd2eb77cc89d024702c15b590.webm") 13.5
$segments += New-VideoSegment "06-data" (Join-Path $raw "page@0a460d33323f00b988077d4a66775b5d.webm") 18 4
$segments += New-StillSegment "07-preview-quote" (Join-Path $shots "35-preview-quote.png") 4
$segments += New-StillSegment "08-preview-review" (Join-Path $shots "36-preview-review.png") 4
$segments += New-StillSegment "09-preview-tablet" (Join-Path $shots "39-web-tablet.png") 4
$segments += New-StillSegment "10-preview-mobile" (Join-Path $shots "40-web-mobile.png") 4
$segments += New-VideoSegment "11-publish" (Join-Path $raw "page@54605ba7d03d965392311e3c17740748.webm") 11.5
$segments += New-StillSegment "12-android-camera" (Join-Path $shots "85-android-camera-permission.png") 4
$segments += New-StillSegment "13-android-notification" (Join-Path $shots "88-android-notification-permission.png") 4
$segments += New-StillSegment "14-android-queued" (Join-Path $shots "106-android-offline-mutation-queued.png") 4
$segments += New-StillSegment "15-android-synced" (Join-Path $shots "107-android-offline-mutation-synced.png") 4
$segments += New-StillSegment "16-android-final" (Join-Path $shots "108-android-offline-sync-final.png") 4
$segments += New-CardSegment "17-end" 8 "DESIGN TO WORKING SOFTWARE" "Local-first | Inspectable | Undoable | Open"

$concat = Join-Path $build "segments.txt"
$segments | ForEach-Object { "file '$($_.Replace("'", "''"))'" } | Set-Content -Encoding ascii $concat
$silent = Join-Path $build "silent.mp4"
Invoke-Ffmpeg @("-f", "concat", "-safe", "0", "-i", $concat, "-c", "copy", $silent)

$scriptText = Get-Content (Join-Path $repo "DEMO_SCRIPT.md") -Raw -Encoding UTF8
$narration = [regex]::Match($scriptText, "(?s)## Narration\s+(.*?)\s+## Recording acceptance").Groups[1].Value
$narration = ($narration -replace "\*\*", "" -replace "`r?`n+", " ").Trim()
$wav = Join-Path $build "narration.wav"
$voice = New-Object -ComObject SAPI.SpVoice
$english = @($voice.GetVoices()) | Where-Object { $_.GetDescription() -match "English|David|Zira|Mark" } | Select-Object -First 1
if ($english) { $voice.Voice = $english }
$voice.Rate = 1
$voice.Volume = 100
$stream = New-Object -ComObject SAPI.SpFileStream
$stream.Open($wav, 3, $false)
$voice.AudioOutputStream = $stream
[void]$voice.Speak($narration)
$stream.Close()

$videoDuration = [double](& $ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $silent)
$audioDuration = [double](& $ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $wav)
$audioFilter = "adelay=900|900,apad=pad_dur=10"
if ($audioDuration -gt ($videoDuration - 2)) {
  $tempo = $audioDuration / ($videoDuration - 2)
  if ($tempo -gt 2) { throw "Narration is too long for a single atempo filter." }
  $audioFilter = "atempo=$($tempo.ToString('0.000', [Globalization.CultureInfo]::InvariantCulture)),adelay=900|900,apad=pad_dur=10"
}

$outputPath = Join-Path $repo $Output
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outputPath) | Out-Null
Invoke-Ffmpeg @(
  "-i", $silent, "-i", $wav, "-filter:a", $audioFilter, "-t", "$videoDuration",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", $outputPath
)

$resultDuration = & $ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $outputPath
Write-Host "Created $outputPath"
Write-Host "Video duration: $resultDuration seconds; raw narration: $audioDuration seconds"
