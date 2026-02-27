param(
  [ValidateSet("prepare", "sync", "dev", "package", "package-debug", "package-release", "build-debug", "build-release")]
  [string]$Mode = "prepare",
  [switch]$SkipSync,
  [switch]$SkipPrepare,
  [switch]$CleanWeb
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $PSCommandPath
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..")
$wrapperToolPath = Join-Path $repoRoot "tools/android_capacitor_wrapper.py"

$resolvedMode = switch ($Mode) {
  "package" { "build-debug" }
  "package-debug" { "build-debug" }
  "package-release" { "build-release" }
  default { $Mode }
}

if (-not (Test-Path -LiteralPath $wrapperToolPath -PathType Leaf)) {
  Write-Output "STATUS: BLOCKED`nAndroid wrapper tool script not found: $wrapperToolPath"
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
  switch ($resolvedMode) {
    "sync" {
      if ($SkipPrepare) {
        $cmd += "--skip-prepare"
      }
    }
    "dev" {
      if ($SkipSync) {
        $cmd += "--skip-sync"
      }
      if ($SkipPrepare) {
        $cmd += "--skip-prepare"
      }
    }
    "build-debug" {
      if ($SkipSync) {
        $cmd += "--skip-sync"
      }
      if ($SkipPrepare) {
        $cmd += "--skip-prepare"
      }
    }
    "build-release" {
      if ($SkipSync) {
        $cmd += "--skip-sync"
      }
      if ($SkipPrepare) {
        $cmd += "--skip-prepare"
      }
    }
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
