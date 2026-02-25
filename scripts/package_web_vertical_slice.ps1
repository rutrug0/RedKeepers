param(
  [switch]$Clean
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
  $cmd = @("tools/web_vertical_slice_packaging.py", "package")
  if ($Clean) {
    $cmd += "--clean"
  }
  python @cmd
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
