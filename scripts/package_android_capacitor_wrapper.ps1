param(
  [ValidateSet("debug", "release")]
  [string]$Variant = "debug",
  [switch]$SkipSync,
  [switch]$SkipPrepare,
  [switch]$CleanWeb
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
  $subcommand = if ($Variant -eq "release") { "build-release" } else { "build-debug" }
  $cmd = @("tools/android_capacitor_wrapper.py", $subcommand)
  if ($SkipSync) {
    $cmd += "--skip-sync"
  }
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
