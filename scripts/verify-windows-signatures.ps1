$ErrorActionPreference = 'Stop'
$targets = @(
  (Get-ChildItem -LiteralPath 'desktop-dist\make\squirrel.windows\x64' -Filter 'Kyro-*-Setup.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1),
  (Get-Item -LiteralPath 'desktop-dist\Kyro-win32-x64\kyro.exe')
)
foreach ($target in $targets) {
  if (-not $target) { throw 'A required Kyro release artifact is missing.' }
  $signature = Get-AuthenticodeSignature -LiteralPath $target.FullName
  if ($signature.Status -ne 'Valid') { throw "Invalid or missing signature: $($target.FullName) ($($signature.Status))" }
  Write-Output "Valid signature: $($target.FullName) · $($signature.SignerCertificate.Subject)"
}
