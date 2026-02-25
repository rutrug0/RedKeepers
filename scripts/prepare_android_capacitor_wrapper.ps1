param(
  [switch]$CleanWeb
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
  $cmd = @("tools/android_capacitor_wrapper.py", "prepare")
  if ($CleanWeb) {
    $cmd += "--clean-web"
  }
  python @cmd
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
