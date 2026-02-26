param(
  [ValidateSet("prepare", "dev", "build")]
  [string]$Mode = "prepare",
  [switch]$SkipPrepare,
  [switch]$CleanWeb
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
  $cmd = @("tools/steam_tauri_wrapper.py", $Mode)
  if (($Mode -ne "prepare") -and $SkipPrepare) {
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
