param(
  [ValidateSet("prepare", "dev", "package", "build")]
  [string]$Mode = "prepare",
  [switch]$SkipPrepare,
  [switch]$CleanWeb
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $PSCommandPath
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..")
$wrapperToolPath = Join-Path $repoRoot "tools/steam_tauri_wrapper.py"
$resolvedMode = if ($Mode -eq "package") { "build" } else { $Mode }

if (-not (Test-Path -LiteralPath $wrapperToolPath -PathType Leaf)) {
  Write-Output "STATUS: BLOCKED`nSteam wrapper tool script not found: $wrapperToolPath"
  exit 1
}

$pythonCommand = Get-Command python -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $pythonCommand) {
  Write-Output "STATUS: BLOCKED`npython is not available on PATH."
  exit 1
}

Push-Location $repoRoot
try {
  $cmd = @($wrapperToolPath, $resolvedMode)
  if (($resolvedMode -ne "prepare") -and $SkipPrepare) {
    $cmd += "--skip-prepare"
  }
  if ($CleanWeb) {
    $cmd += "--clean-web"
  }
  & $pythonCommand.Source @cmd
  exit $LASTEXITCODE
}
catch {
  Write-Output "STATUS: BLOCKED`n$($_.Exception.Message)"
  exit 1
}
finally {
  Pop-Location
}
