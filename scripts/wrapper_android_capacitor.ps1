param(
  [ValidateSet("prepare", "sync", "dev", "build-debug", "build-release")]
  [string]$Mode = "prepare",
  [switch]$SkipSync,
  [switch]$SkipPrepare,
  [switch]$CleanWeb
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
  $cmd = @("tools/android_capacitor_wrapper.py", $Mode)
  switch ($Mode) {
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
  python @cmd
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
