param(
  [switch]$SkipPrepare,
  [switch]$CleanWeb
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
  $cmd = @("tools/android_capacitor_wrapper.py", "sync")
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
