param(
  [switch]$SkipPrepare,
  [switch]$CleanWeb
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
  $cmd = @("tools/steam_tauri_wrapper.py", "dev")
  if ($SkipPrepare) {
    $cmd += "--skip-prepare"
  }
  if ($CleanWeb) {
    $cmd += "--clean-web"
  }
  python @cmd
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
